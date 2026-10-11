import {describe, expect, it, vi} from 'vitest';
import {createEncryptedAuthStorage, securityStorageChunks} from '../shared/security-storage';

function fixture() {
  const values = new Map<string, string>();
  const operations: Array<{action: string; key: string; value?: string}> = [];
  const encrypted = {
    getItem: vi.fn(async (key: string) => {operations.push({action: 'get', key}); return values.get(key) ?? null;}),
    setItem: vi.fn(async (key: string, value: string) => {operations.push({action: 'set', key, value}); values.set(key, value);}),
    removeItem: vi.fn(async (key: string) => {operations.push({action: 'remove', key}); values.delete(key);}),
  };
  const eraseLegacy = vi.fn(async (_key: string) => {});
  return {values, operations, encrypted, eraseLegacy, storage: createEncryptedAuthStorage(encrypted, eraseLegacy)};
}

describe('OS-encrypted Business auth storage', () => {
  it('chunks Unicode by UTF-8 bytes and preserves complete surrogate pairs', () => {
    const value = 'Ana 🥳 Ștefan '.repeat(500);
    const chunks = securityStorageChunks(value);
    expect(chunks.join('')).toBe(value); expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => Buffer.byteLength(chunk, 'utf8') <= 1800)).toBe(true);
    expect(securityStorageChunks('x'.repeat(64 * 1800))).toHaveLength(64);
    expect(() => securityStorageChunks('')).toThrow();
    expect(() => securityStorageChunks('x'.repeat(64 * 1800 + 1))).toThrow();
    expect(() => securityStorageChunks('🥳'.repeat(30_000))).toThrow();
  });
  it('commits the manifest last and stores no session value in legacy plaintext storage', async () => {
    const f = fixture(), value = 'TOKEN'.repeat(1000);
    await f.storage.setItem('auth', value); expect(await f.storage.getItem('auth')).toBe(value);
    const writes = f.operations.filter(x => x.action === 'set');
    expect(writes.at(-1)?.key).toBe('auth'); expect(writes.at(-1)?.value).not.toContain('TOKEN');
    expect(f.eraseLegacy).toHaveBeenCalledWith('auth');
  });
  it('waits for delayed chunk writes before rolling back a failed write', async () => {
    const f = fixture(); await f.storage.setItem('auth', 'previous-session');
    const before = new Map(f.values);
    let release!: () => void; const delayed = new Promise<void>(resolve => {release = resolve;});
    f.encrypted.setItem.mockImplementation(async (key, value) => {
      if (key.endsWith('.0')) throw new Error('Keychain rejected chunk');
      if (key.endsWith('.1')) await delayed;
      f.values.set(key, value);
    });
    let settled = false;
    const writing = f.storage.setItem('auth', 'x'.repeat(3000)).catch(error => {settled = true; return error;});
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(settled).toBe(false); release(); expect((await writing).message).toContain('Keychain rejected');
    expect(f.values).toEqual(before); expect(await f.storage.getItem('auth')).toBe('previous-session');
  });
  it('preserves the previous manifest and chunks if manifest commit fails', async () => {
    const f = fixture(); await f.storage.setItem('auth', 'previous-session'); const before = new Map(f.values);
    f.encrypted.setItem.mockImplementation(async (key, value) => {if (key === 'auth') throw new Error('Commit failed'); f.values.set(key, value);});
    await expect(f.storage.setItem('auth', 'new-session'.repeat(300))).rejects.toThrow('Commit failed');
    expect(f.values).toEqual(before); expect(await f.storage.getItem('auth')).toBe('previous-session');
  });
  it('serializes reads and writes for one key without exposing partial values', async () => {
    const f = fixture(); await f.storage.setItem('auth', 'old');
    let release!: () => void; const delayed = new Promise<void>(resolve => {release = resolve;});
    f.encrypted.setItem.mockImplementation(async (key, value) => {if (key.endsWith('.1')) await delayed; f.values.set(key, value);});
    const writing = f.storage.setItem('auth', 'new'.repeat(1000));
    const reading = f.storage.getItem('auth'); let readResolved = false; void reading.then(() => {readResolved = true;});
    await Promise.resolve(); await Promise.resolve(); expect(readResolved).toBe(false);
    release(); await writing; expect(await reading).toBe('new'.repeat(1000));
    expect(f.values.size).toBe(3);
  });
  it('does not allow recovery from missing old chunks to erase a queued newer session', async () => {
    const f = fixture(); await f.storage.setItem('auth', 'old');
    const old = JSON.parse(f.values.get('auth')!); f.values.delete(`auth.${old.generation}.0`);
    const reading = f.storage.getItem('auth'); const writing = f.storage.setItem('auth', 'new');
    expect(await reading).toBeNull(); await writing; expect(await f.storage.getItem('auth')).toBe('new');
  });
  it('cleans missing-chunk sessions and replaces malformed manifests safely', async () => {
    const f = fixture(); await f.storage.setItem('auth', 'x'.repeat(2000));
    const saved = JSON.parse(f.values.get('auth')!); f.values.delete(`auth.${saved.generation}.0`);
    expect(await f.storage.getItem('auth')).toBeNull(); expect(f.values.size).toBe(0);
    for (const corrupt of ['not json', '{"generation":{},"count":2}', '{"generation":"a","count":65}', '{"generation":"../../bad","count":1}']) {
      f.values.set('auth', corrupt); expect(await f.storage.getItem('auth')).toBeNull(); expect(f.values.has('auth')).toBe(false);
    }
    f.values.set('auth', 'bad'); await expect(f.storage.removeItem('auth')).resolves.toBeUndefined();
    await f.storage.setItem('auth', 'valid'); expect(await f.storage.getItem('auth')).toBe('valid');
  });
  it('fails closed on unavailable keychain or failed plaintext removal', async () => {
    const f = fixture(); f.encrypted.getItem.mockRejectedValueOnce(new Error('Keychain locked'));
    await expect(f.storage.getItem('auth')).rejects.toThrow('Keychain locked');
    expect(f.encrypted.setItem).not.toHaveBeenCalled();
    f.eraseLegacy.mockRejectedValueOnce(new Error('Legacy removal failed'));
    await expect(f.storage.setItem('auth', 'session')).rejects.toThrow('Legacy removal failed');
    expect(f.encrypted.setItem).not.toHaveBeenCalled();
  });
  it('removes all chunks and does not let a failed operation poison the per-key queue', async () => {
    const f = fixture(); await expect(f.storage.setItem('auth', '')).rejects.toThrow();
    await f.storage.setItem('auth', 'x'.repeat(4000)); await f.storage.removeItem('auth');
    expect(f.values.size).toBe(0); expect(await f.storage.getItem('auth')).toBeNull();
  });
  it('keeps concurrent successful updates complete even if generation entropy repeats', async () => {
    const f = fixture(); vi.spyOn(Date, 'now').mockReturnValue(1234); vi.spyOn(Math, 'random').mockReturnValue(0.25);
    try {
      await Promise.all([f.storage.setItem('auth', 'first'), f.storage.setItem('auth', 'second')]);
      expect(await f.storage.getItem('auth')).toBe('second'); expect(f.values.size).toBe(2);
    } finally { vi.restoreAllMocks(); }
  });
});

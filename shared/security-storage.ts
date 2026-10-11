export type EncryptedStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
type Manifest = {generation: string; count: number};
const chunkBytes = 1800, maxChunks = 64;

/** Keep each keychain item below 2 KiB, including non-ASCII profile metadata. */
export function securityStorageChunks(value: string): string[] {
  if (!value.length || value.length > chunkBytes * maxChunks) throw new Error('Sesiunea depășește spațiul securizat.');
  const chunks: string[] = [];
  let current = '', bytes = 0;
  for (const char of value) {
    const point = char.codePointAt(0)!;
    const size = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (bytes + size > chunkBytes) { chunks.push(current); current = ''; bytes = 0; }
    current += char; bytes += size;
    if (chunks.length >= maxChunks) throw new Error('Sesiunea depășește spațiul securizat.');
  }
  if (current) chunks.push(current);
  return chunks;
}

function parseManifest(value: string | null): Manifest | null {
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid manifest');
  const m = parsed as Manifest;
  if (typeof m.generation !== 'string' || !/^[a-z0-9]{1,100}$/.test(m.generation) || !Number.isInteger(m.count) || m.count < 1 || m.count > maxChunks)
    throw new Error('Invalid manifest');
  return m;
}

/** Encryption belongs to the supplied OS keychain adapter; no plaintext fallback. */
export function createEncryptedAuthStorage(store: EncryptedStore, eraseLegacy: (key: string) => Promise<void>) {
  const queues = new Map<string, Promise<unknown>>();
  let generationCount = 0;
  const chunkKey = (key: string, m: Manifest, index: number) => `${key}.${m.generation}.${index}`;
  async function removeChunks(key: string, m: Manifest | null) {
    if (!m) return;
    const results = await Promise.allSettled(Array.from({length: m.count}, (_, i) => store.removeItem(chunkKey(key, m, i))));
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }
  async function manifest(key: string): Promise<Manifest | null> {
    const raw = await store.getItem(key);
    try { return parseManifest(raw); }
    catch { await store.removeItem(key); return null; }
  }
  function serialize<T>(key: string, action: () => Promise<T>): Promise<T> {
    const prior = queues.get(key) ?? Promise.resolve();
    const next = prior.catch(() => {}).then(action);
    queues.set(key, next);
    void next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => {});
    return next;
  }
  return {
    getItem: (key: string): Promise<string | null> => serialize(key, async () => {
      await eraseLegacy(key);
      const m = await manifest(key);
      if (!m) return null;
      const chunks = await Promise.all(Array.from({length: m.count}, (_, i) => store.getItem(chunkKey(key, m, i))));
      if (chunks.some(value => value === null)) { await store.removeItem(key); await removeChunks(key, m); return null; }
      return chunks.join('');
    }),
    setItem: (key: string, value: string): Promise<void> => serialize(key, async () => {
      const chunks = securityStorageChunks(value);
      await eraseLegacy(key);
      const previous = await manifest(key);
      let generation: string;
      do { generation = Date.now().toString(36) + (++generationCount).toString(36) + Math.random().toString(36).slice(2); }
      while (generation === previous?.generation);
      const m = {generation, count: chunks.length};
      try {
        const results = await Promise.allSettled(chunks.map((chunk, i) => store.setItem(chunkKey(key, m, i), chunk)));
        const failure = results.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
        // Readers can observe only the old complete value or this complete value.
        await store.setItem(key, JSON.stringify(m));
      } catch (error) {
        try { await removeChunks(key, m); } catch { /* Preserve the originating failure and previous manifest. */ }
        throw error;
      }
      await removeChunks(key, previous);
    }),
    removeItem: (key: string): Promise<void> => serialize(key, async () => {
      await eraseLegacy(key);
      const m = await manifest(key);
      await store.removeItem(key);
      await removeChunks(key, m);
    }),
  };
}

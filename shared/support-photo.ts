export const MAX_SUPPORT_PHOTO_BYTES = 5 * 1024 * 1024;
export type SupportPhoto = { bytes: ArrayBuffer; contentType: "image/jpeg" | "image/png"; uri: string };

/** Validate the bytes after image decoding/recompression; names and picker MIME are untrusted. */
export function identifySupportPhoto(bytes: ArrayBuffer): SupportPhoto["contentType"] {
  const b = new Uint8Array(bytes), n = b.length;
  if (!n || n > MAX_SUPPORT_PHOTO_BYTES) throw new Error("Poza trebuie să aibă cel mult 5 MB.");
  if (n >= 12 && b[0] === 255 && b[1] === 216 && b[2] === 255 && b[n - 2] === 255 && b[n - 1] === 217)
    return "image/jpeg";
  if (n >= 45 && [137,80,78,71,13,10,26,10].every((v,i) => b[i] === v) &&
      [73,72,68,82].every((v,i) => b[12+i] === v) &&
      [0,0,0,0,73,69,78,68,174,66,96,130].every((v,i) => b[n-12+i] === v)) return "image/png";
  throw new Error("Alege o poză JPEG sau PNG validă.");
}

export function photoBytes(base64: string): ArrayBuffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  if (!base64 || base64.length > Math.ceil(MAX_SUPPORT_PHOTO_BYTES / 3) * 4 || base64.length % 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error("Nu am putut pregăti poza. Alege alta.");
  const length = base64.length / 4 * 3 - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  const bytes = new Uint8Array(length);
  for (let i = 0, j = 0; i < base64.length; i += 4) {
    const value = (alphabet.indexOf(base64[i]) << 18) | (alphabet.indexOf(base64[i+1]) << 12) |
      (Math.max(0, alphabet.indexOf(base64[i+2])) << 6) | Math.max(0, alphabet.indexOf(base64[i+3]));
    if (j < length) bytes[j++] = value >> 16 & 255;
    if (j < length) bytes[j++] = value >> 8 & 255;
    if (j < length) bytes[j++] = value & 255;
  }
  identifySupportPhoto(bytes.buffer);
  return bytes.buffer;
}

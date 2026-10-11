/** Locate the JPEG EOI structurally. Motion photos may contain an MP4 after it. */
export function jpegInfo(bytes: Uint8Array): {width: number; height: number; end: number} {
  const fail = () => {throw new Error('Imaginea JPEG nu este validă.');};
  if (bytes.length < 12 || bytes[0] !== 255 || bytes[1] !== 216) return fail();
  let i = 2, width = 0, height = 0, scan = false;
  while (i < bytes.length) {
    if (scan) {while (i < bytes.length && bytes[i] !== 255) i++;}
    if (bytes[i++] !== 255) return fail();
    while (bytes[i] === 255) i++;
    if (i >= bytes.length) return fail();
    const marker = bytes[i++];
    if (scan && (marker === 0 || marker >= 0xd0 && marker <= 0xd7)) continue;
    scan = false;
    if (marker === 0xd9) {
      if (!width || !height) return fail();
      return {width, height, end: i};
    }
    if (marker === 0x01) continue;
    if (marker === 0 || marker === 0xd8 || marker >= 0xd0 && marker <= 0xd7 || i + 2 > bytes.length) return fail();
    const length = bytes[i] * 256 + bytes[i + 1];
    if (length < 2 || i + length > bytes.length) return fail();
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      if (length < 8) return fail();
      height = bytes[i + 3] * 256 + bytes[i + 4]; width = bytes[i + 5] * 256 + bytes[i + 6];
    }
    i += length;
    if (marker === 0xda) scan = true;
  }
  return fail();
}

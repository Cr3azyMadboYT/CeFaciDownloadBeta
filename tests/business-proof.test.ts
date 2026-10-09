import { expect, it, vi } from "vitest";

vi.mock("../business/node_modules/expo-document-picker", () => ({ getDocumentAsync: vi.fn() }));
vi.mock("../business/node_modules/expo-file-system", () => ({ File: class {} }));
vi.mock("../business/node_modules/react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("../business/src/backend", () => ({ backend: {} }));
import { identifyProof, MAX_PROOF_BYTES } from "../business/src/onboarding-api";

const bytes = (values: number[], size = values.length) => {
  const result = new Uint8Array(size);
  result.set(values);
  return result.buffer;
};

it("rejects a renamed HTML/executable, a truncated signature and an empty proof", () => {
  for (const input of [new ArrayBuffer(0), bytes([0x25, 0x50]), new TextEncoder().encode("<script>alert(1)</script>").buffer, bytes([0x4d, 0x5a])])
    expect(() => identifyProof(input)).toThrow();
});
it("recognizes supported proof signatures independently of the filename or claimed MIME", () => {
  expect(identifyProof(bytes([0x25, 0x50, 0x44, 0x46, 0x2d]))).toEqual({ contentType: "application/pdf", extension: "pdf" });
  expect(identifyProof(bytes([0xff, 0xd8, 0xff]))).toEqual({ contentType: "image/jpeg", extension: "jpg" });
  expect(identifyProof(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toEqual({ contentType: "image/png", extension: "png" });
});
it("accepts the size boundary and refuses one byte beyond it", () => {
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d];
  expect(identifyProof(bytes(signature, MAX_PROOF_BYTES)).extension).toBe("pdf");
  expect(() => identifyProof(bytes(signature, MAX_PROOF_BYTES + 1))).toThrow(/8 MB/);
});

import { expect, it, vi } from "vitest";

vi.mock("../business/node_modules/expo-document-picker", () => ({ getDocumentAsync: vi.fn() }));
vi.mock("../business/node_modules/expo-file-system", () => ({ File: class {} }));
vi.mock("../business/node_modules/react-native", () => ({ Platform: { OS: "web" }, Image: {getSize: vi.fn()} }));
vi.mock("../business/node_modules/expo-image-manipulator", () => ({SaveFormat: {JPEG: "jpeg"}, manipulateAsync: vi.fn()}));
vi.mock("../business/src/backend", () => ({ backend: {} }));
import * as Picker from "../business/node_modules/expo-document-picker";
import {Image} from "../business/node_modules/react-native";
import {manipulateAsync} from "../business/node_modules/expo-image-manipulator";
import fs from "node:fs";
import {chooseProofs, identifyProof, MAX_PROOF_BYTES } from "../business/src/onboarding-api";

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

it('prepares optional files, normalizes motion photos and bounds the resulting filename',async()=>{
 const jpeg=fs.readFileSync('tests/fixtures/attachments/baseline.jpg');
 const pdf=fs.readFileSync('tests/fixtures/attachments/document.pdf');
 vi.mocked(Picker.getDocumentAsync).mockResolvedValue({canceled:false,assets:[
  {uri:'file:photo',name:'x'.repeat(200)+'.jpg',file:{arrayBuffer:async()=>new Uint8Array(Buffer.concat([jpeg,Buffer.from('motion')])).buffer}},
  {uri:'file:pdf',name:'Delegare.pdf',file:{arrayBuffer:async()=>new Uint8Array(pdf).buffer}},
 ]} as any);
 vi.mocked(Image.getSize).mockImplementation((_uri,success)=>success(4000,3000));
 vi.mocked(manipulateAsync).mockResolvedValue({uri:'prepared',width:32,height:24,base64:jpeg.toString('base64')});
 const files=await chooseProofs();expect(files).toHaveLength(2);expect(files[0].name.length).toBeLessThanOrEqual(150);
 expect(Buffer.from(files[0].bytes)).toEqual(jpeg);expect(files[1].name).toBe('Delegare.pdf');expect(Buffer.from(files[1].bytes)).toEqual(pdf);
 expect(manipulateAsync).toHaveBeenCalledWith(expect.any(String),[{resize:{width:2048}}],expect.objectContaining({format:'jpeg',base64:true}));
});
it('rejects extra picks and an incomplete PDF before any upload',async()=>{
 vi.mocked(Picker.getDocumentAsync).mockResolvedValue({canceled:false,assets:Array(6).fill({uri:'file:pdf',name:'Doc.pdf'})} as any);
 await expect(chooseProofs()).rejects.toThrow(/5 fișiere/);
 vi.mocked(Picker.getDocumentAsync).mockResolvedValue({canceled:false,assets:[{uri:'file:pdf',name:'Doc.pdf',file:{arrayBuffer:async()=>new TextEncoder().encode('%PDF-1.7 incomplete').buffer}}]} as any);
 await expect(chooseProofs()).rejects.toThrow(/PDF pare incomplet/);
});

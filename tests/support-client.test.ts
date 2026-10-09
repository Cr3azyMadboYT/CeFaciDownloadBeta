import { describe, expect, it, vi } from "vitest";
import { ReportSubmission, type ReportInput, type SupportClient, type SupportReport } from "../shared/support";
import { identifySupportPhoto, MAX_SUPPORT_PHOTO_BYTES, photoBytes } from "../shared/support-photo";

const jpeg = () => Uint8Array.from([255,216,255,224,0,4,0,0,0,0,255,217]).buffer;
const input: ReportInput = {key: "stable-key", kind: "issue", source: "business", title: "Nu pot scana", description: "Camera nu pornește când ating Scanner.", venue: "local-1"};
const draft: SupportReport = {id: "report-1",kind: "issue",source: "business",title: input.title,description: input.description,
  venue_id: "local-1",status: "draft",version: 1,created_at: "2026-10-09T12:00:00Z",updated_at: "2026-10-09T12:00:00Z",answer: null,
  photo_path: "user-1/report-1/photo.jpg",photo_available: false};
const setup = () => {
  const rpc = vi.fn(async (name: string) => ({data: name === "support_report_create" ? draft : {...draft,status: "new",photo_path: null},error: null}));
  const upload = vi.fn(async () => ({error: null}));
  const client = {rpc,storage: {from: vi.fn(() => ({upload}))}} as unknown as SupportClient;
  return {client,rpc,upload};
};
describe("private support report transport", () => {
  it("submits without an optional photo and never touches Storage", async () => {
    const {client,rpc,upload} = setup(), attempt = new ReportSubmission();
    const sent = await attempt.submit(client,input,() => true);
    expect(sent.status).toBe("new"); expect(upload).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith("support_report_submit",{p_id: draft.id,p_path: null});
  });
  it("freezes the payload before a lost create response and retries the same key", async () => {
    const {client,rpc} = setup(), attempt = new ReportSubmission();
    rpc.mockRejectedValueOnce(new Error("offline"));
    await expect(attempt.submit(client,input,() => true)).rejects.toThrow("offline");
    expect(attempt.frozen).toBe(true);
    await attempt.submit(client,{...input,key: "different",title: "different",description: "changed"},() => true);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });
  it("handles an already completed request after a lost submit response", async () => {
    const {client,rpc,upload} = setup(), attempt = new ReportSubmission();
    rpc.mockResolvedValueOnce({data: {...draft,status: "resolved",photo_path: null,answer: "Gata"} as SupportReport,error: null});
    expect((await attempt.submit(client,input,() => true)).status).toBe("resolved");
    expect(rpc).toHaveBeenCalledTimes(1); expect(upload).not.toHaveBeenCalled();
  });
  it("uploads immutable bytes and accepts a duplicate only when retrying", async () => {
    const {client,rpc,upload} = setup(), attempt = new ReportSubmission();
    upload.mockResolvedValueOnce({error: {statusCode: "409",message: "already exists"}} as never);
    const photo = {bytes: jpeg(), contentType: "image/jpeg" as const,uri: "safe-preview"};
    await attempt.submit(client,{...input,photo},() => true);
    expect(upload).toHaveBeenCalledWith(draft.photo_path, photo.bytes, {contentType: "image/jpeg",upsert: false});
    expect(rpc).toHaveBeenLastCalledWith("support_report_submit",{p_id: draft.id,p_path: draft.photo_path});
  });
  it("does not call create when the account was already revoked", async () => {
    const {client,rpc} = setup();
    await expect(new ReportSubmission().submit(client,input,() => false)).rejects.toThrow("Contul s-a schimbat");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("blocks upload and submit if the account changes while create is pending", async () => {
    const {client,rpc,upload} = setup(); let valid = true;
    rpc.mockImplementationOnce(async () => {valid = false; return {data: draft,error: null};});
    await expect(new ReportSubmission().submit(client,{...input,photo: {bytes: jpeg(),contentType: "image/jpeg",uri: "preview"}},() => valid)).rejects.toThrow("Contul s-a schimbat");
    expect(upload).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("blocks submit if the account changes during photo upload", async () => {
    const {client,rpc,upload} = setup(); let valid = true;
    upload.mockImplementationOnce(async () => {valid = false; return {error: null};});
    await expect(new ReportSubmission().submit(client,{...input,photo: {bytes: jpeg(),contentType: "image/jpeg",uri: "preview"}},() => valid)).rejects.toThrow("Contul s-a schimbat");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("rejects a MIME label that differs from actual image bytes before any RPC", async () => {
    const {client,rpc} = setup();
    await expect(new ReportSubmission().submit(client,{...input,photo: {bytes: jpeg(),contentType: "image/png",uri: "preview"}},() => true)).rejects.toThrow("nu corespunde");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("preserves immutable selected bytes across a failed upload retry", async () => {
    const {client,upload} = setup(), attempt = new ReportSubmission(), bytes = jpeg();
    upload.mockRejectedValueOnce(new Error("offline"));
    const next = {...input,photo: {bytes,contentType: "image/jpeg" as const,uri: "preview"}};
    await expect(attempt.submit(client,next,() => true)).rejects.toThrow("offline");
    new Uint8Array(bytes).fill(0);
    await attempt.submit(client,next,() => true);
    expect(identifySupportPhoto(upload.mock.calls[1][1])).toBe("image/jpeg");
  });
});
describe("support photo byte boundaries", () => {
  it("rejects fake extensions, empty bytes and a header without a complete image", () => {
    expect(() => identifySupportPhoto(new ArrayBuffer(0))).toThrow();
    expect(() => identifySupportPhoto(new TextEncoder().encode("<svg/onload=evil()>").buffer)).toThrow();
    expect(() => identifySupportPhoto(Uint8Array.from([255,216,255]).buffer)).toThrow();
  });
  it("accepts the exact 5 MiB limit and rejects one extra byte", () => {
    const bytes = new Uint8Array(MAX_SUPPORT_PHOTO_BYTES); bytes.set([255,216,255]); bytes.set([255,217],bytes.length-2);
    expect(identifySupportPhoto(bytes.buffer)).toBe("image/jpeg");
    expect(() => identifySupportPhoto(new ArrayBuffer(MAX_SUPPORT_PHOTO_BYTES+1))).toThrow("5 MB");
  });
  it("decodes strict Base64 after recompression and rejects corrupt data", () => {
    const encoded = Buffer.from(jpeg()).toString("base64");
    expect(new Uint8Array(photoBytes(encoded))).toEqual(new Uint8Array(jpeg()));
    expect(() => photoBytes("bad<script>")).toThrow();
    expect(() => photoBytes("a===")).toThrow();
  });
});

import { identifySupportPhoto, type SupportPhoto } from "./support-photo";
export type SupportStatus = "draft" | "new" | "in_progress" | "resolved" | "rejected" | "cancelled";
export type SupportReport = {
  id: string; origin?: "support" | "legacy"; kind: "issue" | "missing_place" | "venue_report";
  source: "client" | "business"; title: string; description: string; venue_id: string | null;
  status: SupportStatus; version: number; created_at: string; updated_at: string;
  answer: string | null; photo_path?: string | null; photo_available: boolean;
};
export const supportStatus: Record<SupportStatus, string> = {
  draft: "Ciornă · încă netrimisă", new: "Primită", in_progress: "În lucru",
  resolved: "Rezolvată", rejected: "Încheiată", cancelled: "Retrasă",
};
export interface SupportClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  storage: { from(bucket: string): { upload(path: string, bytes: ArrayBuffer, opts: {contentType: string; upsert: false}):
    PromiseLike<{error: {message: string; statusCode?: string | number} | null}> } };
}
export async function supportCall<T>(client: SupportClient, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const {data, error} = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export type ReportInput = { key: string; kind: "issue" | "missing_place"; source: "client" | "business";
  title: string; description: string; venue?: string | null; photo?: SupportPhoto | null };

/** Freeze before the first request: a lost create response must retry the same immutable payload. */
export class ReportSubmission {
  private input: ReportInput | null = null;
  draft: SupportReport | null = null;
  get frozen() { return this.input !== null; }
  reset() { this.input = null; this.draft = null; }
  async submit(client: SupportClient, next: ReportInput, valid: () => boolean): Promise<SupportReport> {
    const current = () => { if (!valid()) throw new Error("Contul s-a schimbat. Deschide din nou formularul."); };
    current();
    if (!this.input) {
      if (next.photo && identifySupportPhoto(next.photo.bytes) !== next.photo.contentType)
        throw new Error("Tipul pozei nu corespunde conținutului. Alege din nou poza.");
      this.input = {...next, title: next.title.trim(), description: next.description.trim(),
        photo: next.photo ? {...next.photo, bytes: next.photo.bytes.slice(0)} : null};
    }
    const input = this.input;
    const draft = await supportCall<SupportReport>(client, "support_report_create", {
      p_key: input.key, p_kind: input.kind, p_source: input.source, p_title: input.title,
      p_description: input.description, p_venue: input.venue ?? null, p_photo_mime: input.photo?.contentType ?? null,
    });
    current(); this.draft = draft;
    if (["new", "in_progress", "resolved", "rejected"].includes(draft.status)) return draft;
    if (draft.status !== "draft") throw new Error("Cererea nu mai poate fi trimisă. Verifică istoricul și începe una nouă.");
    let path: string | null = null;
    if (draft.status === "draft" && input.photo) {
      if (!draft.photo_path) throw new Error("Poza nu are o destinație validă. Reîncearcă trimiterea.");
      path = draft.photo_path; current();
      const {error} = await client.storage.from("support-photos").upload(path, input.photo.bytes, {
        contentType: input.photo.contentType, upsert: false,
      });
      current();
      if (error && !["409", "Duplicate"].includes(String(error.statusCode ?? "")) &&
          !/already exists|duplicate/i.test(error.message)) throw new Error(error.message);
    }
    current();
    const result = await supportCall<SupportReport>(client, "support_report_submit", {p_id: draft.id, p_path: path});
    current(); return result;
  }
}

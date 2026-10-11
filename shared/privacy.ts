/** Personal rights are available with a live account session, independently of dashboard MFA. */
export type PrivacyScope = "client" | "business" | "admin";
export type PrivacyKind = "access" | "rectification" | "erasure" | "restriction" | "objection" | "portability";
export type PrivacyStatus = "new" | "in_progress" | "extended" | "answered" | "refused";
export type PrivacyRequest = {
  id: string; scope: PrivacyScope; kind: PrivacyKind; description: string; status: PrivacyStatus;
  version: number; created_at: string; updated_at: string; due_at: string; original_due_at: string;
  response: string | null; extension_reason: string | null; extension_months: number;
};
export type AdminPrivacyRequest = PrivacyRequest & {requester_id: string | null; username: string | null};
export type PrivacyHistory = {action: string; status: PrivacyStatus; response: string | null; at: string; version: number};
export type AdminPrivacyDetail = AdminPrivacyRequest & {history: PrivacyHistory[]};
export const privacyKinds: Record<PrivacyKind, string> = {
  access: "Acces la date", rectification: "Corectarea datelor", erasure: "Ștergerea datelor",
  restriction: "Restricționarea prelucrării", objection: "Opoziție", portability: "Portabilitatea datelor",
};
export const privacyStatuses: Record<PrivacyStatus, string> = {
  new: "Primită", in_progress: "În analiză", extended: "Termen prelungit", answered: "Răspuns transmis", refused: "Refuz motivat",
};
export const privacyAdminAllowed = (role: string | null | undefined) => role === "fondator" || role === "admin";
export interface PrivacyClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{data: unknown; error: {message: string} | null}>;
}
export async function privacyCall<T>(client: PrivacyClient, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const {data, error} = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export type PrivacyInput = {scope: PrivacyScope; kind: PrivacyKind; description: string; key: string};
export function submitPrivacyRequest(client: PrivacyClient, input: PrivacyInput) {
  return privacyCall<PrivacyRequest>(client, "privacy_request_submit", {
    p_scope: input.scope, p_kind: input.kind, p_description: input.description.trim(), p_request_key: input.key,
  });
}
export function myPrivacyRequests(client: PrivacyClient, scope?: PrivacyScope, limit = 100, offset = 0) {
  return privacyCall<PrivacyRequest[]>(client, "privacy_my_requests", {p_scope: scope ?? null, p_limit: limit, p_offset: offset});
}
export type PrivacyExport = {
  format: "cefaci-personal-core-v1"; generated_at: string; user_id: string;
  coverage: string; profile: Record<string, unknown> | null; preferences: Record<string, unknown> | null;
  requests: PrivacyRequest[]; requests_count: number; requests_truncated: boolean;
};
/** Curated core only; a formal access/portability request covers the complete applicable record. */
export function exportMyData(client: PrivacyClient) {
  return privacyCall<PrivacyExport>(client, "privacy_export_my_data");
}

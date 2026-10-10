import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { Platform } from "react-native";
import { backend } from "./backend";

export type ClaimVenue = { id: string; name: string; address: string; city: string; claimed: boolean };
export type RequestKind = "claim" | "new" | "dispute";
export type RequestDetails = {
  requester_name: string; requester_role: string; firm: string; cui: string; phone: string;
  venue_name?: string; address?: string; city?: string; category?: string;
};
export type PartnerRequest = {
  id: string; kind: RequestKind; status: string; venue_id: string | null; venue_name: string;
  details: RequestDetails; created_at: string; decision_note?: string | null; review_note?: string | null;
  owner_response_deadline?: string | null;
};
export type Proof = { name: string; bytes: ArrayBuffer; contentType: string; extension: string };
export const MAX_PROOF_BYTES = 8 * 1024 * 1024;

export function identifyProof(bytes: ArrayBuffer): Pick<Proof, "contentType" | "extension"> {
  if (!bytes.byteLength || bytes.byteLength > MAX_PROOF_BYTES)
    throw new Error("Documentul trebuie să aibă cel mult 8 MB și să nu fie gol.");
  const b = new Uint8Array(bytes);
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d)
    return { contentType: "application/pdf", extension: "pdf" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { contentType: "image/jpeg", extension: "jpg" };
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v))
    return { contentType: "image/png", extension: "png" };
  throw new Error("Alege un document PDF sau o imagine JPEG/PNG. Tipul fișierului nu este recunoscut.");
}

export async function chooseProof(): Promise<Proof | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/jpeg", "image/png"], multiple: false, copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  const size = asset.size ?? asset.file?.size;
  if (size != null && size > MAX_PROOF_BYTES) {
    if (Platform.OS !== "web") { try { new ExpoFile(asset.uri).delete(); } catch { /* Picker cache cleanup is best effort. */ } }
    throw new Error("Documentul trebuie să aibă cel mult 8 MB.");
  }
  const bytes = Platform.OS === "web" && asset.file
    ? await asset.file.arrayBuffer()
    : await readNativeProof(asset.uri);
  return { name: asset.name, bytes, ...identifyProof(bytes) };
}

async function readNativeProof(uri: string): Promise<ArrayBuffer> {
  const file = new ExpoFile(uri);
  try {
    if (file.size > MAX_PROOF_BYTES) throw new Error("Documentul trebuie să aibă cel mult 8 MB.");
    return await file.arrayBuffer();
  }
  finally { try { file.delete(); } catch { /* Temporary picker copies may already have been removed. */ } }
}

export async function uploadProof(userId: string, requestId: string, proof: Proof): Promise<string> {
  const path = `${userId}/${requestId}/proof.${proof.extension}`;
  const { error } = await backend.storage.from("business-proofs").upload(path, proof.bytes, {
    contentType: proof.contentType, upsert: false,
  });
  if (error && !["409", "Duplicate"].includes(String((error as { statusCode?: string }).statusCode ?? "")) && !/already exists|duplicate/i.test(error.message)) throw error;
  return path;
}

export function requestKey(): string {
  return `business-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

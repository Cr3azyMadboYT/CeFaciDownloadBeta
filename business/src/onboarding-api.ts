import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { Image, Platform } from "react-native";
import {SaveFormat, manipulateAsync} from 'expo-image-manipulator';
import {photoBytes} from '../../shared/support-photo';
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
export const MAX_PROOF_FILES = 5;
export const MAX_PROOF_TOTAL_BYTES = 20 * 1024 * 1024;
export type ProofFile = {index: number; name: string; content_type: string; size: number; path: string};

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
  return (await chooseProofs(1))[0] ?? null;
}
export async function chooseProofs(limit = MAX_PROOF_FILES): Promise<Proof[]> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/jpeg", "image/png"], multiple: limit > 1, copyToCacheDirectory: true,
  });
  if (picked.canceled) return [];
  if (picked.assets.length > limit) {
    if (Platform.OS !== 'web') for (const asset of picked.assets) {try {new ExpoFile(asset.uri).delete();} catch { /* Picker cache. */ }}
    throw new Error(`Poți atașa cel mult ${MAX_PROOF_FILES} fișiere în același dosar.`);
  }
  const result: Proof[] = [];
  try {
    for (const asset of picked.assets) {
      const size = asset.size ?? asset.file?.size;
      if (size != null && size > MAX_PROOF_BYTES) throw new Error("Documentul trebuie să aibă cel mult 8 MB.");
      const raw = Platform.OS === "web" && asset.file ? await asset.file.arrayBuffer() : await new ExpoFile(asset.uri).arrayBuffer();
      const type = identifyProof(raw);
      const name = asset.name.replace(/[\x00-\x1f\x7f]/g, '').trim() || 'Document';
      if (type.extension === 'pdf') {
        if (raw.byteLength < 12 || !new TextDecoder().decode(new Uint8Array(raw).slice(-1024)).includes('%%EOF'))
          throw new Error('Documentul PDF pare incomplet. Alege fișierul original.');
        result.push({name: name.slice(0,146).replace(/[.]pdf$/i,'')+'.pdf', bytes: raw, ...type});
      } else {
        let held = '';
        try {
          const uri = Platform.OS === 'web' ? (held = URL.createObjectURL(new Blob([raw], {type: type.contentType}))) : asset.uri;
          const dimensions = await new Promise<{width:number;height:number}>((resolve,reject)=>Image.getSize(uri,(width,height)=>resolve({width,height}),reject));
          if (!dimensions.width || !dimensions.height || dimensions.width*dimensions.height>64_000_000)
            throw new Error('Imaginea este prea mare. Alege o copie de cel mult 64 megapixeli.');
          const actions = Math.max(dimensions.width,dimensions.height)>2048 ? [{resize: dimensions.width >= dimensions.height ? {width:2048} : {height:2048}}] : [];
          const prepared = await manipulateAsync(uri,actions,{format:SaveFormat.JPEG,compress:0.85,base64:true});
          if (!prepared.base64) throw new Error('Nu am putut pregăti poza. Alege alta.');
          const bytes = photoBytes(prepared.base64);
          result.push({name: name.replace(/\.[^.]+$/,'').slice(0,146)+'.jpg', bytes, contentType:'image/jpeg', extension:'jpg'});
        } finally {if (held) URL.revokeObjectURL(held);}
      }
    }
    if (result.reduce((sum,p)=>sum+p.bytes.byteLength,0)>MAX_PROOF_TOTAL_BYTES)
      throw new Error('Fișierele din dosar pot avea cel mult 20 MB împreună.');
    return result;
  } finally {
    if (Platform.OS !== 'web') for (const asset of picked.assets) {
      try {new ExpoFile(asset.uri).delete();} catch { /* Only temporary copies created by the picker. */ }
    }
  }
}

export async function uploadProof(userId: string, requestId: string, proof: Proof, index = 1): Promise<string> {
  const path = `${userId}/${requestId}/proof${index === 1 ? '' : '-'+index}.${proof.extension}`;
  const { error } = await backend.storage.from("business-proofs").upload(path, proof.bytes, {
    contentType: proof.contentType, upsert: false,
  });
  if (error && !["409", "Duplicate"].includes(String((error as { statusCode?: string }).statusCode ?? "")) && !/already exists|duplicate/i.test(error.message)) throw error;
  return path;
}

export function requestKey(): string {
  return `business-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

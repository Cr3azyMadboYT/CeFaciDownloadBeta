import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SaveFormat, manipulateAsync } from "expo-image-manipulator";
import { photoBytes } from "../../shared/support-photo";
import { backend } from "./backend";
import type { Entry } from "../../shared/entries";

/**
 * Poza notei pentru „citeste-bon”: camera pe telefon, alegerea unei poze pe web (sau dacă nu e voie la cameră).
 * Întoarce JPEG base64 (max 1600 px, cel mult 5 MB) sau null dacă omul a renunțat.
 */
export async function takeReceiptPhoto(): Promise<string | null> {
  let chosen: ImagePicker.ImagePickerResult;
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: false };
  if (Platform.OS === "web") chosen = await ImagePicker.launchImageLibraryAsync(options);
  else {
    const permission = await ImagePicker.requestCameraPermissionsAsync().catch(() => null);
    chosen = permission?.granted
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  }
  if (chosen.canceled || !chosen.assets[0]) return null;
  try {
    const asset = chosen.assets[0];
    const actions = Math.max(asset.width, asset.height) > 1600
      ? [{ resize: asset.width >= asset.height ? { width: 1600 } : { height: 1600 } }] : [];
    const image = await manipulateAsync(asset.uri, actions, { compress: 0.8, format: SaveFormat.JPEG, base64: true });
    if (!image.base64) throw new Error();
    photoBytes(image.base64); // verifică mărimea și că e chiar JPEG
    return image.base64;
  } catch (error) {
    if (error instanceof Error && /^Poza/.test(error.message)) throw error;
    throw new Error("Nu am putut pregăti poza notei. Încearcă din nou.");
  }
}

export interface ReceiptRead {
  bon: { cui: string | null; date: string | null; time: string | null; total: number | null; number: string | null };
  receipt: { ok: boolean; visit: string; duplicate: boolean };
  entry: Entry;
}

/** Trimite poza la „citeste-bon” ca ospătar (staff: true). Mesajul de eroare al serverului ajunge la om. */
export async function readReceipt(body: { image: string; venue: string; day: string; visit: string }): Promise<ReceiptRead> {
  const { data, error } = await backend.functions.invoke("citeste-bon", { body: { ...body, staff: true } });
  if (error) {
    let message = "";
    const context = (error as { context?: unknown }).context;
    if (context && typeof (context as Response).json === "function") {
      try {
        const payload = await (context as Response).clone().json();
        if (payload && typeof payload.error === "string") message = payload.error;
      } catch { /* răspunsul nu e JSON */ }
    }
    throw new Error(message || "Nu am putut citi bonul. Încearcă din nou sau scrie totalul.");
  }
  if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string")
    throw new Error((data as { error: string }).error);
  return data as ReceiptRead;
}

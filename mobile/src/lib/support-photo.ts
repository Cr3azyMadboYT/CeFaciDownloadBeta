import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { photoBytes, type SupportPhoto } from '../../../shared/support-photo';

export async function chooseSupportPhoto(): Promise<SupportPhoto | null> {
  // The system picker grants access only to the selected photo; no full gallery permission is requested.
  try {
    const chosen = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (chosen.canceled || !chosen.assets[0]) return null;
    const asset = chosen.assets[0];
    const size = Math.max(asset.width, asset.height);
    const actions = size > 1600 ? [{resize: asset.width >= asset.height ? {width: 1600} : {height: 1600}}] : [];
    const image = await manipulateAsync(asset.uri, actions, {compress: 0.8, format: SaveFormat.JPEG, base64: true});
    if (!image.base64) throw new Error('Nu am putut pregăti poza. Alege alta.');
    return {bytes: photoBytes(image.base64), contentType: 'image/jpeg', uri: image.uri};
  } catch (error) {
    if (error instanceof Error && /^(Poza|Nu am|Alege)/.test(error.message)) throw error;
    throw new Error("Nu am putut pregăti poza. Alege o imagine JPEG sau PNG validă.");
  }
}

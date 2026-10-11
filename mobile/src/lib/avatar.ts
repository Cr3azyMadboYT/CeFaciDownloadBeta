// Your profile photo: taken or picked, cropped square, shrunk to 256 px and kept with the saved state
// (so it survives reinstalling, with an account). Friends will see it once photos get their own storage.
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { setBoard } from './session';

export async function pickAvatar(from: 'camera' | 'gallery'): Promise<string | null> {
  if (from === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return 'Pentru poză avem nevoie de cameră.';
  // System picker: selected image only, without requesting access to the whole gallery.
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 0.9, exif: false };
  const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  try {
    const image = res.assets[0], side = Math.min(image.width, image.height);
    const small = await manipulateAsync(image.uri, [
      { crop: { originX: Math.floor((image.width - side) / 2), originY: Math.floor((image.height - side) / 2), width: side, height: side } },
      { resize: { width: 256, height: 256 } },
    ], { compress: 0.72, format: SaveFormat.JPEG, base64: true });
    if (!small.base64) return 'Nu am putut pregăti poza. Încearcă alta.';
    setBoard({ avatar: 'data:image/jpeg;base64,' + small.base64 });
    return null;
  } catch {
    return 'Nu am putut pregăti poza. Încearcă alta.';
  }
}
export const removeAvatar = () => setBoard({ avatar: undefined });

// The phone's code for the free Plus week (once per phone, Cornel 06.10). Android: ANDROID_ID, the same after a
// reinstall (it changes only with a factory reset); iOS: the vendor id. Only a sha256 of it leaves the phone.
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export async function phoneCode(): Promise<string | null> {
  let id: string | null = null;
  if (Platform.OS === 'android') id = Application.getAndroidId();
  else if (Platform.OS === 'ios') id = await Application.getIosIdForVendorAsync();
  if (!id) return null;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, 'cefaci:' + id);
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';
import {browserRememberedAuth} from '../../shared/remembered-web-auth';
import {createEncryptedAuthStorage} from '../../shared/security-storage';

const options = {keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
// Supabase JWTs can exceed the OS keychain item size. Commit the manifest last,
// so readers never obtain a partially written session.
export const rememberedAuth=Platform.OS==='web'?browserRememberedAuth('cefaci-business-auth','business'):null;
export const authStorage = rememberedAuth ?? createEncryptedAuthStorage({
  getItem: key => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  removeItem: key => SecureStore.deleteItemAsync(key, options),
}, key => AsyncStorage.removeItem(key));

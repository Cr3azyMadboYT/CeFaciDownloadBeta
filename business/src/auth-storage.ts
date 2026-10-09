import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';
import {createEncryptedAuthStorage} from '../../shared/security-storage';

const options = {keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
// Supabase JWTs can exceed the OS keychain item size. Commit the manifest last,
// so readers never obtain a partially written session.
export const authStorage = Platform.OS === 'web' ? {
  getItem: async (key: string) => {window.localStorage.removeItem(key); return window.sessionStorage.getItem(key);},
  setItem: async (key: string, value: string) => {window.localStorage.removeItem(key); window.sessionStorage.setItem(key, value);},
  removeItem: async (key: string) => {window.localStorage.removeItem(key); window.sessionStorage.removeItem(key);},
} : createEncryptedAuthStorage({
  getItem: key => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  removeItem: key => SecureStore.deleteItemAsync(key, options),
}, key => AsyncStorage.removeItem(key));

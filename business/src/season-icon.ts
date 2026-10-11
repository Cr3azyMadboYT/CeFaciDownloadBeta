import {AppState, Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo-modules-core';
import {watchSeasonalIcon, type IconNative} from '../../shared/seasonal-icon';
export function watchBusinessIcon() {
  return watchSeasonalIcon({native: requireOptionalNativeModule<IconNative>('CefaciBusinessIcon'), platform: Platform.OS, appState: AppState});
}

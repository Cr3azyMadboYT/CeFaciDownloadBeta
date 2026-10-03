// The Android (and later iOS) app: the same screens, inside a native shell with Google sign-in, location and notifications.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ro.cefaci.app',
  appName: 'CeFaci',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: {
    SocialLogin: { google: true, apple: false, facebook: false, twitter: false },
  },
};

export default config;

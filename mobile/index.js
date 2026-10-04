// The app's entry: the phone's storage (SQLite localStorage) and the saved state come first, before any screen or
// shared module is loaded — so the app opens straight on Acasă for someone already signed up, without waiting for the
// server. Then Expo Router.
import './src/lib/boot';
import 'expo-router/entry';

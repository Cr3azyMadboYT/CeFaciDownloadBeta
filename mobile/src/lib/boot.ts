// Runs first: gives the phone a real, synchronous localStorage (SQLite underneath) before the shared code loads,
// so ../src/app/bridge.ts and cloud.ts work the same on the phone as in the tests.
import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';
import './e2e';

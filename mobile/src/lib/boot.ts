// Runs first: gives the phone a real, synchronous localStorage (SQLite underneath) before the shared code loads,
// so ../src/app/bridge.ts and cloud.ts work the same on the phone as in the tests.
import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';
import './e2e';
// the language before any module builds its texts (src/i18n): the saved choice, else the phone's
import { setLang } from '../../../src/i18n';
import { firstLang } from './e2e';
try { const b = JSON.parse(localStorage.getItem('cefaci.state') || '{}'); setLang(b.lang === 'en' || b.lang === 'ro' ? b.lang : firstLang()); } catch { setLang(firstLang()); }

// The test build (EXPO_PUBLIC_E2E=1), made only by the emulator check on GitHub (.github/workflows/emulator.yml):
// it starts already signed up, as someone from the centre, so the screens behind the sign-in (Acasă, the bottom bar,
// Creează plan) can be photographed on a real Android. The APK people install never has it.
import { APP } from '../../../src/app/bridge';

export const E2E = process.env.EXPO_PUBLIC_E2E === '1';

if (E2E) {
  try {
    if (localStorage.getItem('cefaci.onboarded') !== '1') {
      APP.savePrefs({ zone: 'centru', likes: ['food', 'party'], dist: '20', moves: ['walk', 'car'], name: 'Test', user: 'test_e2e', birth: '1998-05-05', budget: '100', who: 'group', when: ['eve'], mood: 'mix' } as never);
      localStorage.setItem('cefaci.state', JSON.stringify({ tut: { on: false, done: true, step: 0 }, plus: 'locked', welcomeXp: true, xp: 150 }));
      localStorage.setItem('cefaci.onboarded', '1');
    }
  } catch { /* storage blocked */ }
}

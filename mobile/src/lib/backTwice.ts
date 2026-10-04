// On Acasă, "Înapoi" must be pressed twice to leave the app (decision Cornel, 04.10): the first press only says so.
import { useCallback, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { toast } from './toast';

export function useBackTwiceToExit() {
  const last = useRef(0);
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const now = Date.now();
      if (now - last.current < 2000) { BackHandler.exitApp(); return true; }
      last.current = now;
      toast('Apasă încă o dată „Înapoi” ca să ieși.');
      return true;
    });
    return () => sub.remove();
  }, []));
}

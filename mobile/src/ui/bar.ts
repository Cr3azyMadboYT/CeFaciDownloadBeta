// Light status-bar icons (clock, battery) while a dark screen is in front; back to the theme's default after.
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useTheme } from './theme';

export function useLightBar(on = true) {
  const { t } = useTheme();
  useFocusEffect(useCallback(() => {
    setStatusBarStyle(on || t.dark ? 'light' : 'dark', true);
    return () => setStatusBarStyle(t.dark ? 'light' : 'dark', true);
  }, [on, t.dark]));
}

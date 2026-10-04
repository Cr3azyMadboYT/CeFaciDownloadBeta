// "Mai puține animații": the phone's own setting (reduce motion) or the switch in Setări. Bilu then stands still.
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useApp } from './session';

export function useCalm() {
  const mine = useApp((s) => !!s.board.calm);
  const [sys, setSys] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSys).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSys);
    return () => sub.remove();
  }, []);
  return mine || sys;
}

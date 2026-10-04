import { useRef, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { setRect } from '../lib/tour';

/** Marks a part of the screen Bilu's tour can point at. */
export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: ViewStyle }) {
  const ref = useRef<View>(null);
  const measure = () => ref.current?.measureInWindow((x, y, w, h) => { if (w && h) setRect(id, { x, y, w, h }); });
  return <View ref={ref} collapsable={false} style={style} onLayout={() => setTimeout(measure, 50)}>{children}</View>;
}

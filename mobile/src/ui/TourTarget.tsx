import { useEffect, useRef, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { setRect, useTour } from '../lib/tour';

/** Marks a part of the screen Bilu's tour can point at. Measured again at every step of the tour: the bottom bar
 *  moves up after its first layout (above the phone's buttons) without its tabs being laid out again, so a place
 *  measured once would light up the wrong spot (under the Plus icon instead of on it). */
export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: ViewStyle }) {
  const ref = useRef<View>(null);
  const tour = useTour();
  const measure = () => ref.current?.measureInWindow((x, y, w, h) => { if (w && h) setRect(id, { x, y, w, h }); });
  useEffect(() => {
    if (!tour.on) return;
    const a = setTimeout(measure, 60);
    const b = setTimeout(measure, 450); // after the tab bar settles
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [tour.on, tour.step]); // eslint-disable-line react-hooks/exhaustive-deps
  return <View ref={ref} collapsable={false} style={style} onLayout={() => setTimeout(measure, 50)}>{children}</View>;
}

import { useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';

/** A dashed line (Android can't dash a single border side). */
export function Dashed({ vertical, color, style }: { vertical?: boolean; color: string; style?: ViewStyle }) {
  const [len, setLen] = useState(0);
  return (
    <View style={[vertical ? { width: 2, alignSelf: 'stretch' } : { height: 2 }, style]} onLayout={(e) => setLen(vertical ? e.nativeEvent.layout.height : e.nativeEvent.layout.width)}>
      {len ? (
        <Svg width={vertical ? 2 : len} height={vertical ? len : 2}>
          <Line x1={vertical ? 1 : 0} y1={vertical ? 0 : 1} x2={vertical ? 1 : len} y2={vertical ? len : 1} stroke={color} strokeWidth={2} strokeDasharray="5 5" />
        </Svg>
      ) : null}
    </View>
  );
}

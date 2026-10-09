import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { usePalette } from "../theme/ThemeProvider";

type Props = {
  children?: ReactNode;
  radius?: number;
  padding?: number;
  /** Fill colour inside the edge; defaults to the theme surface. */
  fill?: string;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
};

/**
 * A surface with a 1 px gradient edge that catches light at the top-left —
 * the signature Onyx detail.
 */
export function EdgeCard({ children, radius = 22, padding = 16, fill, style, innerStyle }: Props) {
  const palette = usePalette();
  return (
    <LinearGradient
      colors={[palette.edgeFrom, palette.edgeMid, palette.edgeMid, palette.edgeTo]}
      locations={[0, 0.36, 0.64, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: radius, padding: 1 }, style]}
    >
      <View
        style={[
          { borderRadius: radius - 1, backgroundColor: fill ?? palette.surface, padding },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

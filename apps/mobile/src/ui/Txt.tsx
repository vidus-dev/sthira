import { Text, type TextProps, type TextStyle } from "react-native";
import { usePalette } from "../theme/ThemeProvider";
import { fonts, type Palette } from "../theme/tokens";

export type TxtVariant =
  | "display"
  | "hero"
  | "title"
  | "section"
  | "body"
  | "bodyMedium"
  | "label"
  | "caption"
  | "tag"
  | "mono";

export type Tone = "text" | "muted" | "faint" | "due" | "positive" | "negative" | "inverse";

const VARIANTS: Record<TxtVariant, TextStyle> = {
  display: { fontFamily: fonts.light, fontSize: 58, letterSpacing: -2.4 },
  hero: { fontFamily: fonts.light, fontSize: 44, letterSpacing: -1.6 },
  title: { fontFamily: fonts.semibold, fontSize: 28, letterSpacing: -0.7 },
  section: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.15 },
  body: { fontFamily: fonts.regular, fontSize: 15 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15 },
  label: { fontFamily: fonts.regular, fontSize: 13 },
  caption: { fontFamily: fonts.regular, fontSize: 12 },
  tag: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 0.9, textTransform: "uppercase" },
  mono: { fontFamily: fonts.mono, fontSize: 12 },
};

const DEFAULT_TONE: Partial<Record<TxtVariant, Tone>> = {
  label: "muted",
  caption: "muted",
  tag: "muted",
  mono: "muted",
};

export function toneColor(palette: Palette, tone: Tone): string {
  switch (tone) {
    case "muted":
      return palette.textMuted;
    case "faint":
      return palette.textFaint;
    case "due":
      return palette.due;
    case "positive":
      return palette.positive;
    case "negative":
      return palette.negative;
    case "inverse":
      return palette.inverseText;
    default:
      return palette.text;
  }
}

export type TxtProps = TextProps & {
  variant?: TxtVariant;
  tone?: Tone;
  color?: string;
  size?: number;
  tabular?: boolean;
};

export function Txt({ variant = "body", tone, color, size, tabular, style, ...rest }: TxtProps) {
  const palette = usePalette();
  const resolved = color ?? toneColor(palette, tone ?? DEFAULT_TONE[variant] ?? "text");
  return (
    <Text
      allowFontScaling={variant !== "display" && variant !== "hero"}
      {...rest}
      style={[
        VARIANTS[variant],
        { color: resolved },
        size !== undefined && { fontSize: size },
        tabular && { fontVariant: ["tabular-nums"] },
        style,
      ]}
    />
  );
}

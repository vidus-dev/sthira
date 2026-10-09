import { Text, type TextStyle } from "react-native";
import { splitMoney, toNumber } from "../core/format/money";
import { usePalette } from "../theme/ThemeProvider";
import { fonts } from "../theme/tokens";
import { toneColor, type Tone } from "./Txt";

type Props = {
  value: string | number | null | undefined;
  size?: number;
  weight?: "light" | "regular" | "medium" | "semibold";
  tone?: Tone;
  /** Show paise (".00") dimmed. */
  paise?: boolean;
  /** Prefix "+" for positive amounts (negative always shows "−"). */
  signed?: boolean;
  /** Treat as an outflow: show "−" in front of positive numbers. */
  outflow?: boolean;
  style?: TextStyle;
};

/** An amount with the ₹ and paise smaller and dimmer than the rupees — the Onyx way. */
export function Money({
  value,
  size = 15,
  weight = "regular",
  tone = "text",
  paise = false,
  signed = false,
  outflow = false,
  style,
}: Props) {
  const palette = usePalette();
  const n = toNumber(value);
  const parts = splitMoney(outflow ? -Math.abs(n) : n, paise);
  const big = size >= 28;
  const minorSize = big ? Math.round(size * 0.52) : size;
  const sign = parts.negative ? "−" : signed && n > 0 ? "+" : "";
  const color = toneColor(palette, tone);
  const family = fonts[weight];

  return (
    <Text
      allowFontScaling={!big}
      style={[
        {
          fontFamily: family,
          fontSize: size,
          color,
          fontVariant: ["tabular-nums"],
          letterSpacing: big ? -size * 0.04 : 0,
        },
        style,
      ]}
    >
      {sign ? <Text style={{ fontSize: minorSize }}>{sign}</Text> : null}
      <Text style={{ fontSize: minorSize, color: big ? palette.textMuted : color }}>
        {big ? "₹ " : "₹"}
      </Text>
      {parts.rupees}
      {paise ? (
        <Text style={{ fontSize: minorSize, color: big ? palette.textFaint : palette.textMuted }}>
          .{parts.paise}
        </Text>
      ) : null}
    </Text>
  );
}

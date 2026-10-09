import { memo, useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { splitMoney } from "../core/format/money";
import { usePalette } from "../theme/ThemeProvider";
import { fonts } from "../theme/tokens";

const DIGITS = "01234567890123456789".split("");

type DigitProps = { digit: number; size: number; lineHeight: number; delay: number; color: string };

const Digit = memo(function Digit({ digit, size, lineHeight, delay, color }: DigitProps) {
  const reduce = useReducedMotion();
  const y = useSharedValue(reduce ? -(10 + digit) * lineHeight : 0);

  useEffect(() => {
    const target = -(10 + digit) * lineHeight;
    y.value = reduce
      ? target
      : withDelay(delay, withTiming(target, { duration: 1700, easing: Easing.out(Easing.exp) }));
  }, [digit, delay, lineHeight, reduce, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={{ height: lineHeight, overflow: "hidden" }}>
      <Animated.View style={style}>
        {DIGITS.map((d, i) => (
          <Text
            key={i}
            allowFontScaling={false}
            style={{
              height: lineHeight,
              lineHeight,
              fontSize: size,
              fontFamily: fonts.light,
              color,
              fontVariant: ["tabular-nums"],
              letterSpacing: -size * 0.04,
              includeFontPadding: false,
            }}
          >
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
});

/**
 * The balance rolls into place digit by digit, like a mechanical counter, and rolls
 * between values when it changes.
 */
export function Odometer({ value, size = 60 }: { value: number; size?: number }) {
  const palette = usePalette();
  const { negative, rupees, paise } = splitMoney(value, true);
  const lineHeight = Math.round(size * 1.12);
  const minor = Math.round(size * 0.5);
  const minorStyle = {
    fontSize: minor,
    fontFamily: fonts.light,
    includeFontPadding: false,
    marginBottom: Math.round(size * 0.13),
  } as const;

  let digitIndex = 0;
  return (
    <View accessible accessibilityLabel={`${negative ? "minus " : ""}${rupees} rupees`} style={{ flexDirection: "row", alignItems: "flex-end" }}>
      <Text allowFontScaling={false} style={[minorStyle, { color: palette.textMuted, marginRight: 6 }]}>
        {negative ? "−₹" : "₹"}
      </Text>
      {rupees.split("").map((ch, i) =>
        ch === "," ? (
          <Text
            key={`c${i}`}
            allowFontScaling={false}
            style={{
              height: lineHeight,
              lineHeight,
              fontSize: size,
              fontFamily: fonts.light,
              color: palette.text,
              letterSpacing: -size * 0.04,
              includeFontPadding: false,
            }}
          >
            ,
          </Text>
        ) : (
          <Digit
            key={`d${i}`}
            digit={Number(ch)}
            size={size}
            lineHeight={lineHeight}
            delay={250 + (digitIndex++) * 60}
            color={palette.text}
          />
        )
      )}
      <Text allowFontScaling={false} style={[minorStyle, { color: palette.textFaint }]}>
        .{paise}
      </Text>
    </View>
  );
}

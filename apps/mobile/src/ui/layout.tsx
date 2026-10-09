import { useEffect, type ReactNode } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { usePalette } from "../theme/ThemeProvider";
import { GUTTER } from "../theme/tokens";
import { Icon } from "./Icon";
import { Txt } from "./Txt";

/** Space the floating tab bar takes at the bottom of tab screens. */
export const TAB_BAR_SPACE = 132;

/** Sections rise into place, staggered, ease-out-expo. Honors "reduce motion". */
export function Rise({
  delay = 0,
  children,
  style,
}: {
  delay?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={
        // The browser preview mis-renders these entrance keyframes; phones get the real thing.
        Platform.OS === "web"
          ? undefined
          : FadeInDown.duration(750)
              .delay(delay)
              .easing(Easing.out(Easing.exp))
              .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] })
      }
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** A soft light falling on the top of the screen (monochrome, never coloured). */
function TopGlow() {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: -260, left: -80, right: -80, height: 560 }}>
      <Svg width={width + 160} height={560}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="45%" rx="62%" ry="50%">
            <Stop offset="0" stopColor={palette.scheme === "dark" ? "#FFFFFF" : "#000000"} stopOpacity={palette.scheme === "dark" ? 0.075 : 0.035} />
            <Stop offset="1" stopColor={palette.scheme === "dark" ? "#FFFFFF" : "#000000"} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={(width + 160) / 2} cy={252} rx={width} ry={280} fill="url(#glow)" />
      </Svg>
    </View>
  );
}

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Leave room for the floating tab bar. */
  withTabBar?: boolean;
  glow?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  withTabBar = false,
  glow = true,
  contentStyle,
}: ScreenProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + 14,
    paddingBottom: (withTabBar ? TAB_BAR_SPACE : 32) + insets.bottom,
  };
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {glow ? <TopGlow /> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={palette.textMuted}
                colors={[palette.text]}
                progressBackgroundColor={palette.surfaceRaised}
                progressViewOffset={insets.top}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

/** Small uppercase mono label with an optional value on the right ("DUE   3"). */
export function SectionLabel({ label, right, style }: { label: string; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: GUTTER }, style]}>
      <Txt variant="tag" style={{ letterSpacing: 1.2 }}>
        {label}
      </Txt>
      {typeof right === "string" ? <Txt variant="tag">{right}</Txt> : right}
    </View>
  );
}

export function Hairline({ inset = 0, style }: { inset?: number; style?: StyleProp<ViewStyle> }) {
  const palette = usePalette();
  return <View style={[{ height: 1, backgroundColor: palette.hairline, marginLeft: inset }, style]} />;
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 32, gap: 10 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: palette.iconBorder,
          backgroundColor: palette.iconBg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
        }}
      >
        <Icon name={icon} size={22} color={palette.textMuted} />
      </View>
      <Txt variant="bodyMedium" style={{ textAlign: "center" }}>
        {title}
      </Txt>
      {body ? (
        <Txt variant="label" style={{ textAlign: "center", lineHeight: 19 }}>
          {body}
        </Txt>
      ) : null}
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}

/** Loading placeholder that breathes instead of spinning. */
export function Skeleton({ width, height, radius = 8, style }: { width: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const palette = usePalette();
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [o]);
  const animated = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: palette.surfaceRaised }, animated, style]}
    />
  );
}

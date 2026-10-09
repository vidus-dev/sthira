import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { usePalette } from "../theme/ThemeProvider";
import { Txt } from "./Txt";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE_OUT = Easing.out(Easing.exp);

function useDraw(delay: number, duration = 1600) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }));
  }, [delay, duration, p, reduce]);
  return p;
}

function polyLength(points: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return Math.max(total, 1);
}

const toPath = (pts: [number, number][]) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

// --- Spending pace -----------------------------------------------------------------------

type PaceProps = {
  width: number;
  height?: number;
  /** Cumulative spend for days 1..today of this month. */
  current: number[];
  /** Cumulative spend for every day of last month. */
  previous: number[];
  daysInMonth: number;
  /** Projected month-end total (dotted line from today). */
  forecast?: number | null;
  todayLabel?: string;
};

/** This month (solid) vs last month (dashed) with a forecast to month end (dotted + cone). */
export function PaceChart({ width, height = 112, current, previous, daysInMonth, forecast, todayLabel }: PaceProps) {
  const palette = usePalette();
  const draw = useDraw(500);
  const ping = useSharedValue(0);
  const reduce = useReducedMotion();

  const geo = useMemo(() => {
    const maxV = Math.max(1, ...current, ...previous, forecast ?? 0) * 1.08;
    const x = (day: number) => ((day - 1) / Math.max(1, daysInMonth - 1)) * width;
    const y = (v: number) => height - 2 - (v / maxV) * (height - 14);
    const cur = current.map((v, i) => [x(i + 1), y(v)] as [number, number]);
    const prev = previous.map((v, i) => [Math.min(width, x(i + 1)), y(v)] as [number, number]);
    const last = cur[cur.length - 1] ?? [0, y(0)];
    return {
      cur,
      prev,
      last,
      curLen: polyLength(cur),
      area: cur.length > 1 ? `${toPath(cur)} L${last[0].toFixed(1)} ${height} L0 ${height} Z` : "",
      forecastEnd: forecast != null && cur.length ? ([width, y(forecast)] as [number, number]) : null,
      cone:
        forecast != null && cur.length
          ? `M${last[0]} ${last[1]} L${width} ${y(forecast * 1.08)} L${width} ${y(forecast * 0.92)} Z`
          : null,
      grid: [0.25, 0.5, 0.75].map((f) => Math.round(height * f) + 0.5),
    };
  }, [current, previous, daysInMonth, forecast, width, height]);

  useEffect(() => {
    if (reduce) return;
    ping.value = withDelay(
      2200,
      withRepeat(withSequence(withTiming(1, { duration: 1600, easing: EASE_OUT }), withTiming(0, { duration: 0 })), -1)
    );
  }, [ping, reduce]);

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: geo.curLen * (1 - draw.value) }));
  const fadeProps = useAnimatedProps(() => ({ opacity: Math.max(0, (draw.value - 0.6) / 0.4) }));
  const pingProps = useAnimatedProps(() => ({ r: 3.5 + ping.value * 8, opacity: 0.5 * (1 - ping.value) }));

  const labelLeft = Math.min(Math.max(geo.last[0] + 12, 0), width - 128);
  const labelTop = Math.max(0, geo.last[1] - 38);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={{ overflow: "visible" }}>
        <Defs>
          <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.text} stopOpacity={palette.scheme === "dark" ? 0.12 : 0.08} />
            <Stop offset="1" stopColor={palette.text} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {geo.grid.map((gy) => (
          <Line key={gy} x1={0} x2={width} y1={gy} y2={gy} stroke={palette.hairline} strokeWidth={1} />
        ))}
        <Line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke={palette.track} strokeWidth={1} />
        {geo.prev.length > 1 ? (
          <Path d={toPath(geo.prev)} fill="none" stroke={palette.scheme === "dark" ? "#3E3E3E" : "#C9C9C5"} strokeWidth={1.25} strokeDasharray="3 4" />
        ) : null}
        {geo.cone ? <AnimatedPath d={geo.cone} fill={palette.text} fillOpacity={0.045} animatedProps={fadeProps} /> : null}
        {geo.forecastEnd ? (
          <AnimatedPath
            d={`M${geo.last[0]} ${geo.last[1]} L${geo.forecastEnd[0]} ${geo.forecastEnd[1]}`}
            stroke={palette.textMuted}
            strokeWidth={1.4}
            strokeDasharray="1.5 4"
            strokeLinecap="round"
            animatedProps={fadeProps}
          />
        ) : null}
        {geo.area ? <AnimatedPath d={geo.area} fill="url(#area)" animatedProps={fadeProps} /> : null}
        {geo.cur.length > 1 ? (
          <AnimatedPath
            d={toPath(geo.cur)}
            fill="none"
            stroke={palette.text}
            strokeWidth={1.7}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={`${geo.curLen} ${geo.curLen}`}
            animatedProps={lineProps}
          />
        ) : null}
        {geo.cur.length ? (
          <G>
            <Line x1={geo.last[0]} x2={geo.last[0]} y1={geo.last[1]} y2={height} stroke={palette.track} strokeWidth={1} />
            <AnimatedCircle cx={geo.last[0]} cy={geo.last[1]} fill={palette.text} animatedProps={pingProps} />
            <Circle cx={geo.last[0]} cy={geo.last[1]} r={3.5} fill={palette.text} />
          </G>
        ) : null}
      </Svg>
      {todayLabel && geo.cur.length ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: labelLeft,
            top: labelTop,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: palette.iconBorder,
            backgroundColor: palette.surface,
          }}
        >
          <Txt variant="tag" color={palette.scheme === "dark" ? "#D6D6D6" : "#2A2A2A"} style={{ letterSpacing: 0.4 }}>
            {todayLabel}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

// --- Monthly plan dial -------------------------------------------------------------------

const TICKS = Array.from({ length: 60 }, (_, i) => i);

/** A watch bezel: 60 ticks lit up to ``progress``, with a thin inner arc that draws in. */
export function BezelDial({ size = 200, progress, children }: { size?: number; progress: number; children?: React.ReactNode }) {
  const palette = usePalette();
  const reduce = useReducedMotion();
  const draw = useDraw(500, 1800);
  const turn = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) turn.value = withDelay(150, withTiming(1, { duration: 1400, easing: EASE_OUT }));
  }, [turn, reduce]);

  const clamped = Math.max(0, Math.min(1, progress));
  const lit = Math.round(clamped * 60);
  const r = 80;
  const circ = 2 * Math.PI * r;
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - clamped * draw.value) }));
  const bezelStyle = useAnimatedStyle(() => ({
    opacity: turn.value,
    transform: [{ rotate: `${(1 - turn.value) * -40}deg` }, { scale: 0.94 + turn.value * 0.06 }],
  }));
  const dimTick = palette.scheme === "dark" ? "#272727" : "#DCDCD8";

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[{ position: "absolute", inset: 0 }, bezelStyle]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          {TICKS.map((i) => {
            const major = i % 5 === 0;
            const on = i < lit;
            return (
              <Line
                key={i}
                x1={100}
                y1={major ? 2 : 3}
                x2={100}
                y2={major ? 12 : 8}
                stroke={on ? (major ? palette.text : palette.scheme === "dark" ? "#BDBDBD" : "#4A4A4A") : dimTick}
                strokeWidth={major ? 1.8 : 1.1}
                strokeLinecap="round"
                transform={`rotate(${i * 6} 100 100)`}
              />
            );
          })}
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} viewBox="0 0 200 200" style={{ position: "absolute" }}>
        <Circle cx={100} cy={100} r={r} fill="none" stroke={palette.track} strokeWidth={2} />
        <AnimatedCircle
          cx={100}
          cy={100}
          r={r}
          fill="none"
          stroke={palette.text}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          transform="rotate(-90 100 100)"
          animatedProps={arcProps}
        />
        <Circle cx={100} cy={100} r={72} fill={palette.scheme === "dark" ? "#060606" : "#FFFFFF"} stroke={palette.hairline} />
      </Svg>
      <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>{children}</View>
    </View>
  );
}

// --- Bars --------------------------------------------------------------------------------

/** A bar that grows from the left once, after ``delay`` ms. */
export function GrowBar({ fraction, color, height = 3, delay = 400, track }: { fraction: number; color: string; height?: number; delay?: number; track?: string }) {
  const palette = usePalette();
  const reduce = useReducedMotion();
  const s = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) s.value = withDelay(delay, withTiming(1, { duration: 1100, easing: EASE_OUT }));
  }, [delay, reduce, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: s.value }] }));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track ?? palette.track, overflow: "hidden" }}>
      <Animated.View
        style={[
          { width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, height, borderRadius: height, backgroundColor: color, transformOrigin: "left" },
          style,
        ]}
      />
    </View>
  );
}

/** Segmented progress: ``filled`` of ``total`` hairline segments (e.g. 5 of 9 plan items). */
export function Segments({ filled, total }: { filled: number; total: number }) {
  const palette = usePalette();
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {Array.from({ length: Math.max(total, 1) }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < filled ? palette.text : palette.track }} />
      ))}
    </View>
  );
}

/** Tiny circular progress for rows (donations paid in parts). */
export function MiniRing({ fraction, size = 22 }: { fraction: number; size?: number }) {
  const palette = usePalette();
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={palette.track} strokeWidth={2} fill="none" />
      {fraction > 0 ? (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={palette.text}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * Math.min(1, fraction)} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ) : null}
    </Svg>
  );
}


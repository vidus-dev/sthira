import type { ReactElement } from "react";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { usePalette } from "../theme/ThemeProvider";

/**
 * One monochrome line-icon set (24-grid, round caps). Category icons use the same
 * keys the API seeds (`bowl`, `leaf`, `sparkle`, ...).
 */
const ICONS: Record<string, ReactElement> = {
  // --- navigation & actions
  home: <Path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  list: (
    <>
      <Path d="M9 6h11M9 12h11M9 18h11" />
      <Path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth={2.4} />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  calendar: (
    <>
      <Rect x={3.5} y={5} width={17} height={15.5} rx={3} />
      <Path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  plan: (
    <>
      <Rect x={3.5} y={5} width={17} height={15.5} rx={3} />
      <Path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4" />
    </>
  ),
  pie: (
    <>
      <Path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z" />
      <Path d="M15 3.9A8.5 8.5 0 0 1 20.1 9H15z" />
    </>
  ),
  search: (
    <>
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="m20 20-4.2-4.2" />
    </>
  ),
  inbox: (
    <>
      <Path d="M3.5 13.5h4.5l1.5 2.5h5l1.5-2.5h4.5" />
      <Path d="M5.5 5.5h13l2 8V19a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 19v-5.5z" />
    </>
  ),
  user: (
    <>
      <Circle cx={12} cy={8.5} r={3.6} />
      <Path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  users: (
    <>
      <Circle cx={9} cy={9} r={3.2} />
      <Path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <Path d="M15.5 6.2a3.2 3.2 0 0 1 0 5.6M17 13.6a5.5 5.5 0 0 1 3.5 5.4" />
    </>
  ),
  chevronRight: <Path d="m9.5 6 6 6-6 6" />,
  chevronLeft: <Path d="m14.5 6-6 6 6 6" />,
  chevronDown: <Path d="m6 9.5 6 6 6-6" />,
  check: <Path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <Path d="M6 6l12 12M18 6 6 18" />,
  arrowUpRight: <Path d="M7 17 17 7M9 7h8v8" />,
  arrowDownLeft: <Path d="M17 7 7 17M15 17H7V9" />,
  arrowUp: <Path d="M12 19V5M6 11l6-6 6 6" />,
  swap: <Path d="M4 8h14l-3-3M20 16H6l3 3" />,
  card: (
    <>
      <Rect x={3} y={5.5} width={18} height={13} rx={2.5} />
      <Path d="M3 10h18M7 14.5h3" />
    </>
  ),
  cash: (
    <>
      <Rect x={2.5} y={6} width={19} height={12} rx={2} />
      <Circle cx={12} cy={12} r={2.5} />
      <Path d="M6 9.5v.01M18 14.5v.01" strokeWidth={2.2} />
    </>
  ),
  wallet: (
    <>
      <Path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <Rect x={3.5} y={8} width={17} height={11.5} rx={2.5} />
      <Path d="M16 13.75h1.5" />
    </>
  ),
  trendUp: <Path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  sliders: (
    <>
      <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <Circle cx={16} cy={7} r={2} />
      <Circle cx={10} cy={17} r={2} />
    </>
  ),
  lock: (
    <>
      <Rect x={5} y={10.5} width={14} height={10} rx={2} />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  logout: (
    <>
      <Path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <Path d="M10 16l-4-4 4-4M6 12h10" />
    </>
  ),
  edit: (
    <>
      <Path d="M4 20h4L19 9l-4-4L4 16z" />
      <Path d="m13.5 6.5 4 4" />
    </>
  ),
  trash: <Path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />,
  share: (
    <>
      <Path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
      <Path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </>
  ),
  copy: (
    <>
      <Rect x={8} y={8} width={12} height={12} rx={2} />
      <Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  backspace: (
    <>
      <Path d="M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7z" />
      <Path d="m12.5 9.5 5 5M17.5 9.5l-5 5" />
    </>
  ),
  sun: (
    <>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <Path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  fingerprint: (
    <>
      <Path d="M7.5 19c1-2 1.5-4.2 1.5-7a3 3 0 0 1 6 0c0 1.5-.1 3-.4 4.4" />
      <Path d="M12 12c0 3.4-.7 6.2-2 8.5M5 15.5c.5-1.1.8-2.3.8-3.5a6.2 6.2 0 0 1 9.9-5" />
      <Path d="M18.4 8.5c.4 1 .6 2.2.6 3.5 0 2.4-.3 4.6-.9 6.5M14.4 20.5c.3-.6.5-1.2.7-1.9" />
    </>
  ),
  // --- categories
  bowl: (
    <>
      <Path d="M4 11h16a8 8 0 0 1-16 0z" />
      <Path d="M9 7.5c0-1.2.8-1.6.8-2.8M12.5 7.5c0-1.2.8-1.6.8-2.8" />
    </>
  ),
  basket: (
    <>
      <Path d="M4 9.5h16l-1.6 9a1.5 1.5 0 0 1-1.5 1.2H7.1a1.5 1.5 0 0 1-1.5-1.2z" />
      <Path d="m8.5 9.5 3-5M15.5 9.5l-3-5" />
    </>
  ),
  leaf: (
    <>
      <Path d="M6 18c0-7.5 4.8-12.5 13-12.5 0 8.2-5 13-12.5 13" />
      <Path d="M6 18l7-7" />
    </>
  ),
  fish: (
    <>
      <Path d="M2.5 12c2.6-3.6 6.2-5.5 10-5.5 3.5 0 6.4 1.9 8.5 5.5-2.1 3.6-5 5.5-8.5 5.5-3.8 0-7.4-1.9-10-5.5z" />
      <Path d="M16 11h.01" strokeWidth={2.4} />
    </>
  ),
  milk: (
    <>
      <Path d="M9 3h6M9.5 3v3L7 9.5V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5L14.5 6V3" />
      <Path d="M7 13h10" />
    </>
  ),
  utensils: (
    <>
      <Path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10" />
      <Path d="M17 3c-1.7 1-2.5 3-2.5 6s1 3.5 2.5 3.5V21" />
    </>
  ),
  wrench: <Path d="M14.7 6.3a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.7-7.7a4 4 0 0 0-2-2zM14.7 6.3 17 4" />,
  bolt: <Path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  wifi: (
    <>
      <Path d="M4.5 9.5a11 11 0 0 1 15 0M7.5 12.8a6.5 6.5 0 0 1 9 0M10.5 16a2 2 0 0 1 3 0" />
      <Path d="M12 19h.01" strokeWidth={2.6} />
    </>
  ),
  phone: (
    <>
      <Rect x={7} y={2.5} width={10} height={19} rx={2.5} />
      <Path d="M11 18.5h2" />
    </>
  ),
  bank: <Path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18" />,
  sparkle: <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  heart: <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  fuel: (
    <>
      <Rect x={4} y={4} width={10} height={16} rx={1.5} />
      <Path d="M4 10h10M14 8l3.5 2.5V17a1.5 1.5 0 0 0 3 0V9l-2.5-3" />
    </>
  ),
  car: (
    <>
      <Path d="M5 13l1.8-5a2 2 0 0 1 1.9-1.4h6.6A2 2 0 0 1 17.2 8L19 13" />
      <Rect x={3.5} y={13} width={17} height={5} rx={1.5} />
      <Path d="M6.5 18v2M17.5 18v2" />
    </>
  ),
  bag: (
    <>
      <Path d="M5 8h14l-1 12H6z" />
      <Path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  medical: (
    <>
      <Rect x={4} y={4} width={16} height={16} rx={4} />
      <Path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  film: (
    <>
      <Rect x={3.5} y={5} width={17} height={14} rx={2} />
      <Path d="M8 5v14M16 5v14M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5" />
    </>
  ),
  scissors: (
    <>
      <Circle cx={6.5} cy={7} r={2.5} />
      <Circle cx={6.5} cy={17} r={2.5} />
      <Path d="M8.5 8.5 20 18M8.5 15.5 20 6" />
    </>
  ),
  gift: (
    <>
      <Rect x={3.5} y={8.5} width={17} height={4} rx={1} />
      <Path d="M5 12.5v8h14v-8M12 8.5v12" />
      <Path d="M12 8.5C10 8.5 7.5 7.8 7.5 6a2 2 0 0 1 4-.5zM12 8.5c2 0 4.5-.7 4.5-2.5a2 2 0 0 0-4-.5z" />
    </>
  ),
  sofa: (
    <>
      <Path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" />
      <Path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z" />
      <Path d="M5 18v2M19 18v2" />
    </>
  ),
  book: (
    <>
      <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <Path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" />
    </>
  ),
  dots: <Path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={3} />,
  salary: (
    <>
      <Path d="M12 3v11M7.5 9.5 12 14l4.5-4.5" />
      <Path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </>
  ),
  coins: (
    <>
      <Ellipse cx={9} cy={7} rx={5} ry={2.5} />
      <Path d="M4 7v5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7" />
      <Path d="M10 14.4V17c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-5c0-1.4-2.2-2.5-5-2.5" />
    </>
  ),
  percent: (
    <>
      <Path d="M19 5 5 19" />
      <Circle cx={7} cy={7} r={2.2} />
      <Circle cx={17} cy={17} r={2.2} />
    </>
  ),
};

/** Icons offered when creating a category. */
export const CATEGORY_ICONS = [
  "bowl", "basket", "leaf", "fish", "milk", "utensils", "home", "wrench", "bolt", "wifi",
  "phone", "bank", "sparkle", "heart", "fuel", "car", "bag", "medical", "film", "scissors",
  "gift", "sofa", "book", "salary", "coins", "percent", "card", "cash", "dots",
] as const;

export function hasIcon(name: string): boolean {
  return name in ICONS;
}

type Props = { name: string; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 20, color, strokeWidth = 1.6 }: Props) {
  const palette = usePalette();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? palette.text}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name] ?? ICONS.dots}
    </Svg>
  );
}

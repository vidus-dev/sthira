/**
 * Onyx design tokens (see docs/newplan/02-design-system-onyx.md).
 * Monochrome first; ``due`` (champagne) and ``positive`` (soft green) are the only accents.
 */

export type Palette = {
  scheme: "dark" | "light";
  bg: string;
  surface: string;
  surfaceRaised: string;
  hairline: string;
  edgeFrom: string;
  edgeMid: string;
  edgeTo: string;
  glow: string;
  text: string;
  textMuted: string;
  textFaint: string;
  due: string;
  positive: string;
  negative: string;
  inverseBg: string;
  inverseText: string;
  iconBg: string;
  iconBorder: string;
  track: string;
  overlay: string;
};

export const dark: Palette = {
  scheme: "dark",
  bg: "#000000",
  surface: "#0A0A0B",
  surfaceRaised: "#141414",
  hairline: "#161616",
  edgeFrom: "rgba(255,255,255,0.22)",
  edgeMid: "rgba(255,255,255,0.04)",
  edgeTo: "rgba(255,255,255,0.10)",
  glow: "rgba(255,255,255,0.075)",
  text: "#F2F2F2",
  textMuted: "#7C7C7C",
  textFaint: "#4E4E4E",
  due: "#D9C7A0",
  positive: "#A6D9B8",
  negative: "#E8A598",
  inverseBg: "#F2F2F2",
  inverseText: "#000000",
  iconBg: "#0F0F10",
  iconBorder: "#1E1E1E",
  track: "#1C1C1C",
  overlay: "rgba(0,0,0,0.6)",
};

export const light: Palette = {
  scheme: "light",
  bg: "#FAFAF9",
  surface: "#FFFFFF",
  surfaceRaised: "#F0F0EE",
  hairline: "#E7E7E4",
  edgeFrom: "rgba(0,0,0,0.12)",
  edgeMid: "rgba(0,0,0,0.04)",
  edgeTo: "rgba(0,0,0,0.08)",
  glow: "rgba(0,0,0,0.035)",
  text: "#0A0A0A",
  textMuted: "#6B6B6B",
  textFaint: "#A3A3A3",
  due: "#8A6D2F",
  positive: "#2F7A4F",
  negative: "#B4462F",
  inverseBg: "#0A0A0A",
  inverseText: "#FFFFFF",
  iconBg: "#F4F4F2",
  iconBorder: "#E4E4E1",
  track: "#E9E9E6",
  overlay: "rgba(0,0,0,0.35)",
};

export const fonts = {
  light: "Geist_300Light",
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
} as const;

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

/** Page gutter. */
export const GUTTER = 20;

import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Switch,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { usePalette } from "../theme/ThemeProvider";
import { fonts, radius } from "../theme/tokens";
import { Icon } from "./Icon";
import { PressableScale } from "./PressableScale";
import { Txt } from "./Txt";

// --- Button ------------------------------------------------------------------------------

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: string;
  trailing?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const HEIGHT = { sm: 32, md: 44, lg: 56 } as const;

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  trailing,
  loading,
  disabled,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const palette = usePalette();
  const fg = variant === "primary" ? palette.inverseText : palette.text;
  const h = HEIGHT[size];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic={variant === "primary" ? "light" : "selection"}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        {
          height: h,
          borderRadius: size === "lg" ? 18 : radius.pill,
          paddingHorizontal: size === "sm" ? 13 : 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: trailing ? "space-between" : "center",
          gap: 8,
          backgroundColor: variant === "primary" ? palette.inverseBg : "transparent",
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: palette.scheme === "dark" ? "#333333" : "#D4D4D1",
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : icon ? (
          <Icon name={icon} size={size === "sm" ? 15 : 18} color={fg} strokeWidth={2} />
        ) : null}
        <Txt
          variant={size === "lg" ? "bodyMedium" : "label"}
          color={fg}
          style={{ fontFamily: variant === "primary" ? fonts.semibold : fonts.medium, fontSize: size === "lg" ? 16 : size === "sm" ? 12.5 : 14 }}
        >
          {label}
        </Txt>
      </View>
      {trailing}
    </PressableScale>
  );
}

/**
 * Looks like a small button but isn't one: for rows that are tappable as a whole (a
 * real button inside a pressable row would be a control inside a control).
 */
export function Pill({ label, variant = "primary" }: { label: string; variant?: "primary" | "outline" }) {
  const palette = usePalette();
  return (
    <View
      style={{
        height: 32,
        paddingHorizontal: 13,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: variant === "primary" ? palette.inverseBg : "transparent",
        borderWidth: variant === "outline" ? 1 : 0,
        borderColor: palette.scheme === "dark" ? "#333333" : "#D4D4D1",
      }}
    >
      <Txt
        variant="label"
        color={variant === "primary" ? palette.inverseText : palette.text}
        style={{ fontFamily: variant === "primary" ? fonts.semibold : fonts.medium, fontSize: 12.5 }}
      >
        {label}
      </Txt>
    </View>
  );
}

// --- Chip --------------------------------------------------------------------------------

export function Chip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const palette = usePalette();
  const fg = selected ? palette.inverseText : palette.scheme === "dark" ? "#D6D6D6" : "#2A2A2A";
  return (
    <PressableScale
      onPress={onPress}
      accessibilityState={{ selected }}
      style={{
        height: 36,
        paddingLeft: icon ? 11 : 14,
        paddingRight: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? palette.inverseBg : palette.scheme === "dark" ? "#262626" : "#DEDEDA",
        backgroundColor: selected ? palette.inverseBg : "transparent",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
      }}
    >
      {icon ? <Icon name={icon} size={15} color={fg} strokeWidth={1.7} /> : null}
      <Txt variant="label" color={fg} style={selected ? { fontFamily: fonts.medium } : undefined}>
        {label}
      </Txt>
    </PressableScale>
  );
}

// --- Segmented ---------------------------------------------------------------------------

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        {
          flexDirection: "row",
          height: 40,
          padding: 3,
          gap: 3,
          borderRadius: 13,
          backgroundColor: palette.surfaceRaised,
        },
        style,
      ]}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            scaleTo={0.98}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? palette.inverseBg : "transparent",
            }}
          >
            <Txt
              variant="label"
              color={active ? palette.inverseText : palette.textMuted}
              style={{ fontFamily: active ? fonts.semibold : fonts.medium }}
            >
              {o.label}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}

// --- TextField ---------------------------------------------------------------------------

type FieldProps = TextInputProps & { label?: string; hint?: string; error?: string | null };

export function TextField({ label, hint, error, style, onFocus, onBlur, ...rest }: FieldProps) {
  const palette = usePalette();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      {label ? <Txt variant="caption">{label}</Txt> : null}
      <TextInput
        placeholderTextColor={palette.textFaint}
        selectionColor={palette.text}
        cursorColor={palette.text}
        accessibilityLabel={label}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            height: 50,
            borderRadius: 14,
            paddingHorizontal: 15,
            backgroundColor: palette.surface,
            borderWidth: 1,
            borderColor: error ? palette.negative : focused ? palette.textMuted : palette.hairline,
            color: palette.text,
            fontFamily: fonts.regular,
            fontSize: 15,
          },
          style,
        ]}
      />
      {error ? (
        <Txt variant="caption" tone="negative">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="caption" tone="faint">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

// --- Toggle ------------------------------------------------------------------------------

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const palette = usePalette();
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: palette.track, true: palette.text }}
      thumbColor={value ? palette.bg : palette.textMuted}
    />
  );
}

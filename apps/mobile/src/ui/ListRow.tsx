import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { usePalette } from "../theme/ThemeProvider";
import { fonts } from "../theme/tokens";
import { Icon } from "./Icon";
import { PressableScale } from "./PressableScale";
import { Txt } from "./Txt";

export function IconCircle({ name, size = 36, dim = false }: { name: string; size?: number; dim?: boolean }) {
  const palette = usePalette();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.iconBg,
        borderWidth: 1,
        borderColor: palette.iconBorder,
        alignItems: "center",
        justifyContent: "center",
        opacity: dim ? 0.6 : 1,
      }}
    >
      <Icon
        name={name}
        size={Math.round(size * 0.46)}
        color={palette.scheme === "dark" ? "#CFCFCF" : "#3A3A3A"}
      />
    </View>
  );
}

function initials(name: string | null | undefined): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, size = 34, ring }: { name?: string | null; size?: number; ring?: string }) {
  const palette = usePalette();
  const text = initials(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.surfaceRaised,
        borderWidth: ring ? 2 : 1,
        borderColor: ring ?? palette.iconBorder,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {text ? (
        <Txt
          color={palette.scheme === "dark" ? "#BDBDBD" : "#3A3A3A"}
          size={Math.round(size * 0.36)}
          style={{ fontFamily: fonts.medium }}
        >
          {text}
        </Txt>
      ) : (
        <Icon name="user" size={Math.round(size * 0.45)} color={palette.textMuted} />
      )}
    </View>
  );
}

type RowProps = {
  icon?: string;
  leading?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  dim?: boolean;
  divider?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** The standard Onyx row: icon circle, title + muted subtitle, right-aligned value. */
export function ListRow({ icon, leading, title, subtitle, right, onPress, onLongPress, dim, divider = true, height = 64, style }: RowProps) {
  const palette = usePalette();
  const content = (
    <View
      style={[
        {
          minHeight: height,
          flexDirection: "row",
          alignItems: "center",
          gap: 13,
          borderBottomWidth: divider ? 1 : 0,
          borderBottomColor: palette.hairline,
          paddingVertical: 8,
        },
        style,
      ]}
    >
      {leading ?? (icon ? <IconCircle name={icon} dim={dim} /> : null)}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Txt variant="bodyMedium" numberOfLines={1} tone={dim ? "muted" : "text"}>
          {title}
        </Txt>
        {typeof subtitle === "string" ? (
          <Txt variant="caption" numberOfLines={1} tone={dim ? "faint" : "muted"}>
            {subtitle}
          </Txt>
        ) : (
          subtitle
        )}
      </View>
      {right}
    </View>
  );
  if (!onPress && !onLongPress) return content;
  return (
    <PressableScale onPress={onPress} onLongPress={onLongPress} scaleTo={0.985}>
      {content}
    </PressableScale>
  );
}

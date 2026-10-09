import type { ReactNode } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { usePalette } from "../theme/ThemeProvider";
import { GUTTER } from "../theme/tokens";
import { Icon } from "./Icon";
import { PressableScale } from "./PressableScale";
import { Txt } from "./Txt";

/** Back button + large title for pushed screens (Accounts, Categories, ...). */
export function StackHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const palette = usePalette();
  const nav = useNavigation();
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <PressableScale
        accessibilityLabel="Back"
        onPress={() => nav.goBack()}
        hitSlop={10}
        style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: palette.iconBorder, alignItems: "center", justifyContent: "center" }}
      >
        <Icon name="chevronLeft" size={17} color={palette.text} strokeWidth={2} />
      </PressableScale>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 18 }}>
        <View style={{ flex: 1 }}>
          <Txt variant="title">{title}</Txt>
          {subtitle ? (
            <Txt variant="label" style={{ marginTop: 4 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

import { useEffect, useRef, useState } from "react";
import { AppState, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Updates from "expo-updates";
import { usePalette } from "../../theme/ThemeProvider";
import { GUTTER } from "../../theme/tokens";
import { EdgeCard } from "../../ui/EdgeCard";
import { Icon } from "../../ui/Icon";
import { PressableScale } from "../../ui/PressableScale";
import { Txt } from "../../ui/Txt";

const CHECK_EVERY_MS = 15 * 60_000;

/**
 * When a new version has downloaded in the background, offer to restart into it now
 * instead of waiting for the next time the app is fully closed.
 */
export function UpdateBanner() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const lastCheck = useRef(0);

  // Also look for updates when the app comes back to the foreground.
  useEffect(() => {
    if (!Updates.isEnabled || Platform.OS === "web") return;
    const check = async () => {
      if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      try {
        const r = await Updates.checkForUpdateAsync();
        if (r.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        /* offline: try later */
      }
    };
    const sub = AppState.addEventListener("change", (s) => s === "active" && void check());
    return () => sub.remove();
  }, []);

  if (!Updates.isEnabled || !isUpdatePending || dismissed) return null;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: GUTTER, right: GUTTER, bottom: insets.bottom + 104 }}>
      <EdgeCard radius={18} padding={0} innerStyle={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 14, paddingRight: 8 }}>
        <Icon name="refresh" size={17} color={palette.text} />
        <Txt variant="bodyMedium" size={14} style={{ flex: 1 }}>
          Update ready
        </Txt>
        <PressableScale onPress={() => setDismissed(true)} hitSlop={8} accessibilityLabel="Later" style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
          <Txt variant="label">Later</Txt>
        </PressableScale>
        <PressableScale
          onPress={() => void Updates.reloadAsync().catch(() => {})}
          style={{ height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: palette.inverseBg, alignItems: "center", justifyContent: "center" }}
        >
          <Txt variant="label" color={palette.inverseText} style={{ fontSize: 12.5 }}>
            Restart
          </Txt>
        </PressableScale>
      </EdgeCard>
    </View>
  );
}

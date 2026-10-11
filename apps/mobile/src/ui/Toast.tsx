/**
 * A small message above the tab bar ("Counted as October rent ✓ · Undo"). One at a time;
 * it fades after a few seconds.
 */
import { useEffect, useSyncExternalStore } from "react";
import { View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePalette } from "../theme/ThemeProvider";
import { GUTTER } from "../theme/tokens";
import { EdgeCard } from "./EdgeCard";
import { Icon } from "./Icon";
import { PressableScale, tapHaptic } from "./PressableScale";
import { Txt } from "./Txt";

type Toast = { id: number; message: string; icon?: string; action?: { label: string; onPress: () => void } };

let current: Toast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(t: Omit<Toast, "id">): void {
  current = { ...t, id: nextId++ };
  emit();
}

function hide(id: number) {
  if (current?.id === id) {
    current = null;
    emit();
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => current;

export function ToastHost() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => hide(toast.id), 5500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <Animated.View
      key={toast.id}
      entering={FadeInDown.duration(260)}
      exiting={FadeOutDown.duration(200)}
      pointerEvents="box-none"
      style={{ position: "absolute", left: GUTTER, right: GUTTER, bottom: insets.bottom + 104 }}
    >
      <EdgeCard radius={18} padding={0} innerStyle={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11, paddingLeft: 14, paddingRight: 8, minHeight: 50 }}>
        <Icon name={toast.icon ?? "check"} size={16} color={palette.positive} strokeWidth={2.2} />
        <Txt variant="bodyMedium" size={14} style={{ flex: 1 }} numberOfLines={2}>
          {toast.message}
        </Txt>
        {toast.action ? (
          <PressableScale
            hitSlop={8}
            onPress={() => {
              tapHaptic("selection");
              toast.action!.onPress();
              hide(toast.id);
            }}
            style={{ paddingHorizontal: 10, paddingVertical: 6 }}
          >
            <Txt variant="label" tone="text" style={{ fontSize: 13 }}>
              {toast.action.label}
            </Txt>
          </PressableScale>
        ) : (
          <View style={{ width: 6 }} />
        )}
      </EdgeCard>
    </Animated.View>
  );
}

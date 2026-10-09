import { useEffect } from "react";
import { View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuickAdd } from "../features/add/QuickAddContext";
import { usePalette } from "../theme/ThemeProvider";
import { Icon } from "../ui/Icon";
import { PressableScale } from "../ui/PressableScale";

const TAB_ICONS: Record<string, { icon: string; label: string }> = {
  Home: { icon: "home", label: "Home" },
  Activity: { icon: "list", label: "Activity" },
  Plan: { icon: "plan", label: "Monthly plan" },
  Insights: { icon: "pie", label: "Insights" },
};

function TabButton({ focused, icon, label, onPress }: { focused: boolean; icon: string; label: string; onPress: () => void }) {
  const palette = usePalette();
  const dot = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    dot.value = withSpring(focused ? 1 : 0, { damping: 16, stiffness: 260 });
  }, [focused, dot]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value, transform: [{ scale: dot.value }] }));
  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", gap: 5 }}
    >
      <Icon name={icon} size={21} color={focused ? palette.text : palette.scheme === "dark" ? "#5E5E5E" : "#9A9A96"} strokeWidth={1.6} />
      <Animated.View style={[{ width: 4, height: 4, borderRadius: 2, backgroundColor: palette.text }, dotStyle]} />
    </PressableScale>
  );
}

/** Floating capsule with a light-catching edge and the centre "+" for quick add. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { open } = useQuickAdd();
  const routes = state.routes;
  const half = Math.ceil(routes.length / 2);

  const tab = (index: number) => {
    const route = routes[index];
    const meta = TAB_ICONS[route.name] ?? { icon: "dots", label: route.name };
    const focused = state.index === index;
    return (
      <TabButton
        key={route.key}
        focused={focused}
        icon={meta.icon}
        label={meta.label}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
      />
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
      <LinearGradient
        pointerEvents="none"
        colors={[palette.scheme === "dark" ? "rgba(0,0,0,0)" : "rgba(250,250,249,0)", palette.bg]}
        locations={[0, 0.55]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120 + insets.bottom }}
      />
      <LinearGradient
        colors={[palette.edgeFrom, palette.edgeMid, palette.edgeTo]}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ marginHorizontal: 20, marginBottom: insets.bottom + 14, borderRadius: 31, padding: 1 }}
      >
        <View
          style={{
            height: 60,
            borderRadius: 30,
            backgroundColor: palette.scheme === "dark" ? "rgba(16,16,17,0.97)" : "rgba(255,255,255,0.97)",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-around",
          }}
        >
          {routes.slice(0, half).map((_, i) => tab(i))}
          <PressableScale
            accessibilityLabel="Add an entry"
            haptic="light"
            scaleTo={0.92}
            onPress={() => open()}
            style={{
              width: 50,
              height: 50,
              marginTop: -26,
              borderRadius: 25,
              backgroundColor: palette.inverseBg,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 5,
              borderColor: palette.bg,
              boxSizing: "content-box",
              shadowColor: palette.scheme === "dark" ? "#FFFFFF" : "#000000",
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            }}
          >
            <Icon name="plus" size={22} color={palette.inverseText} strokeWidth={2} />
          </PressableScale>
          {routes.slice(half).map((_, i) => tab(half + i))}
        </View>
      </LinearGradient>
    </View>
  );
}

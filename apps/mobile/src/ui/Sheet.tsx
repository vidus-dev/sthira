import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, Modal, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePalette } from "../theme/ThemeProvider";
import { GUTTER } from "../theme/tokens";
import { Icon } from "./Icon";
import { PressableScale } from "./PressableScale";
import { Txt } from "./Txt";

const OPEN_SPRING = { damping: 30, stiffness: 280, mass: 0.9 };

/**
 * How much of the window the keyboard covers. Measured from the keyboard's top edge, so
 * it is right whether or not the system also shrinks the window for the keyboard.
 */
function useKeyboardInset(windowHeight: number): number {
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) =>
      setTop(e.endCoordinates.screenY)
    );
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setTop(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return top === null ? 0 : Math.max(0, windowHeight - top);
}

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Extra header actions (e.g. delete). */
  headerRight?: ReactNode;
  /** Fill most of the screen instead of fitting the content. */
  tall?: boolean;
  children: ReactNode;
};

/**
 * Bottom sheet: slides up with a spring over a dimmed backdrop; drag the handle down
 * (or tap outside) to close.
 */
export function Sheet({ visible, onClose, title, headerRight, tall, children }: Props) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const keyboard = useKeyboardInset(height);
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.value = 0;
      progress.value = reduce ? 1 : withSpring(1, OPEN_SPRING);
      return;
    }
    if (!mounted) return;
    progress.value = withTiming(0, { duration: reduce ? 0 : 220, easing: Easing.in(Easing.quad) });
    const t = setTimeout(() => setMounted(false), reduce ? 0 : 230);
    return () => clearTimeout(t);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY(8)
    .onUpdate((e) => {
      drag.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 900) onClose();
      else drag.value = withSpring(0, OPEN_SPRING);
    });

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panel = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [height, 0]) + drag.value }],
  }));

  if (!mounted) return null;

  // The sheet always fits between the status bar and the keyboard; its content scrolls.
  const room = height - keyboard - insets.top - 16;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
          <Animated.View style={[{ position: "absolute", inset: 0, backgroundColor: palette.overlay }, backdrop]}>
            <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} />
          </Animated.View>
          <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: keyboard }} pointerEvents="box-none">
            <Animated.View
              style={[
                { maxHeight: room, height: tall ? Math.min(room, height - insets.top - 40) : undefined },
                panel,
              ]}
            >
              <LinearGradient
                colors={[palette.edgeFrom, palette.edgeMid, palette.edgeTo]}
                locations={[0, 0.4, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.4 }}
                style={{ flex: tall ? 1 : undefined, flexShrink: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 1, paddingHorizontal: 1 }}
              >
                <View
                  style={{
                    flex: tall ? 1 : undefined,
                    flexShrink: 1,
                    backgroundColor: palette.surface,
                    borderTopLeftRadius: 29,
                    borderTopRightRadius: 29,
                    // The keyboard already covers the gesture bar.
                    paddingBottom: keyboard ? 12 : insets.bottom + 12,
                  }}
                >
                  <GestureDetector gesture={pan}>
                    <View style={{ paddingTop: 10, paddingHorizontal: GUTTER, paddingBottom: title ? 6 : 4 }}>
                      <View
                        style={{
                          alignSelf: "center",
                          width: 36,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: palette.scheme === "dark" ? "#2E2E2E" : "#D6D6D3",
                        }}
                      />
                      {title ? (
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14, gap: 8 }}>
                          <Txt variant="section" style={{ flex: 1, fontSize: 18 }}>
                            {title}
                          </Txt>
                          {headerRight}
                          <PressableScale
                            accessibilityLabel="Close"
                            onPress={onClose}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: palette.surfaceRaised,
                            }}
                          >
                            <Icon name="x" size={16} color={palette.textMuted} strokeWidth={2} />
                          </PressableScale>
                        </View>
                      ) : null}
                    </View>
                  </GestureDetector>
                  <View style={{ flex: tall ? 1 : undefined, flexShrink: 1 }}>{children}</View>
                </View>
              </LinearGradient>
            </Animated.View>
          </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

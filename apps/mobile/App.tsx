import { useEffect, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { focusManager, useIsRestoring } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useFonts, Geist_300Light, Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from "@expo-google-fonts/geist";
import { GeistMono_400Regular, GeistMono_500Medium } from "@expo-google-fonts/geist-mono";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient } from "./src/api/hooks";
import { CrashReportSender, ErrorBoundary, installCrashHandler } from "./src/core/crash";
import { persistOptions } from "./src/api/persist";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { QuickAddProvider } from "./src/features/add/QuickAddContext";
import { AppLockProvider } from "./src/features/lock/AppLock";
import { PrivacyScreen } from "./src/features/privacy/PrivacyScreen";
import { ReminderScheduler } from "./src/features/reminders/Reminders";
import { UpdateBanner } from "./src/features/updates/UpdateBanner";
import { navigationRef } from "./src/navigation/ref";
import { ToastHost } from "./src/ui/Toast";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { ThemeProvider, usePalette } from "./src/theme/ThemeProvider";

SplashScreen.preventAutoHideAsync().catch(() => {});
installCrashHandler();

// Refetch when the app comes back to the foreground.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (state) => {
    if (Platform.OS !== "web") handleFocus(state === "active");
  });
  return () => sub.remove();
});

function Navigation() {
  const palette = usePalette();
  const { isHydrated } = useAuth();
  const [fontsLoaded] = useFonts({
    Geist_300Light,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });
  // Wait for the on-device cache too, so Home opens with last known numbers, not skeletons.
  const restoring = useIsRestoring();
  const ready = fontsLoaded && isHydrated && !restoring;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const base = palette.scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: palette.bg,
      card: palette.bg,
      text: palette.text,
      border: palette.hairline,
      primary: palette.text,
    },
  };

  return (
    <NavigationContainer theme={navTheme} ref={navigationRef}>
      <QuickAddProvider>
        <RootNavigator />
        <ReminderScheduler />
      </QuickAddProvider>
      <UpdateBanner />
      <ToastHost />
      <StatusBar style={palette.scheme === "dark" ? "light" : "dark"} />
    </NavigationContainer>
  );
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
              <AuthProvider>
                <CrashReportSender />
                <PrivacyScreen />
                <AppLockProvider>{children}</AppLockProvider>
              </AuthProvider>
            </PersistQueryClientProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <Providers>
      <Navigation />
    </Providers>
  );
}

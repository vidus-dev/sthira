import { useEffect } from "react";
import { Platform } from "react-native";
import * as ScreenCapture from "expo-screen-capture";
import { privacyScreenPref } from "../../core/prefs";

/**
 * While on (the default), Android shows a blank card for Sthira in Recent apps and blocks
 * screenshots, so balances aren't visible over your shoulder. Off in Settings.
 */
export function PrivacyScreen() {
  const on = privacyScreenPref.use();
  useEffect(() => {
    if (Platform.OS === "web") return;
    const run = on ? ScreenCapture.preventScreenCaptureAsync("sthira") : ScreenCapture.allowScreenCaptureAsync("sthira");
    run.catch(() => {});
  }, [on]);
  return null;
}

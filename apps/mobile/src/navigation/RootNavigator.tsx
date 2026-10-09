import { useCallback, useEffect, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../auth/AuthContext";
import { AccountsScreen } from "../features/accounts/AccountsScreen";
import { ActivityScreen } from "../features/activity/ActivityScreen";
import { SignInScreen, SignUpScreen } from "../features/auth/AuthScreens";
import { CategoriesScreen } from "../features/categories/CategoriesScreen";
import { HomeScreen } from "../features/home/HomeScreen";
import { InsightsScreen } from "../features/insights/InsightsScreen";
import { ONBOARDING_KEY } from "../features/onboarding/flag";
import { OnboardingScreen } from "../features/onboarding/OnboardingScreen";
import { PlanItemsScreen } from "../features/plan/PlanItemsScreen";
import { PlanScreen } from "../features/plan/PlanScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { usePalette } from "../theme/ThemeProvider";
import { TabBar } from "./TabBar";
import type { RootStackParamList, TabParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const palette = usePalette();
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, animation: "fade", sceneStyle: { backgroundColor: palette.bg } }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Plan" component={PlanScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
    </Tab.Navigator>
  );
}

/** Shown once after sign-up (the flag is set by ``register``). */
function useOnboarding(userId: string | undefined) {
  const [pending, setPending] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) return setPending(null);
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => setPending(v === userId))
      .catch(() => setPending(false));
  }, [userId]);
  const done = useCallback(() => {
    setPending(false);
    AsyncStorage.removeItem(ONBOARDING_KEY).catch(() => {});
  }, []);
  return { pending, done };
}

export function RootNavigator() {
  const palette = usePalette();
  const { user, isAuthenticated } = useAuth();
  const onboarding = useOnboarding(user?.id);

  if (isAuthenticated && onboarding.pending === null) return null; // reading the flag (instant)

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: palette.bg },
      }}
    >
      {isAuthenticated ? (
        <>
          {onboarding.pending ? (
            <Stack.Screen name="Onboarding">{() => <OnboardingScreen onDone={onboarding.done} />}</Stack.Screen>
          ) : null}
          <Stack.Screen name="Main" component={MainTabs} options={{ animation: "fade" }} />
          <Stack.Screen name="Accounts" component={AccountsScreen} />
          <Stack.Screen name="Categories" component={CategoriesScreen} />
          <Stack.Screen name="PlanItems" component={PlanItemsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ animation: "fade" }} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

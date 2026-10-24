import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabParamList = {
  Home: undefined;
  Activity: undefined;
  Plan: undefined;
  Insights: undefined;
};

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  Onboarding: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Accounts: undefined;
  Categories: undefined;
  Settings: undefined;
  CatchUp: undefined;
  /** `fill`: account id → balance to type in (from a bank SMS). */
  Reconcile: { fill?: Record<string, number> } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}

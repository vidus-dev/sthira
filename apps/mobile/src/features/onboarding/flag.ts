import AsyncStorage from "@react-native-async-storage/async-storage";

/** Holds the id of a user who just signed up and hasn't finished first-run setup. */
export const ONBOARDING_KEY = "sthira.onboardingFor";

export function markOnboardingPending(userId: string): Promise<void> {
  return AsyncStorage.setItem(ONBOARDING_KEY, userId).catch(() => {});
}

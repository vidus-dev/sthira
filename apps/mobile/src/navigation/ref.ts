import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

/** For navigating from outside screens (e.g. a tapped reminder). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

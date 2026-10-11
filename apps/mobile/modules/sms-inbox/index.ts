import { PermissionsAndroid, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

export type InboxSms = {
  id: string;
  /** Sender ID, upper-case, e.g. "AX-HDFCBK". */
  address: string;
  body: string;
  /** Received at, epoch milliseconds. */
  date: number;
};

type Native = {
  hasPermission(): boolean;
  readSince(sinceMs: number, limit: number): Promise<InboxSms[]>;
};

// Missing in Expo Go, the browser preview and iOS: SMS features simply stay hidden there.
const native = Platform.OS === "android" ? requireOptionalNativeModule<Native>("SmsInbox") : null;

export const isSmsSupported = native !== null;

export function hasSmsPermission(): boolean {
  return native?.hasPermission() ?? false;
}

export type PermissionResult = "granted" | "denied" | "blocked";

export async function requestSmsPermission(): Promise<PermissionResult> {
  if (!native) return "denied";
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
  if (r === PermissionsAndroid.RESULTS.GRANTED) return "granted";
  return r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? "blocked" : "denied";
}

/** Business SMS (bank alerts) received after `sinceMs`, newest first. OTPs are never returned. */
export async function readBankSms(sinceMs: number, limit = 500): Promise<InboxSms[]> {
  if (!native) return [];
  return native.readSince(sinceMs, limit);
}

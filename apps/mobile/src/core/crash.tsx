/**
 * Crash reports: errors on the phone are saved first (the app may be about to close) and
 * sent to the server on the next chance, so problems on a real device become visible.
 * Reports carry the error and where it happened, never amounts or notes.
 */
import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { reloadAppAsync } from "expo";
import * as Updates from "expo-updates";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../ui/controls";
import { Icon } from "../ui/Icon";
import { Txt } from "../ui/Txt";

const KEY = "sthira.crashReports";
const MAX_STORED = 20;

type Report = {
  message: string;
  stack: string | null;
  fatal: boolean;
  occurred_at: string;
  context: Record<string, unknown>;
};

let sending = false;

function describe(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`.slice(0, 1000), stack: error.stack?.slice(0, 8000) ?? null };
  return { message: String(error).slice(0, 1000), stack: null };
}

async function store(report: Report): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Report[]) : [];
    await AsyncStorage.setItem(KEY, JSON.stringify([...list, report].slice(-MAX_STORED)));
  } catch {
    /* nothing else we can do */
  }
}

/** Record an error (and try to send it right away). */
export function reportError(error: unknown, context: Record<string, unknown> = {}, fatal = false): void {
  const { message, stack } = describe(error);
  void store({
    message,
    stack,
    fatal,
    occurred_at: new Date().toISOString(),
    context: { ...context, update: Updates.updateId ?? "embedded", os: `${Platform.OS} ${Platform.Version}` },
  }).then(sendPendingReports);
}

/** Send saved reports; keeps them if the server can't be reached. */
export async function sendPendingReports(): Promise<void> {
  if (sending) return;
  sending = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    let list = raw ? (JSON.parse(raw) as Report[]) : [];
    while (list.length) {
      const [first, ...rest] = list;
      await api.clientErrors.report({
        ...first,
        app_version: Constants.expoConfig?.version ?? null,
        platform: Platform.OS,
      });
      list = rest;
      await AsyncStorage.setItem(KEY, JSON.stringify(list));
    }
  } catch {
    /* offline or signed out: try again next launch */
  } finally {
    sending = false;
  }
}

/** Catch errors that escape everything else (also from promises without a catch). */
export function installCrashHandler(): void {
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler(): (e: unknown, fatal?: boolean) => void; setGlobalHandler(h: (e: unknown, fatal?: boolean) => void): void };
  };
  const utils = g.ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, fatal) => {
    reportError(error, { where: "global" }, Boolean(fatal));
    previous(error, fatal);
  });
}

/** Sends anything saved from an earlier crash once someone is signed in. */
export function CrashReportSender() {
  const { user } = useAuth();
  useEffect(() => {
    if (user) void sendPendingReports();
  }, [user]);
  return null;
}

/** A screen-level crash shows a calm "restart" page instead of a blank app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { where: "render", component: info.componentStack?.slice(0, 1500) }, true);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
        <Icon name="refresh" size={36} color="#F2F2F2" strokeWidth={1.4} />
        <Txt variant="section" color="#F2F2F2">
          Something went wrong
        </Txt>
        <Txt variant="label" color="#7C7C7C" style={{ textAlign: "center", lineHeight: 20 }}>
          Your entries are safe. A report was saved so it can be fixed.
        </Txt>
        <Button label="Restart Sthira" onPress={() => void reloadAppAsync().catch(() => this.setState({ failed: false }))} />
      </View>
    );
  }
}

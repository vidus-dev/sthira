/**
 * Local reminders (no server push): before monthly plan items are due, and a calm evening
 * nudge on days with nothing added. Re-planned whenever the plan or entries change.
 */
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useMonthPlan, usePendingTransactions, useRecentTransactions } from "../../api/hooks";
import type { MonthPlan } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { currentMonth, dayKey, parseDay, shiftMonth } from "../../core/format/dates";
import { formatINR } from "../../core/format/money";
import { eveningHourPref, eveningNudgePref, planRemindersPref } from "../../core/prefs";
import { navigationRef } from "../../navigation/ref";
import { useQuickAdd } from "../add/QuickAddContext";

const CHANNEL = "reminders";
const MORNING_HOUR = 9;

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Ask once (Android 13+ needs it); later changes happen in system settings. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

type Planned = { date: Date; title: string; body: string; data: Record<string, string> };

function atHour(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function planReminders(plans: (MonthPlan | undefined)[], now: Date): Planned[] {
  const out: Planned[] = [];
  for (const s of plans) {
    for (const i of s?.items ?? []) {
      if (i.status === "paid" || i.status === "tracking" || !i.due_date) continue;
      const due = parseDay(i.due_date);
      const amount = i.remaining ?? i.due_amount;
      const what = amount ? ` · ${formatINR(amount)}` : "";
      const before = atHour(new Date(due.getTime() - 2 * 86_400_000), MORNING_HOUR);
      const verb = i.dest_account_id ? "to move" : "due";
      if (before > now) out.push({ date: before, title: `${i.name} is ${verb} in 2 days`, body: `Due ${due.getDate()}${what}`, data: { kind: "plan" } });
      const onDay = atHour(due, MORNING_HOUR);
      if (onDay > now) out.push({ date: onDay, title: `${i.name} is ${verb} today`, body: `Tap to settle it${what}`, data: { kind: "plan" } });
    }
  }
  return out;
}

function eveningNudges(hour: number, addedToday: boolean, now: Date): Planned[] {
  const out: Planned[] = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    const at = atHour(day, hour);
    if (at <= now || (d === 0 && addedToday)) continue;
    out.push({ date: at, title: "Anything to add today?", body: "Tap to add an expense. Takes five seconds.", data: { kind: "evening" } });
  }
  return out;
}

export function ReminderScheduler() {
  const { user } = useAuth();
  const { open } = useQuickAdd();
  const plan = planRemindersPref.use();
  const evening = eveningNudgePref.use();
  const hour = eveningHourPref.use();
  const month = currentMonth();
  const now = useMonthPlan(month).data;
  // Next month's plan is opened (and created) only from the 25th, so reminders for the
  // 1st–5th of next month are set without making the plan too early.
  const next = useMonthPlan(shiftMonth(month, 1), new Date().getDate() >= 25).data;
  const recent = useRecentTransactions().data;
  const pending = usePendingTransactions();
  const asked = useRef(false);

  const today = dayKey(new Date());
  const addedToday = [...pending, ...(recent ?? [])].some(
    (t) => dayKey(new Date(t.created_at)) === today || dayKey(new Date(t.occurred_at)) === today
  );

  // Open the right place when a reminder is tapped.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const kind = r.notification.request.content.data?.kind;
      if (kind === "evening") open();
      else if (kind === "plan" && navigationRef.isReady()) navigationRef.navigate("Main", { screen: "Plan" });
    });
    return () => sub.remove();
  }, [open]);

  useEffect(() => {
    if (Platform.OS === "web" || !user) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: "Reminders",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
        const wanted = [...(plan ? planReminders([now, next], new Date()) : []), ...(evening ? eveningNudges(hour, addedToday, new Date()) : [])];
        if (wanted.length && !asked.current) {
          asked.current = true;
          if (!(await ensureNotificationPermission())) return;
        }
        if (cancelled) return;
        await Notifications.cancelAllScheduledNotificationsAsync();
        for (const p of wanted.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 60)) {
          await Notifications.scheduleNotificationAsync({
            content: { title: p.title, body: p.body, data: p.data },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date, channelId: CHANNEL },
          });
        }
      } catch {
        /* reminders are best-effort */
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [user, plan, evening, hour, now, next, addedToday]);

  // Signed out: nothing should keep reminding.
  useEffect(() => {
    if (Platform.OS !== "web" && !user) Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  }, [user]);

  return null;
}

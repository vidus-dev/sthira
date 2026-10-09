import { useMemo, useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthContext";
import {
  useAccounts,
  useCategoryMap,
  useHousehold,
  useMonthSummary,
  usePlanStatus,
  useRecentTransactions,
} from "../../api/hooks";
import type { MonthSummary, MonthlyPlanStatus } from "../../api/types";
import {
  currentMonth,
  dayHeader,
  daysFromToday,
  greeting,
  monoDate,
  monoDay,
  monthName,
  parseDay,
  relativeDueTag,
  shiftMonth,
} from "../../core/format/dates";
import { formatINR, toNumber } from "../../core/format/money";
import { usePalette } from "../../theme/ThemeProvider";
import { GUTTER } from "../../theme/tokens";
import { PaceChart } from "../../ui/charts";
import { Button } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { Icon } from "../../ui/Icon";
import { Rise, Screen, Skeleton } from "../../ui/layout";
import { Avatar, ListRow } from "../../ui/ListRow";
import { Money } from "../../ui/Money";
import { Odometer } from "../../ui/Odometer";
import { PressableScale } from "../../ui/PressableScale";
import { Txt } from "../../ui/Txt";
import { useQuickAdd } from "../add/QuickAddContext";
import { accountLabel, categoryIcon, firstName, txTitle } from "../shared";

/** Cumulative spend per day (index 0 = day 1) up to ``days``. */
function cumulative(summary: MonthSummary | undefined, days: number): number[] {
  if (!summary) return [];
  const perDay = new Array<number>(days).fill(0);
  for (const d of summary.by_day) {
    const day = parseDay(d.day).getDate();
    if (day <= days) perDay[day - 1] += toNumber(d.expense);
  }
  let run = 0;
  return perDay.map((v) => (run += v));
}

function remainingDue(plan: MonthlyPlanStatus | undefined): number {
  return (plan?.items ?? [])
    .filter((s) => s.status !== "paid")
    .reduce((sum, s) => sum + toNumber(s.remaining ?? s.due_amount), 0);
}

export function HomeScreen() {
  const palette = usePalette();
  const nav = useNavigation();
  const qc = useQueryClient();
  const { open } = useQuickAdd();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const month = currentMonth();
  const prevMonth = shiftMonth(month, -1);

  const household = useHousehold();
  const accounts = useAccounts();
  const summary = useMonthSummary(month);
  const prevSummary = useMonthSummary(prevMonth);
  const plan = usePlanStatus(month);
  const recent = useRecentTransactions();
  const categoryMap = useCategoryMap();
  const [refreshing, setRefreshing] = useState(false);

  const balance = useMemo(
    () => (accounts.data ?? []).reduce((sum, a) => sum + toNumber(a.balance), 0),
    [accounts.data]
  );

  const s = summary.data;
  const spent = toNumber(s?.expense_total);
  const income = toNumber(s?.income_total);
  const due = remainingDue(plan.data);
  const daysLeft = s ? Math.max(1, s.days_in_month - s.as_of_day + 1) : 1;
  const safeToday = income > 0 ? Math.max(0, (income - spent - due) / daysLeft) : null;

  const pace = useMemo(() => {
    if (!s) return null;
    const current = cumulative(s, Math.max(1, s.as_of_day));
    const previous = prevSummary.data ? cumulative(prevSummary.data, prevSummary.data.days_in_month) : [];
    const planPaid = toNumber(plan.data?.paid_total);
    const everyday = Math.max(0, spent - planPaid);
    const forecast = spent + due + (everyday / Math.max(1, s.as_of_day)) * (s.days_in_month - s.as_of_day);
    const lastMonthTotal = toNumber(prevSummary.data?.expense_total);
    return { current, previous, forecast, diff: lastMonthTotal - forecast, hasPrev: lastMonthTotal > 0 };
  }, [s, prevSummary.data, plan.data, spent, due]);

  const upNext = useMemo(
    () =>
      (plan.data?.items ?? [])
        .filter((i) => i.status !== "paid")
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
        .slice(0, 4),
    [plan.data]
  );

  const refresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries();
    setRefreshing(false);
  };

  const members = household.data?.members ?? [];
  // Personal by default; the household only shows once someone has been invited.
  const shared = members.length > 1;
  const settled = plan.data?.settled_count ?? 0;
  const total = plan.data?.total_count ?? 0;
  const noAccounts = accounts.isSuccess && (accounts.data?.length ?? 0) === 0;
  const chartWidth = width - GUTTER * 2 - 34;

  return (
    <Screen withTabBar refreshing={refreshing} onRefresh={refresh}>
      <Rise delay={0}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: GUTTER, paddingTop: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
            <View style={{ flexDirection: "row" }}>
              {(shared ? members : [{ id: "me", display_name: user?.display_name ?? null, email: "" }]).slice(0, 3).map((m, i) => (
                <View key={m.id} style={{ marginLeft: i ? -10 : 0 }}>
                  <Avatar name={m.display_name} size={34} ring={palette.bg} />
                </View>
              ))}
            </View>
            <View style={{ gap: 3 }}>
              <Txt variant="bodyMedium" style={{ fontSize: 15, letterSpacing: -0.15 }}>
                {shared ? household.data?.name : firstName(user?.display_name) || "My money"}
              </Txt>
              <Txt variant="tag">{monoDate(new Date())}</Txt>
            </View>
          </View>
          <PressableScale
            accessibilityLabel="Settings"
            onPress={() => nav.navigate("Settings")}
            style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: palette.iconBorder, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="sliders" size={17} color={palette.text} />
          </PressableScale>
        </View>
      </Rise>

      <Rise delay={100} style={{ paddingHorizontal: GUTTER, marginTop: 38 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt variant="label">
            {greeting()}
            {shared && user?.display_name ? `, ${firstName(user.display_name)}` : ""}
          </Txt>
          <PressableScale onPress={() => nav.navigate("Accounts")} hitSlop={10}>
            <Txt variant="tag" style={{ letterSpacing: 1.1 }}>
              {accounts.data ? `${accounts.data.length} ACCOUNTS ›` : " "}
            </Txt>
          </PressableScale>
        </View>
        <View style={{ marginTop: 10 }}>
          {accounts.isLoading ? <Skeleton width={230} height={60} /> : <Odometer value={balance} size={58} />}
        </View>
        {s ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 13 }}>
            <Icon name={toNumber(s.net) >= 0 ? "arrowUpRight" : "arrowDownLeft"} size={13} color={toNumber(s.net) >= 0 ? palette.positive : palette.negative} strokeWidth={2.2} />
            <Txt variant="label" tone={toNumber(s.net) >= 0 ? "positive" : "negative"} tabular>
              {formatINR(Math.abs(toNumber(s.net)))}
            </Txt>
            <Txt variant="label">{toNumber(s.net) >= 0 ? `saved so far in ${monthName(month)}` : `more out than in, ${monthName(month)}`}</Txt>
          </View>
        ) : null}
      </Rise>

      <Rise delay={200}>
        <View style={{ flexDirection: "row", marginHorizontal: GUTTER, marginTop: 24, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.hairline }}>
          {[
            { label: "Spent", value: s ? formatINR(spent) : "—" },
            { label: "Income", value: s ? formatINR(income) : "—" },
            { label: "Safe today", value: safeToday === null ? "—" : formatINR(safeToday) },
          ].map((m, i) => (
            <View key={m.label} style={{ flex: 1, paddingVertical: 13, paddingLeft: i ? 14 : 0, borderLeftWidth: i ? 1 : 0, borderColor: palette.hairline }}>
              <Txt variant="caption">{m.label}</Txt>
              <Txt tabular style={{ fontSize: 18, letterSpacing: -0.35, marginTop: 5 }} numberOfLines={1} adjustsFontSizeToFit>
                {m.value}
              </Txt>
            </View>
          ))}
        </View>
      </Rise>

      {noAccounts ? (
        <Rise delay={300} style={{ marginHorizontal: GUTTER, marginTop: 18 }}>
          <EdgeCard>
            <Txt variant="section">Add your accounts</Txt>
            <Txt variant="label" style={{ marginTop: 6, lineHeight: 19 }}>
              Each bank, credit card, cash in hand and wallet, with today's balance. It takes two minutes.
            </Txt>
            <Button label="Add accounts" icon="plus" style={{ marginTop: 14, alignSelf: "flex-start" }} onPress={() => nav.navigate("Accounts")} />
          </EdgeCard>
        </Rise>
      ) : null}

      <Rise delay={300} style={{ marginHorizontal: GUTTER, marginTop: 16 }}>
        <EdgeCard padding={16}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Txt variant="bodyMedium" size={13}>
              Spending pace
            </Txt>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Legend label={monthName(month, false)} kind="solid" />
              <Legend label={monthName(prevMonth, false)} kind="dashed" />
              <Legend label="Forecast" kind="dotted" />
            </View>
          </View>
          <View style={{ marginTop: 14 }}>
            {pace ? (
              <PaceChart
                width={chartWidth}
                current={pace.current}
                previous={pace.previous}
                daysInMonth={s?.days_in_month ?? 30}
                forecast={pace.current.length ? pace.forecast : null}
                todayLabel={`TODAY · ${formatINR(spent)}`}
              />
            ) : (
              <Skeleton width="100%" height={112} />
            )}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 7 }}>
            <Txt variant="tag" tone="faint">
              01 {monthName(month, false).toUpperCase()}
            </Txt>
            <Txt variant="tag" tone="faint">
              {s?.days_in_month ?? 30} {monthName(month, false).toUpperCase()}
            </Txt>
          </View>
          {pace ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderColor: palette.hairline, marginTop: 12, paddingTop: 12 }}>
              <Txt variant="label" tone="text" tabular>
                On pace for {formatINR(pace.forecast)}
              </Txt>
              {pace.hasPrev ? (
                <Txt variant="caption" tone={pace.diff >= 0 ? "positive" : "negative"} tabular>
                  {formatINR(Math.abs(pace.diff))} {pace.diff >= 0 ? "under" : "over"} {monthName(prevMonth)}
                </Txt>
              ) : null}
            </View>
          ) : null}
        </EdgeCard>
      </Rise>

      <Rise delay={400} style={{ marginTop: 22 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: GUTTER }}>
          <Txt variant="section">Up next</Txt>
          <PressableScale onPress={() => nav.navigate("Main", { screen: "Plan" })} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Txt variant="label" tabular>
              Monthly plan {settled}/{total}
            </Txt>
            <Icon name="chevronRight" size={13} color={palette.textMuted} strokeWidth={2} />
          </PressableScale>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 10, marginTop: 11 }}>
          {plan.isLoading
            ? [0, 1, 2].map((i) => <Skeleton key={i} width={146} height={86} radius={18} />)
            : upNext.length === 0
              ? (
                <EdgeCard radius={18} padding={14} style={{ width: 300 }}>
                  <Txt variant="bodyMedium" size={14}>
                    {total ? "Everything for this month is settled" : "Set up your monthly plan"}
                  </Txt>
                  <Txt variant="caption" style={{ marginTop: 4 }}>
                    {total ? "Nice. Nothing due until next month." : "Rent, EMI, 10% and 5% of salary…"}
                  </Txt>
                </EdgeCard>
              )
              : upNext.map((i) => {
                  const date = i.due_date ? parseDay(i.due_date) : null;
                  const soon = date ? daysFromToday(date) <= 7 : false;
                  const amount = i.remaining ?? i.due_amount;
                  return (
                    <PressableScale key={i.item.id} onPress={() => nav.navigate("Main", { screen: "Plan" })} scaleTo={0.97}>
                      <EdgeCard radius={18} padding={0} innerStyle={{ width: 146, paddingVertical: 12, paddingHorizontal: 13 }}>
                        <Txt variant="tag" tone={soon ? "due" : "muted"} size={9.5} numberOfLines={1}>
                          {date ? `${monoDay(date)} · ${relativeDueTag(date)}` : i.status === "awaiting_income" ? "AFTER SALARY" : "THIS MONTH"}
                        </Txt>
                        <Txt variant="bodyMedium" size={14} numberOfLines={1} style={{ marginTop: 8 }}>
                          {i.item.name}
                        </Txt>
                        <Txt variant="label" tabular style={{ marginTop: 3 }} numberOfLines={1}>
                          {amount === null
                            ? "Varies"
                            : `${i.item.amount_type === "variable" ? "≈ " : ""}${formatINR(amount)}${i.item.amount_type === "percent" && i.item.percent ? ` · ${toNumber(i.item.percent)}%` : ""}`}
                        </Txt>
                      </EdgeCard>
                    </PressableScale>
                  );
                })}
        </ScrollView>
      </Rise>

      <Rise delay={500} style={{ marginTop: 24, paddingHorizontal: GUTTER }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Txt variant="section">Recent</Txt>
          <PressableScale onPress={() => nav.navigate("Main", { screen: "Activity" })} hitSlop={10}>
            <Txt variant="label">See all</Txt>
          </PressableScale>
        </View>
        {recent.data && recent.data.length === 0 ? (
          <PressableScale onPress={() => open()} style={{ marginTop: 12 }}>
            <Txt variant="label">Nothing yet. Tap + to add your first expense.</Txt>
          </PressableScale>
        ) : null}
        {(recent.data ?? []).slice(0, 6).map((tx) => {
          const acc = accounts.data?.find((a) => a.id === tx.account_id);
          return (
            <ListRow
              key={tx.id}
              icon={categoryIcon(categoryMap, tx.category_slug)}
              title={txTitle(tx, categoryMap)}
              subtitle={`${dayHeader(new Date(tx.occurred_at))} · ${accountLabel(acc)}`}
              onPress={() => (tx.id.startsWith("optimistic") ? undefined : open({ edit: tx }))}
              right={<Money value={tx.amount} signed tone={toNumber(tx.amount) > 0 ? "positive" : "text"} />}
            />
          );
        })}
      </Rise>
    </Screen>
  );
}

function Legend({ label, kind }: { label: string; kind: "solid" | "dashed" | "dotted" }) {
  const palette = usePalette();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View
        style={{
          width: 10,
          height: 0,
          borderTopWidth: 1.5,
          borderStyle: kind,
          borderColor: kind === "solid" ? palette.text : kind === "dashed" ? (palette.scheme === "dark" ? "#4A4A4A" : "#C2C2BE") : palette.textMuted,
        }}
      />
      <Txt variant="tag" size={9} tone="faint">
        {label}
      </Txt>
    </View>
  );
}

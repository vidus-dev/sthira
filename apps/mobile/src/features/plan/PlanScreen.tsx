import { useMemo, useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useCategoryMap, usePlanStatus } from "../../api/hooks";
import type { PlanItemStatus } from "../../api/types";
import { currentMonth, daysFromToday, monoDay, monthName, parseDay, sameMonth, type YearMonth } from "../../core/format/dates";
import { formatINR, toNumber } from "../../core/format/money";
import { usePalette } from "../../theme/ThemeProvider";
import { GUTTER } from "../../theme/tokens";
import { BezelDial, GrowBar } from "../../ui/charts";
import { Button, Pill } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { Icon } from "../../ui/Icon";
import { EmptyState, Rise, Screen, SectionLabel, Skeleton } from "../../ui/layout";
import { IconCircle, ListRow } from "../../ui/ListRow";
import { Money } from "../../ui/Money";
import { PressableScale } from "../../ui/PressableScale";
import { Txt } from "../../ui/Txt";
import { useQuickAdd } from "../add/QuickAddContext";
import { MonthSwitcher } from "../activity/ActivityScreen";
import { categoryIcon } from "../shared";
import { PaySheet } from "./PaySheet";

export function PlanScreen() {
  const palette = usePalette();
  const nav = useNavigation();
  const { open } = useQuickAdd();
  const [month, setMonth] = useState<YearMonth>(currentMonth());
  const plan = usePlanStatus(month);
  const categoryMap = useCategoryMap();
  const [paying, setPaying] = useState<PlanItemStatus | null>(null);
  const [showSettled, setShowSettled] = useState(false);

  const groups = useMemo(() => {
    const items = plan.data?.items ?? [];
    const byDate = (a: PlanItemStatus, b: PlanItemStatus) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    return {
      due: items.filter((i) => i.status === "due" || i.status === "awaiting_income").sort(byDate),
      partial: items.filter((i) => i.status === "partial").sort(byDate),
      settled: items.filter((i) => i.status === "paid"),
    };
  }, [plan.data]);

  const planned = toNumber(plan.data?.planned_total);
  const paid = toNumber(plan.data?.paid_total);
  const salary = toNumber(plan.data?.base_income?.salary);
  const usesSalary = (plan.data?.items ?? []).some((i) => i.item.amount_type === "percent");
  const dueThisWeek = groups.due.filter((i) => i.due_date && daysFromToday(parseDay(i.due_date)) <= 7).length;
  const isCurrent = sameMonth(month, currentMonth());

  const subtitleFor = (s: PlanItemStatus) => {
    const date = s.due_date ? parseDay(s.due_date) : null;
    const when = date ? `due ${monoDay(date).replace(/^0/, "")}` : null;
    if (s.status === "awaiting_income") return "Waiting for this month's salary";
    if (s.item.amount_type === "percent") return [`${toNumber(s.item.percent)}% of salary`, when].filter(Boolean).join(" · ");
    if (s.item.amount_type === "variable") return [`Varies`, when].filter(Boolean).join(" · ");
    return [`Fixed`, when].filter(Boolean).join(" · ");
  };

  const dueRow = (s: PlanItemStatus) => {
    const date = s.due_date ? parseDay(s.due_date) : null;
    const soon = date ? daysFromToday(date) <= 7 : false;
    return (
      <ListRow
        key={s.item.id}
        icon={categoryIcon(categoryMap, s.item.category_slug)}
        title={s.item.name}
        subtitle={
          <Txt variant="caption" tone={soon && isCurrent ? "due" : "muted"} numberOfLines={1}>
            {subtitleFor(s)}
          </Txt>
        }
        onPress={() => setPaying(s)}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {s.due_amount !== null && s.status !== "awaiting_income" ? <Money value={s.due_amount} /> : null}
            {s.status === "awaiting_income" ? null : s.item.amount_type === "variable" ? (
              <Pill variant="outline" label="Enter bill" />
            ) : (
              <Pill label="Pay" />
            )}
          </View>
        }
      />
    );
  };

  return (
    <Screen withTabBar refreshing={plan.isRefetching} onRefresh={() => plan.refetch()}>
      <Rise>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: GUTTER }}>
          <Txt variant="title">Monthly plan</Txt>
          <MonthSwitcher month={month} onChange={setMonth} />
        </View>
      </Rise>

      {plan.isLoading ? (
        <View style={{ alignItems: "center", marginTop: 30 }}>
          <Skeleton width={200} height={200} radius={100} />
        </View>
      ) : (plan.data?.items.length ?? 0) === 0 ? (
        <Rise delay={120}>
          <EmptyState
            icon="plan"
            title="No monthly plan yet"
            body="Add the payments you make every month — rent, EMI, internet, and 10% / 5% of salary."
            action={<Button label="Set up the plan" icon="plus" onPress={() => nav.navigate("PlanItems")} />}
          />
        </Rise>
      ) : (
        <>
          <Rise delay={100} style={{ alignItems: "center", marginTop: 22 }}>
            <BezelDial key={`${month.year}-${month.month}`} progress={planned > 0 ? paid / planned : 0}>
              <Txt variant="tag" style={{ letterSpacing: 1.6 }}>
                SETTLED
              </Txt>
              <Money value={paid} size={30} weight="light" style={{ marginTop: 6 }} />
              <Txt variant="caption" tabular style={{ marginTop: 4 }}>
                of {formatINR(planned)}
              </Txt>
              <Txt variant="tag" tone={dueThisWeek && isCurrent ? "due" : "faint"} style={{ marginTop: 9, letterSpacing: 1 }}>
                {groups.due.length + groups.partial.length === 0
                  ? "ALL SETTLED"
                  : dueThisWeek && isCurrent
                    ? `${dueThisWeek} DUE THIS WEEK`
                    : `${plan.data?.settled_count ?? 0} OF ${plan.data?.total_count ?? 0} PAID`}
              </Txt>
            </BezelDial>
          </Rise>

          {usesSalary ? (
            <Rise delay={200} style={{ marginHorizontal: GUTTER, marginTop: 18 }}>
              <PressableScale onPress={salary > 0 ? undefined : () => open({ kind: "income" })} haptic={salary > 0 ? "none" : "selection"} scaleTo={salary > 0 ? 1 : 0.985}>
                <EdgeCard radius={16} padding={0} innerStyle={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
                  <IconCircle name="salary" size={32} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyMedium" size={14}>
                      {salary > 0 ? "Salary this month" : "Add this month's salary"}
                    </Txt>
                    <Txt variant="tag" style={{ marginTop: 3 }}>
                      {salary > 0 ? "BASE FOR 10% AND 5% ITEMS" : "THEN 10% AND 5% ARE WORKED OUT"}
                    </Txt>
                  </View>
                  {salary > 0 ? <Money value={salary} /> : <Icon name="plus" size={18} color={palette.text} />}
                </EdgeCard>
              </PressableScale>
            </Rise>
          ) : null}

          {groups.due.length ? (
            <Rise delay={280} style={{ marginTop: 24 }}>
              <SectionLabel label="DUE" right={String(groups.due.length)} />
              <View style={{ paddingHorizontal: GUTTER, marginTop: 2 }}>{groups.due.map(dueRow)}</View>
            </Rise>
          ) : null}

          {groups.partial.length ? (
            <Rise delay={340} style={{ marginTop: 18 }}>
              <SectionLabel label="IN PROGRESS" right={String(groups.partial.length)} />
              <View style={{ paddingHorizontal: GUTTER }}>
                {groups.partial.map((s) => {
                  const due = toNumber(s.due_amount);
                  const done = toNumber(s.paid_amount);
                  return (
                    <PressableScale key={s.item.id} onPress={() => setPaying(s)} scaleTo={0.985}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.hairline }}>
                        <IconCircle name={categoryIcon(categoryMap, s.item.category_slug)} />
                        <View style={{ flex: 1, gap: 8 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Txt variant="bodyMedium">{s.item.name}</Txt>
                            <Txt variant="label" tabular>
                              {formatINR(s.remaining)} left
                            </Txt>
                          </View>
                          <GrowBar fraction={due ? done / due : 0} color={palette.text} height={2} delay={600} />
                          <Txt variant="caption" tabular>
                            {subtitleFor(s)} · {formatINR(done)} of {formatINR(due)} given
                          </Txt>
                        </View>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            </Rise>
          ) : null}

          {groups.settled.length ? (
            <Rise delay={400} style={{ marginTop: 18 }}>
              <SectionLabel label="SETTLED" right={String(groups.settled.length)} />
              <View style={{ paddingHorizontal: GUTTER }}>
                {showSettled ? (
                  groups.settled.map((s) => (
                    <ListRow
                      key={s.item.id}
                      dim
                      icon={categoryIcon(categoryMap, s.item.category_slug)}
                      title={s.item.name}
                      subtitle={s.payments.length ? `Paid ${monoDay(new Date(s.payments[s.payments.length - 1].occurred_at)).replace(/^0/, "")}` : "Paid"}
                      onPress={() => setPaying(s)}
                      right={
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Icon name="check" size={14} color={palette.textMuted} strokeWidth={2.2} />
                          <Money value={s.paid_amount} tone="muted" />
                        </View>
                      }
                    />
                  ))
                ) : (
                  <PressableScale onPress={() => setShowSettled(true)} scaleTo={0.985}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 13, minHeight: 58 }}>
                      <View style={{ flexDirection: "row" }}>
                        {groups.settled.slice(0, 3).map((s, i) => (
                          <View key={s.item.id} style={{ marginLeft: i ? -8 : 0 }}>
                            <IconCircle name={categoryIcon(categoryMap, s.item.category_slug)} size={28} dim />
                          </View>
                        ))}
                      </View>
                      <Txt variant="body" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
                        {groups.settled.map((s) => s.item.name).join(", ")}
                      </Txt>
                      <Icon name="check" size={15} color={palette.textMuted} strokeWidth={2.2} />
                      <Money value={groups.settled.reduce((sum, s) => sum + toNumber(s.paid_amount), 0)} tone="muted" />
                    </View>
                  </PressableScale>
                )}
              </View>
            </Rise>
          ) : null}

          <Rise delay={460} style={{ paddingHorizontal: GUTTER, marginTop: 24 }}>
            <Button variant="outline" label="Manage plan items" icon="edit" onPress={() => nav.navigate("PlanItems")} />
            <Txt variant="caption" tone="faint" style={{ textAlign: "center", marginTop: 10 }}>
              {monthName(month)} · amounts follow the salary recorded that month
            </Txt>
          </Rise>
        </>
      )}

      <PaySheet status={paying} month={month} onClose={() => setPaying(null)} />
    </Screen>
  );
}

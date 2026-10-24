import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../api/client";
import { useAccounts, useCategoryMap, useMonthPlan, usePlanAction } from "../../api/hooks";
import type { Account, PlanLine } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { currentMonth, dayHeader, daysFromToday, monoDay, parseDay, sameMonth, shiftMonth, type YearMonth } from "../../core/format/dates";
import { formatINR, toNumber } from "../../core/format/money";
import { usePalette } from "../../theme/ThemeProvider";
import { GUTTER } from "../../theme/tokens";
import { BezelDial, GrowBar } from "../../ui/charts";
import { Button, Chip, Pill } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { Icon } from "../../ui/Icon";
import { EmptyState, Rise, Screen, SectionLabel, Skeleton } from "../../ui/layout";
import { IconCircle, ListRow } from "../../ui/ListRow";
import { Money } from "../../ui/Money";
import { PressableScale, tapHaptic } from "../../ui/PressableScale";
import { Txt } from "../../ui/Txt";
import { useQuickAdd } from "../add/QuickAddContext";
import { MonthSwitcher } from "../activity/ActivityScreen";
import { accountIcon, accountLabel, categoryIcon } from "../shared";
import { useSmsDrafts, type SmsCardBill } from "../sms/useSmsDrafts";
import { LineEditor, type EditorTarget } from "./LineEditor";
import { LineSheet } from "./LineSheet";
import { amountText, monthWord, SUGGESTIONS } from "./planText";
import { SalarySheet } from "./SalarySheet";

const byDue = (a: PlanLine, b: PlanLine) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.sort_order - b.sort_order;

export function PlanScreen() {
  const palette = usePalette();
  const { open } = useQuickAdd();
  const [month, setMonth] = useState<YearMonth>(currentMonth());
  const plan = useMonthPlan(month);
  const action = usePlanAction(month);
  const categoryMap = useCategoryMap();
  const { data: accounts = [] } = useAccounts();
  const [tapped, setTapped] = useState<PlanLine | null>(null);
  const [editing, setEditing] = useState<EditorTarget>(null);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [showSettled, setShowSettled] = useState(false);

  const p = plan.data;
  const now = currentMonth();
  const isCurrent = sameMonth(month, now);
  const canPlan = sameMonth(month, now) || sameMonth(month, shiftMonth(now, 1)) || (month.year * 12 + month.month < now.year * 12 + now.month && Boolean(p?.exists));
  const name = monthWord(month.year, month.month);
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.display_name ?? "";

  const groups = useMemo(() => {
    const items = p?.items ?? [];
    const bills = items.filter((i) => i.kind === "bill");
    return {
      toFill: items.filter((i) => i.status === "needs_amount"),
      open: bills.filter((i) => ["due", "partial", "awaiting_income"].includes(i.status)).sort(byDue),
      settled: bills.filter((i) => i.status === "paid"),
      allowances: items.filter((i) => i.kind === "allowance" && i.status !== "needs_amount"),
    };
  }, [p]);

  // The dial only counts what there is to do (watched allowances aren't "settled").
  const actionable = (p?.items ?? []).filter((i) => i.status !== "tracking");
  const planned = actionable.reduce((s, i) => s + toNumber(i.due_amount), 0);
  const done = toNumber(p?.done_total);
  const dueThisWeek = groups.open.filter((i) => i.due_date && daysFromToday(parseDay(i.due_date)) <= 7).length;
  const usesSalary = (p?.items ?? []).some((i) => i.amount_type === "percent");
  const salary = toNumber(p?.salary.effective);
  const shortBuckets = (p?.buckets ?? []).filter((b) => toNumber(b.short) > 0);

  const markReviewed = () => action.mutate(() => api.monthPlan.update(month.year, month.month, { reviewed: true }), { onSuccess: () => tapHaptic("success") });
  const carry = (itemId: string, how: "move" | "done") => action.mutate(() => api.monthPlan.carry(month.year, month.month, itemId, how));

  const billRow = (s: PlanLine) => {
    const date = s.due_date ? parseDay(s.due_date) : null;
    const soon = isCurrent && date ? daysFromToday(date) <= 7 : false;
    const partial = s.status === "partial";
    const sub = [
      s.status === "awaiting_income" ? "Waiting for salary" : s.amount_type === "percent" ? `${toNumber(s.percent)}% of salary` : null,
      partial ? `${formatINR(s.paid_amount)} of ${formatINR(s.due_amount)} paid` : null,
      date ? `due ${monoDay(date).replace(/^0/, "")}` : null,
      s.dest_account_id ? `→ ${accountName(s.dest_account_id)}` : null,
    ].filter(Boolean).join(" · ");
    const toCard = accounts.find((a) => a.id === s.dest_account_id)?.account_type === "credit";
    return (
      <ListRow
        key={s.id}
        icon={categoryIcon(categoryMap, s.category_slug)}
        title={s.name}
        subtitle={
          <Txt variant="caption" tone={soon ? "due" : "muted"} numberOfLines={1}>
            {sub || (s.repeats ? "Every month" : "Only this month")}
          </Txt>
        }
        onPress={() => setTapped(s)}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {s.status === "awaiting_income" ? null : <Money value={partial ? s.remaining : s.due_amount} />}
            {s.status === "awaiting_income" ? null : <Pill label={s.dest_account_id && !toCard ? "Move" : "Pay"} />}
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
      ) : plan.isError ? (
        <EmptyState icon="plan" title={`No plan for ${name}`} body="You can plan this month and next month." />
      ) : !p?.exists ? (
        <EmptyState icon="plan" title={`Nothing planned for ${name}`} body="This is before you started using Sthira." />
      ) : p.items.length === 0 ? (
        <Rise delay={120}>
          <EmptyState
            icon="plan"
            title={`Plan ${name}`}
            body="Add what you pay or set aside every month. Next month starts with the same list."
            action={<Button label="Add an item" icon="plus" onPress={() => setEditing({ draft: { name: "", category_slug: "other", kind: "bill", amount_type: "fixed", repeat: true } })} />}
          />
          <Suggestions onPick={(d) => setEditing({ draft: d })} />
        </Rise>
      ) : (
        <>
          {!p.reviewed && canPlan ? (
            <Rise delay={60} style={{ marginHorizontal: GUTTER, marginTop: 18 }}>
              <EdgeCard radius={18} padding={16}>
                <Txt variant="section">{name} plan is ready</Txt>
                <Txt variant="label" style={{ marginTop: 6, lineHeight: 19 }}>
                  {p.needs_amount_count
                    ? `${p.needs_amount_count} ${p.needs_amount_count === 1 ? "amount" : "amounts"} to fill. Change anything for ${name}, then tap Done.`
                    : `Same as your usual list. Change anything for ${name}, then tap Done.`}
                </Txt>
                <Button label="Done" icon="check" size="sm" style={{ marginTop: 12, alignSelf: "flex-start" }} onPress={markReviewed} />
              </EdgeCard>
            </Rise>
          ) : null}

          {p.previous_unpaid.length ? (
            <Rise delay={80} style={{ marginHorizontal: GUTTER, marginTop: 14 }}>
              <EdgeCard radius={18} padding={14}>
                <Txt variant="tag" tone="due" style={{ letterSpacing: 1.1 }}>
                  LEFT FROM {monthWord(shiftMonth(month, -1).year, shiftMonth(month, -1).month).toUpperCase()}
                </Txt>
                {p.previous_unpaid.map((u) => (
                  <View key={u.item_id} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyMedium" size={14} numberOfLines={1}>
                        {u.name}
                      </Txt>
                      <Txt variant="caption" tabular>
                        {formatINR(u.remaining)} unpaid
                      </Txt>
                    </View>
                    <PressableScale onPress={() => carry(u.item_id, "move")} accessibilityLabel={`Move ${u.name} to ${name}`}>
                      <Pill label={`Move to ${monthWord(month.year, month.month, false)}`} />
                    </PressableScale>
                    <PressableScale onPress={() => carry(u.item_id, "done")} accessibilityLabel={`Mark ${u.name} done`}>
                      <Pill variant="outline" label="Done" />
                    </PressableScale>
                  </View>
                ))}
              </EdgeCard>
            </Rise>
          ) : null}

          <Rise delay={100} style={{ alignItems: "center", marginTop: 22 }}>
            <BezelDial key={`${month.year}-${month.month}`} progress={planned > 0 ? Math.min(1, done / planned) : 0}>
              <Txt variant="tag" style={{ letterSpacing: 1.6 }}>
                SETTLED
              </Txt>
              <Money value={done} size={30} weight="light" style={{ marginTop: 6 }} />
              <Txt variant="caption" tabular style={{ marginTop: 4 }}>
                of {formatINR(planned)}
              </Txt>
              <Txt variant="tag" tone={(dueThisWeek && isCurrent) || p.needs_amount_count ? "due" : "faint"} style={{ marginTop: 9, letterSpacing: 1 }}>
                {p.needs_amount_count
                  ? `${p.needs_amount_count} TO FILL`
                  : p.settled_count === p.total_count
                    ? "ALL SETTLED"
                    : dueThisWeek && isCurrent
                      ? `${dueThisWeek} DUE THIS WEEK`
                      : `${p.settled_count} OF ${p.total_count} DONE`}
              </Txt>
            </BezelDial>
          </Rise>

          {usesSalary ? (
            <Rise delay={160} style={{ marginHorizontal: GUTTER, marginTop: 18 }}>
              <PressableScale onPress={() => setSalaryOpen(true)} scaleTo={0.985}>
                <EdgeCard radius={16} padding={0} innerStyle={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
                  <IconCircle name="salary" size={32} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyMedium" size={14}>
                      {salary > 0 ? `Based on salary` : `Add salary for ${name}`}
                    </Txt>
                    <Txt variant="tag" style={{ marginTop: 3 }}>
                      {p.salary.override
                        ? "SET BY YOU"
                        : p.salary.entries.length
                          ? `RECEIVED ${dayHeader(parseDay(p.salary.entries[0].date)).toUpperCase()}`
                          : "THEN THE % ITEMS ARE WORKED OUT"}
                    </Txt>
                  </View>
                  {salary > 0 ? <Money value={salary} /> : <Icon name="plus" size={18} color={palette.text} />}
                </EdgeCard>
              </PressableScale>
            </Rise>
          ) : null}

          {canPlan ? <CardBills month={month} items={p.items} accounts={accounts} onAdd={(run) => action.mutate(run, { onSuccess: () => tapHaptic("success") })} /> : null}

          {groups.toFill.length ? (
            <Rise delay={220} style={{ marginTop: 24 }}>
              <SectionLabel label="TO FILL" right={String(groups.toFill.length)} />
              <View style={{ paddingHorizontal: GUTTER, marginTop: 2 }}>
                {groups.toFill.map((s) => (
                  <ListRow
                    key={s.id}
                    icon={categoryIcon(categoryMap, s.category_slug)}
                    title={s.name}
                    subtitle={
                      <Txt variant="caption" tone="due" numberOfLines={1}>
                        {s.last_month_amount ? `Last month ${formatINR(s.last_month_amount)}` : "Amount changes every month"}
                      </Txt>
                    }
                    onPress={() => setTapped(s)}
                    right={<Pill variant="outline" label="Enter amount" />}
                  />
                ))}
              </View>
            </Rise>
          ) : null}

          {groups.open.length ? (
            <Rise delay={260} style={{ marginTop: 22 }}>
              <SectionLabel label="BILLS" right={String(groups.open.length)} />
              <View style={{ paddingHorizontal: GUTTER, marginTop: 2 }}>{groups.open.map(billRow)}</View>
            </Rise>
          ) : null}

          {groups.allowances.length ? (
            <Rise delay={300} style={{ marginTop: 22 }}>
              <SectionLabel label="ALLOWANCES" right={String(groups.allowances.length)} />
              <View style={{ paddingHorizontal: GUTTER }}>
                {groups.allowances.map((s) => {
                  const due = toNumber(s.due_amount);
                  const spent = toNumber(s.spent_amount);
                  const left = toNumber(s.left_amount);
                  const needsMove = Boolean(s.dest_account_id) && !s.closed && (s.status === "due" || s.status === "partial");
                  return (
                    <PressableScale key={s.id} onPress={() => setTapped(s)} scaleTo={0.985}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.hairline }}>
                        <IconCircle name={categoryIcon(categoryMap, s.category_slug)} />
                        <View style={{ flex: 1, gap: 7 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <Txt variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
                              {s.name}
                            </Txt>
                            {needsMove ? (
                              <Pill label={`Move ${formatINR(s.remaining ?? s.due_amount)}`} />
                            ) : s.status === "awaiting_income" ? (
                              <Txt variant="caption">Waiting for salary</Txt>
                            ) : (
                              <Txt variant="label" tone={left < 0 ? "negative" : "text"} tabular>
                                {left < 0 ? `${formatINR(-left)} over` : `${formatINR(left)} left`}
                              </Txt>
                            )}
                          </View>
                          <GrowBar fraction={due ? Math.min(1, spent / due) : 0} color={left < 0 ? palette.negative : palette.text} height={2} delay={500} />
                          <Txt variant="caption" tabular numberOfLines={1}>
                            {[
                              `${formatINR(spent)} of ${amountText(s)}`,
                              s.covers_rest ? "everything else" : null,
                              s.dest_account_id ? `${toNumber(s.paid_amount) >= due && due > 0 ? "in" : "→"} ${accountName(s.dest_account_id)}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Txt>
                        </View>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            </Rise>
          ) : null}

          {p.buckets.length ? (
            <Rise delay={340} style={{ marginTop: 22 }}>
              <SectionLabel label="BUCKETS" right={shortBuckets.length ? `${shortBuckets.length} SHORT` : "OK"} />
              <View style={{ paddingHorizontal: GUTTER }}>
                {p.buckets.map((b) => {
                  const short = toNumber(b.short);
                  return (
                    <View key={b.account_id} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, borderBottomWidth: 1, borderBottomColor: palette.hairline }}>
                      <IconCircle name="bank" size={34} />
                      <View style={{ flex: 1 }}>
                        <Txt variant="bodyMedium" numberOfLines={1}>
                          {accountName(b.account_id)}
                        </Txt>
                        <Txt variant="caption" tone={short > 0 ? "negative" : "muted"} tabular numberOfLines={1}>
                          {short > 0
                            ? `${formatINR(b.balance)} in account · ${formatINR(b.reserved)} set aside · ${formatINR(short)} short`
                            : `${formatINR(b.reserved)} set aside · covered`}
                        </Txt>
                      </View>
                      {short > 0 ? (
                        <PressableScale onPress={() => open({ kind: "transfer", prefill: { amount: short, destId: b.account_id, note: "Top up bucket" } })} accessibilityLabel="Top up">
                          <Pill label="Top up" />
                        </PressableScale>
                      ) : (
                        <Icon name="check" size={15} color={palette.textMuted} strokeWidth={2.2} />
                      )}
                    </View>
                  );
                })}
              </View>
            </Rise>
          ) : null}

          {groups.settled.length ? (
            <Rise delay={380} style={{ marginTop: 22 }}>
              <SectionLabel label="SETTLED" right={String(groups.settled.length)} />
              <View style={{ paddingHorizontal: GUTTER }}>
                {showSettled ? (
                  groups.settled.map((s) => (
                    <ListRow
                      key={s.id}
                      dim
                      icon={categoryIcon(categoryMap, s.category_slug)}
                      title={s.name}
                      subtitle={s.closed ? "Marked done" : s.payments.length ? `Paid ${monoDay(new Date(s.payments[s.payments.length - 1].occurred_at)).replace(/^0/, "")}` : "Paid"}
                      onPress={() => setTapped(s)}
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
                          <View key={s.id} style={{ marginLeft: i ? -8 : 0 }}>
                            <IconCircle name={categoryIcon(categoryMap, s.category_slug)} size={28} dim />
                          </View>
                        ))}
                      </View>
                      <Txt variant="body" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
                        {groups.settled.map((s) => s.name).join(", ")}
                      </Txt>
                      <Icon name="check" size={15} color={palette.textMuted} strokeWidth={2.2} />
                      <Money value={groups.settled.reduce((sum, s) => sum + toNumber(s.paid_amount), 0)} tone="muted" />
                    </View>
                  </PressableScale>
                )}
              </View>
            </Rise>
          ) : null}

          <Rise delay={420} style={{ paddingHorizontal: GUTTER, marginTop: 24 }}>
            {canPlan ? (
              <Button variant="outline" label={`Add to ${name}`} icon="plus" onPress={() => setEditing({ draft: { name: "", category_slug: "other", kind: "bill", amount_type: "fixed", repeat: true } })} />
            ) : null}
            <Txt variant="caption" tone="faint" style={{ textAlign: "center", marginTop: 10 }}>
              Tap an item to pay it, change it, or change it from now on
            </Txt>
          </Rise>
          {canPlan ? <Suggestions existing={p.items} onPick={(d) => setEditing({ draft: d })} /> : null}
        </>
      )}

      <LineSheet
        line={tapped}
        plan={p}
        ym={month}
        onClose={() => setTapped(null)}
        onEdit={(line) => {
          setTapped(null);
          setEditing({ line });
        }}
      />
      <LineEditor target={editing} ym={month} onClose={() => setEditing(null)} />
      <SalarySheet visible={salaryOpen} plan={p} ym={month} onClose={() => setSalaryOpen(false)} />
    </Screen>
  );
}

/** The usual notebook items not in the plan yet, one tap to start adding. */
function Suggestions({ existing = [], onPick }: { existing?: PlanLine[]; onPick: (d: (typeof SUGGESTIONS)[number]) => void }) {
  const categoryMap = useCategoryMap();
  const taken = new Set(existing.map((i) => i.name.toLowerCase()));
  const left = SUGGESTIONS.filter((s) => !taken.has(s.name.toLowerCase()) && !existing.some((e) => e.category_slug === s.category_slug));
  if (!left.length) return null;
  return (
    <View style={{ marginTop: 22 }}>
      <SectionLabel label="SUGGESTED" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: GUTTER, marginTop: 12 }}>
        {left.map((s) => (
          <Chip
            key={s.name}
            icon={categoryIcon(categoryMap, s.category_slug)}
            label={s.amount_type === "percent" ? `${s.name} · ${s.percent}%` : s.name}
            onPress={() => onPick(s)}
          />
        ))}
      </View>
    </View>
  );
}


const skippedBillsKey = (userId: string) => `sthira.cardBills.skipped.${userId}`;

/**
 * Credit card statements read from bank SMS whose due date falls in this month and that
 * aren't in the plan yet. Adding one makes a one-off bill paid by moving money to the card.
 */
function CardBills({
  month,
  items,
  accounts,
  onAdd,
}: {
  month: YearMonth;
  items: PlanLine[];
  accounts: Account[];
  onAdd: (run: () => ReturnType<typeof api.monthPlan.addLine>) => void;
}) {
  const nav = useNavigation();
  const { user } = useAuth();
  const sms = useSmsDrafts();
  const [skipped, setSkipped] = useState<string[]>([]);
  useEffect(() => {
    if (!user) return;
    AsyncStorage.getItem(skippedBillsKey(user.id))
      .then((raw) => setSkipped(raw ? (JSON.parse(raw) as string[]) : []))
      .catch(() => {});
  }, [user]);

  const bills = (sms.data?.cardBills ?? []).filter((b) => {
    const due = parseDay(b.dueDate);
    if (due.getFullYear() !== month.year || due.getMonth() + 1 !== month.month) return false;
    if (skipped.includes(b.ref)) return false;
    return !items.some((i) => b.accountId && i.dest_account_id === b.accountId);
  });
  if (!bills.length) return null;

  const skip = (b: SmsCardBill) => {
    const next = [...skipped, b.ref].slice(-200);
    setSkipped(next);
    if (user) void AsyncStorage.setItem(skippedBillsKey(user.id), JSON.stringify(next)).catch(() => {});
  };

  const add = (b: SmsCardBill, card: Account) =>
    onAdd(() =>
      api.monthPlan.addLine(month.year, month.month, {
        name: `${card.display_name} bill`,
        category_slug: "transfer",
        kind: "bill",
        amount_type: "fixed",
        amount: b.total.toFixed(2),
        dest_account_id: card.id,
        due_day: parseDay(b.dueDate).getDate(),
        notes: b.minDue ? `Minimum due ${formatINR(b.minDue)}` : null,
        repeat: false,
      })
    );

  return (
    <Rise delay={200} style={{ marginTop: 24 }}>
      <SectionLabel label="CARD BILLS FROM SMS" right={String(bills.length)} />
      <View style={{ paddingHorizontal: GUTTER, marginTop: 2 }}>
        {bills.map((b) => {
          const card = accounts.find((a) => a.id === b.accountId);
          const name = card ? accountLabel(card) : `${b.bank ?? "Credit"} card${b.last4 ? ` ••${b.last4}` : ""}`;
          return (
            <ListRow
              key={b.ref}
              icon={accountIcon("credit")}
              title={name}
              subtitle={
                <Txt variant="caption" tone={card ? "muted" : "due"} numberOfLines={1} tabular>
                  {card
                    ? `${formatINR(b.total, { paise: b.total % 1 !== 0 })} due ${monoDay(parseDay(b.dueDate)).replace(/^0/, "")}${b.minDue ? ` · min ${formatINR(b.minDue)}` : ""}`
                    : "Add this card in Accounts (with its last 4 digits)"}
                </Txt>
              }
              onLongPress={() => skip(b)}
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <PressableScale onPress={() => skip(b)} hitSlop={6} accessibilityLabel={`Skip ${name} bill`}>
                    <Pill variant="outline" label="Skip" />
                  </PressableScale>
                  {card ? (
                    <PressableScale onPress={() => add(b, card)} accessibilityLabel={`Add ${name} bill to the plan`}>
                      <Pill label="Add" />
                    </PressableScale>
                  ) : (
                    <PressableScale onPress={() => nav.navigate("Accounts")} accessibilityLabel="Open accounts">
                      <Pill label="Accounts" />
                    </PressableScale>
                  )}
                </View>
              }
            />
          );
        })}
      </View>
    </Rise>
  );
}

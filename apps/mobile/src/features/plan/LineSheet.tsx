import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useAccounts, useCategoryMap, usePlanAction } from "../../api/hooks";
import type { MonthPlan, PlanLine } from "../../api/types";
import { ApiError } from "../../core/api/ApiError";
import { dayHeader, type YearMonth } from "../../core/format/dates";
import { formatINR, keypadToDecimal, toNumber } from "../../core/format/money";
import { usePalette } from "../../theme/ThemeProvider";
import { GUTTER } from "../../theme/tokens";
import { Calendar, withTimeOf } from "../../ui/Calendar";
import { MiniRing } from "../../ui/charts";
import { Button, Chip, Segmented, TextField } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { Icon } from "../../ui/Icon";
import { ListRow } from "../../ui/ListRow";
import { Money } from "../../ui/Money";
import { PressableScale, tapHaptic } from "../../ui/PressableScale";
import { Sheet } from "../../ui/Sheet";
import { Txt } from "../../ui/Txt";
import { accountIcon, accountLabel, categoryIcon } from "../shared";
import { monthWord } from "./planText";

type Props = { line: PlanLine | null; plan: MonthPlan | undefined; ym: YearMonth; onEdit: (line: PlanLine) => void; onClose: () => void };

/** Tap a plan line: pay it, move its money to the bucket, fill this month's amount. */
export function LineSheet({ line: incoming, plan, ym, onEdit, onClose }: Props) {
  const palette = usePalette();
  const qc = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  const categoryMap = useCategoryMap();
  const action = usePlanAction(ym);
  // Follow the live line (it changes after paying); keep the last one while closing.
  const [lineId, setLineId] = useState<string | null>(incoming?.id ?? null);
  const live = plan?.items.find((i) => i.id === lineId) ?? null;
  const [frozen, setFrozen] = useState<PlanLine | null>(incoming);
  const line = live ?? frozen;

  const [amount, setAmount] = useState("");
  const [fill, setFill] = useState("");
  const [fromId, setFromId] = useState<string | null>(null);
  const [move, setMove] = useState(false);
  const [paidOn, setPaidOn] = useState(new Date());
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!incoming) return;
    setLineId(incoming.id);
    setFrozen(incoming);
    const left = toNumber(incoming.remaining ?? incoming.due_amount);
    setAmount(left > 0 ? String(left).replace(/\.0+$/, "") : "");
    setFill("");
    setFromId(incoming.default_account_id ?? accounts.find((a) => a.is_default)?.id ?? accounts.find((a) => a.id !== incoming.dest_account_id)?.id ?? null);
    setMove(Boolean(incoming.dest_account_id));
    setPaidOn(new Date());
    setPicking(false);
    setError(null);
  }, [incoming]); // eslint-disable-line react-hooks/exhaustive-deps

  // After the amount is filled in, prefill the payment with it.
  useEffect(() => {
    if (live && live.status !== "needs_amount" && !amount && live.remaining) setAmount(String(toNumber(live.remaining)));
  }, [live?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const month = monthWord(ym.year, ym.month);
  const dest = accounts.find((a) => a.id === line?.dest_account_id);
  const byId = new Map(accounts.map((a) => [a.id, a]));

  function failed(e: unknown) {
    setError(e instanceof ApiError ? e.message : "Couldn't save that.");
  }

  function saveAmount() {
    const decimal = keypadToDecimal(fill.trim());
    if (!line || !decimal) return setError("Enter this month's amount");
    setError(null);
    action.mutate(() => api.monthPlan.updateLine(ym.year, ym.month, line.id, { amount: decimal, scope: "month" }), {
      onSuccess: () => {
        tapHaptic("success");
        setAmount(String(toNumber(decimal)));
      },
      onError: failed,
    });
  }

  function pay() {
    if (!line) return;
    const decimal = keypadToDecimal(amount.trim());
    if (!decimal) return setError("Enter the amount");
    if (!fromId) return setError(move ? "Choose where the money comes from" : "Choose the account it's paid from");
    if (move && fromId === line.dest_account_id) return setError("Pick a different account to move it from");
    setError(null);
    action.mutate(
      () => api.monthPlan.pay(ym.year, ym.month, line.id, { account_id: fromId, amount: decimal, occurred_at: paidOn.toISOString(), move }),
      {
        onSuccess: () => {
          tapHaptic("success");
          onClose();
        },
        onError: failed,
      }
    );
  }

  function toggleDone() {
    if (!line) return;
    action.mutate(() => api.monthPlan.close(ym.year, ym.month, line.id, !line.closed), { onError: failed });
  }

  function unlink(txId: string) {
    Alert.alert("Not for this item?", "The entry stays in Activity; it just stops counting here.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove from item",
        onPress: () =>
          void api.transactions
            .update(txId, { plan_item_id: null })
            .then(() => qc.invalidateQueries({ queryKey: ["month-plan"] }))
            .catch(failed),
      },
    ]);
  }

  if (!line) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;

  const due = line.due_amount != null ? toNumber(line.due_amount) : null;
  const paid = toNumber(line.paid_amount);
  const allowance = line.kind === "allowance";
  const spent = toNumber(line.spent_amount);
  const left = line.left_amount != null ? toNumber(line.left_amount) : null;
  const canAct = !line.closed && line.status !== "paid" && line.status !== "tracking" && line.status !== "needs_amount" && line.status !== "awaiting_income";

  return (
    <Sheet
      visible={Boolean(incoming)}
      onClose={onClose}
      title={line.name}
      headerRight={
        <PressableScale accessibilityLabel="Edit item" onPress={() => onEdit(line)} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
          <Icon name="edit" size={17} color={palette.text} />
        </PressableScale>
      }
    >
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 8, gap: 18 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <MiniRing fraction={allowance && due ? Math.min(1, spent / due) : due ? paid / due : line.status === "paid" ? 1 : 0} size={40} />
          <View style={{ flex: 1, gap: 3 }}>
            <Txt variant="label" tone="text" tabular>
              {line.amount_type === "percent"
                ? due
                  ? `${toNumber(line.percent)}% of ${formatINR(plan?.salary.effective)} = ${formatINR(due)}`
                  : `${toNumber(line.percent)}% of salary · waiting for salary`
                : due != null
                  ? `${formatINR(due)} in ${month}`
                  : `${month} amount not entered yet`}
            </Txt>
            <Txt variant="caption" tabular>
              {allowance
                ? `${formatINR(spent)} spent${left != null ? ` · ${left >= 0 ? `${formatINR(left)} left` : `${formatINR(-left)} over`}` : ""}`
                : line.closed
                  ? "Marked as done"
                  : `Paid ${formatINR(paid)}${line.remaining && toNumber(line.remaining) > 0 ? ` · ${formatINR(line.remaining)} left` : ""}`}
            </Txt>
            {dest ? (
              <Txt variant="caption" tone={allowance && due && paid >= due ? "positive" : "muted"} tabular>
                {paid > 0 ? `${formatINR(paid)} moved to ${dest.display_name}` : `Goes to ${dest.display_name}`}
              </Txt>
            ) : null}
          </View>
        </View>

        {line.status === "needs_amount" ? (
          <View style={{ gap: 12 }}>
            <TextField
              label={`${month} amount (₹)`}
              value={fill}
              onChangeText={(t) => setFill(t.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
              placeholder={line.last_month_amount ? String(toNumber(line.last_month_amount)) : "0"}
              hint={line.last_month_amount ? `Last month ${formatINR(line.last_month_amount)}` : undefined}
              error={error}
            />
            <Button size="lg" icon="check" label="Save amount" loading={action.isPending} onPress={saveAmount} />
          </View>
        ) : null}

        {canAct ? (
          <View style={{ gap: 16 }}>
            <TextField label="Amount (₹)" value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholder="0" error={error} />
            {dest ? (
              <Segmented<"move" | "pay">
                value={move ? "move" : "pay"}
                onChange={(v) => setMove(v === "move")}
                options={[
                  { value: "move", label: `Move to ${dest.display_name}` },
                  { value: "pay", label: "Paid out" },
                ]}
              />
            ) : null}
            <View style={{ gap: 10 }}>
              <Txt variant="caption">{move ? "From" : "Paid from"}</Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {accounts
                  .filter((a) => !move || a.id !== line.dest_account_id)
                  .map((a) => (
                    <Chip key={a.id} label={accountLabel(a, false)} icon={accountIcon(a.account_type)} selected={a.id === fromId} onPress={() => setFromId(a.id)} />
                  ))}
              </View>
            </View>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Txt variant="caption">{move ? "Moved on" : "Paid on"}</Txt>
                <Chip icon="calendar" label={dayHeader(paidOn)} selected={picking} onPress={() => setPicking((v) => !v)} />
              </View>
              {picking ? (
                <EdgeCard radius={20} padding={12}>
                  <Calendar
                    value={paidOn}
                    onChange={(day) => {
                      setPaidOn(withTimeOf(day));
                      setPicking(false);
                    }}
                  />
                </EdgeCard>
              ) : null}
            </View>
            <Button
              size="lg"
              icon={move ? "swap" : "check"}
              label={`${move ? "Move" : "Pay"} ${keypadToDecimal(amount) ? formatINR(keypadToDecimal(amount)) : ""}`.trim()}
              loading={action.isPending}
              onPress={pay}
            />
          </View>
        ) : null}

        {line.payments.length ? (
          <View>
            <Txt variant="tag" style={{ marginBottom: 4 }}>
              {allowance ? "MOVED THIS MONTH" : "PAID THIS MONTH"}
            </Txt>
            {line.payments.map((p) => (
              <ListRow
                key={p.id}
                icon={p.transfer_id ? "swap" : categoryIcon(categoryMap, p.category_slug)}
                title={p.description || dayHeader(new Date(p.occurred_at))}
                subtitle={`${dayHeader(new Date(p.occurred_at))} · ${accountLabel(byId.get(p.account_id))}`}
                onLongPress={() => unlink(p.id)}
                right={<Money value={-toNumber(p.amount)} tone="muted" />}
                height={54}
              />
            ))}
            <Txt variant="caption" tone="faint" style={{ marginTop: 6 }}>
              Long-press an entry if it doesn't belong here.
            </Txt>
          </View>
        ) : null}

        {line.status !== "tracking" ? (
          <Button variant="ghost" label={line.closed ? "Reopen" : "Mark as done without paying here"} onPress={toggleDone} />
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

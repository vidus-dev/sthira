import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useAccounts, useCategoryMap, usePayPlanItem } from "../../api/hooks";
import type { PlanItemStatus } from "../../api/types";
import { ApiError } from "../../core/api/ApiError";
import { dayHeader, monthName, type YearMonth } from "../../core/format/dates";
import { formatINR, keypadToDecimal, toNumber } from "../../core/format/money";
import { GUTTER } from "../../theme/tokens";
import { Calendar, withTimeOf } from "../../ui/Calendar";
import { Button, Chip, Segmented, TextField } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { MiniRing } from "../../ui/charts";
import { ListRow } from "../../ui/ListRow";
import { Money } from "../../ui/Money";
import { tapHaptic } from "../../ui/PressableScale";
import { Sheet } from "../../ui/Sheet";
import { Txt } from "../../ui/Txt";
import { accountIcon, accountLabel, categoryIcon } from "../shared";

type Props = { status: PlanItemStatus | null; month: YearMonth; onClose: () => void };

/** Pay a plan item: spend it, or move it into one of our own "bucket" accounts. */
export function PaySheet({ status: incoming, month, onClose }: Props) {
  // Keep showing the last item while the sheet slides away.
  const [status, setStatus] = useState<PlanItemStatus | null>(incoming);
  const { data: accounts = [] } = useAccounts();
  const categoryMap = useCategoryMap();
  const pay = usePayPlanItem();
  const item = status?.item;

  const suggested = status ? toNumber(status.remaining ?? status.due_amount) : 0;
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [mode, setMode] = useState<"spend" | "move">("spend");
  const [destId, setDestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState(new Date());
  const [picking, setPicking] = useState(false);

  // Each time the sheet opens, start from what's still due and the usual account.
  useEffect(() => {
    if (!incoming) return;
    setStatus(incoming);
    const left = toNumber(incoming.remaining ?? incoming.due_amount);
    setAmount(left > 0 ? String(left).replace(/\.0+$/, "") : "");
    setAccountId(incoming.item.default_account_id ?? accounts.find((a) => a.is_default)?.id ?? accounts[0]?.id ?? null);
    setMode("spend");
    setDestId(null);
    setError(null);
    setPaidOn(new Date());
    setPicking(false);
  }, [incoming]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!item) return;
    const decimal = keypadToDecimal(amount.trim());
    if (!decimal) return setError("Enter the amount");
    if (!accountId) return setError("Choose the account it's paid from");
    if (mode === "move" && (!destId || destId === accountId)) return setError("Choose a different account to move it to");
    setError(null);
    try {
      await pay.mutateAsync({
        itemId: item.id,
        body: {
          year: month.year,
          month: month.month,
          account_id: accountId,
          amount: decimal,
          occurred_at: paidOn.toISOString(),
          dest_account_id: mode === "move" ? destId : null,
        },
      });
      tapHaptic("success");
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't record the payment.");
    }
  }

  const paid = toNumber(status?.paid_amount);
  const due = status?.due_amount != null ? toNumber(status.due_amount) : null;

  return (
    <Sheet visible={Boolean(incoming)} onClose={onClose} title={item?.name}>
      {status && item ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 8, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <MiniRing fraction={due ? paid / due : paid > 0 ? 1 : 0} size={40} />
            <View style={{ flex: 1 }}>
              <Txt variant="label" tone="text" tabular>
                {item.amount_type === "percent" && status.base_amount
                  ? `${toNumber(item.percent)}% of ${formatINR(status.base_amount)} = ${formatINR(due)}`
                  : item.amount_type === "variable"
                    ? due
                      ? `Usually about ${formatINR(due)}`
                      : "Amount varies each month"
                    : `${formatINR(due)} every month`}
              </Txt>
              <Txt variant="caption" style={{ marginTop: 3 }} tabular>
                {monthName(month)} · paid {formatINR(paid)}
                {status.remaining && toNumber(status.remaining) > 0 ? ` · ${formatINR(status.remaining)} left` : ""}
              </Txt>
            </View>
          </View>

          <TextField
            label={item.amount_type === "variable" ? "Bill amount (₹)" : "Amount (₹)"}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            placeholder={suggested > 0 ? String(suggested) : "0"}
            error={error}
          />

          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "spend", label: "Paid out" },
              { value: "move", label: "Move to my account" },
            ]}
          />

          <View style={{ gap: 10 }}>
            <Txt variant="caption">{mode === "move" ? "From" : "Paid from"}</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {accounts.map((a) => (
                <Chip key={a.id} label={accountLabel(a, false)} icon={accountIcon(a.account_type)} selected={a.id === accountId} onPress={() => setAccountId(a.id)} />
              ))}
            </View>
          </View>

          {mode === "move" ? (
            <View style={{ gap: 10 }}>
              <Txt variant="caption">To (your bucket account)</Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {accounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <Chip key={a.id} label={accountLabel(a, false)} icon={accountIcon(a.account_type)} selected={a.id === destId} onPress={() => setDestId(a.id)} />
                  ))}
              </View>
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Txt variant="caption">Paid on</Txt>
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
            icon="check"
            label={`Pay ${keypadToDecimal(amount) ? formatINR(keypadToDecimal(amount)) : ""}`.trim()}
            loading={pay.isPending}
            onPress={submit}
          />

          {status.payments.length ? (
            <View>
              <Txt variant="tag" style={{ marginBottom: 4 }}>
                PAID THIS MONTH
              </Txt>
              {status.payments.map((p) => (
                <ListRow
                  key={p.id}
                  icon={p.transfer_id ? "swap" : categoryIcon(categoryMap, p.category_slug)}
                  title={dayHeader(new Date(p.occurred_at))}
                  subtitle={accountLabel(accounts.find((a) => a.id === p.account_id))}
                  right={<Money value={-toNumber(p.amount)} tone="muted" />}
                  height={54}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </Sheet>
  );
}

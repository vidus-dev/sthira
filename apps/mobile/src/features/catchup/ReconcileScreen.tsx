import { useState } from "react";
import { Alert, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAccounts, useReconcileAccount } from "../../api/hooks";
import { flush, useOutbox } from "../../api/outbox";
import type { Account } from "../../api/types";
import { ApiError } from "../../core/api/ApiError";
import { monoDay } from "../../core/format/dates";
import { formatINR, toNumber } from "../../core/format/money";
import { GUTTER } from "../../theme/tokens";
import { Button, Segmented, TextField } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { EmptyState, Rise, Screen } from "../../ui/layout";
import { IconCircle } from "../../ui/ListRow";
import { Money } from "../../ui/Money";
import { PressableScale, tapHaptic } from "../../ui/PressableScale";
import { StackHeader } from "../../ui/StackHeader";
import { Txt } from "../../ui/Txt";
import { accountIcon, accountLabel } from "../shared";
import { useSmsDrafts } from "../sms/useSmsDrafts";

type Entry = { text: string; asSpending: boolean };

/** What the user typed, as the signed balance the server stores (cards: owed is negative). */
function typedBalance(a: Account, text: string): number | null {
  const cleaned = text.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return a.account_type === "credit" ? -n : n;
}

/**
 * Catch up by balance: type what each bank shows today; Sthira records the difference
 * as "Unaccounted" spending (or a plain correction), so balances are right again.
 */
export function ReconcileScreen() {
  const nav = useNavigation();
  const { data: accounts = [] } = useAccounts();
  const waiting = useOutbox();
  const sms = useSmsDrafts();
  const reconcile = useReconcileAccount();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [busy, setBusy] = useState(false);

  const set = (id: string, patch: Partial<Entry>) =>
    setEntries((cur) => ({ ...cur, [id]: { ...(cur[id] ?? { text: "", asSpending: true }), ...patch } }));

  const changes = accounts
    .map((a) => {
      const e = entries[a.id];
      const typed = e ? typedBalance(a, e.text) : null;
      if (typed === null) return null;
      const diff = Math.round((typed - toNumber(a.balance)) * 100) / 100;
      return diff === 0 ? null : { account: a, typed, diff, asSpending: e!.asSpending };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  async function fix() {
    setBusy(true);
    let done = 0;
    let unaccounted = 0;
    try {
      for (const c of changes) {
        await reconcile.mutateAsync({
          id: c.account.id,
          body: { balance: c.typed.toFixed(2), as_spending: c.diff < 0 && c.asSpending },
        });
        done++;
        if (c.diff < 0 && c.asSpending) unaccounted += -c.diff;
      }
      tapHaptic("success");
      Alert.alert(
        "Balances updated",
        unaccounted ? `${formatINR(unaccounted)} added as Unaccounted spending. You can rename or split it in Activity.` : "Everything matches your banks now.",
        [{ text: "OK", onPress: () => nav.goBack() }]
      );
    } catch (e) {
      Alert.alert("Couldn't update every balance", `${done} of ${changes.length} done. ${e instanceof ApiError ? e.message : ""}`);
    } finally {
      setBusy(false);
    }
  }

  const hints = sms.data?.balances ?? {};

  return (
    <Screen>
      <StackHeader title="Check balances" subtitle="Open each bank app and type what it shows now" />

      {waiting.length ? (
        <Rise delay={60} style={{ marginHorizontal: GUTTER, marginTop: 18 }}>
          <EdgeCard>
            <Txt variant="bodyMedium">
              {waiting.length} {waiting.length === 1 ? "entry is" : "entries are"} still waiting to sync
            </Txt>
            <Txt variant="label" style={{ marginTop: 6, lineHeight: 19 }}>
              Check balances once they're saved, so nothing is counted twice.
            </Txt>
            <Button variant="outline" size="sm" icon="refresh" label="Try now" style={{ marginTop: 12, alignSelf: "flex-start" }} onPress={() => void flush()} />
          </EdgeCard>
        </Rise>
      ) : null}

      {accounts.length === 0 ? <EmptyState icon="bank" title="No accounts yet" body="Add your accounts first." /> : null}

      <View style={{ paddingHorizontal: GUTTER, marginTop: 18, gap: 12 }}>
        {accounts.map((a, i) => {
          const e = entries[a.id];
          const typed = e ? typedBalance(a, e.text) : null;
          const diff = typed === null ? null : Math.round((typed - toNumber(a.balance)) * 100) / 100;
          const hint = hints[a.id];
          const card = a.account_type === "credit";
          return (
            <Rise key={a.id} delay={80 + i * 40}>
              <EdgeCard radius={18} padding={14}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <IconCircle name={accountIcon(a.account_type)} size={34} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt variant="bodyMedium" numberOfLines={1}>
                      {accountLabel(a)}
                    </Txt>
                    <Txt variant="caption" tabular>
                      Sthira shows {card ? `${formatINR(Math.max(0, -toNumber(a.balance)))} owed` : formatINR(a.balance)}
                    </Txt>
                  </View>
                </View>
                <View style={{ marginTop: 12 }}>
                  <TextField
                    label={card ? "Amount owed per the card app (₹)" : a.account_type === "cash" ? "Cash in hand now (₹)" : "Bank shows (₹)"}
                    value={e?.text ?? ""}
                    onChangeText={(t) => set(a.id, { text: t.replace(/[^0-9.,]/g, "") })}
                    keyboardType="decimal-pad"
                    placeholder="Leave empty to skip"
                  />
                </View>
                {hint && !card && !e?.text ? (
                  <PressableScale onPress={() => set(a.id, { text: String(hint.balance) })} hitSlop={6} style={{ marginTop: 8 }}>
                    <Txt variant="caption" tabular>
                      Last bank SMS ({monoDay(new Date(hint.date))}): {formatINR(hint.balance, { paise: hint.balance % 1 !== 0 })} · <Txt variant="caption" tone="text">use</Txt>
                    </Txt>
                  </PressableScale>
                ) : null}
                {diff === null ? null : diff === 0 ? (
                  <Txt variant="caption" tone="positive" style={{ marginTop: 10 }}>
                    Matches
                  </Txt>
                ) : (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                      <Money value={Math.abs(diff)} />
                      <Txt variant="caption">{diff < 0 ? "went out without an entry" : "more than Sthira has"}</Txt>
                    </View>
                    {diff < 0 ? (
                      <Segmented
                        value={e?.asSpending === false ? "fix" : "spend"}
                        onChange={(v) => set(a.id, { asSpending: v === "spend" })}
                        options={[
                          { value: "spend", label: "Count as spending" },
                          { value: "fix", label: "Just correct it" },
                        ]}
                      />
                    ) : (
                      <Txt variant="caption" tone="faint">
                        Recorded as a balance correction (not income).
                      </Txt>
                    )}
                  </View>
                )}
              </EdgeCard>
            </Rise>
          );
        })}
      </View>

      {accounts.length ? (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 20 }}>
          <Button
            size="lg"
            icon="check"
            label={changes.length ? `Fix ${changes.length} ${changes.length === 1 ? "balance" : "balances"}` : "Nothing to fix yet"}
            disabled={!changes.length || waiting.length > 0}
            loading={busy}
            onPress={() => void fix()}
          />
        </View>
      ) : null}
    </Screen>
  );
}

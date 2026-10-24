import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAccounts, useDeleteAccount, useHousehold, useReconcileAccount, useSaveAccount } from "../../api/hooks";
import type { Account, AccountType } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../core/api/ApiError";
import { dayHeader } from "../../core/format/dates";
import { formatINR, keypadToDecimal, toNumber } from "../../core/format/money";
import { usePalette } from "../../theme/ThemeProvider";
import { GUTTER } from "../../theme/tokens";
import { Button, Chip, Pill, Segmented, TextField } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { Icon } from "../../ui/Icon";
import { EmptyState, Rise, Screen, SectionLabel } from "../../ui/layout";
import { ListRow } from "../../ui/ListRow";
import { Money } from "../../ui/Money";
import { PressableScale, tapHaptic } from "../../ui/PressableScale";
import { Sheet } from "../../ui/Sheet";
import { StackHeader } from "../../ui/StackHeader";
import { Txt } from "../../ui/Txt";
import { ACCOUNT_TYPES, accountIcon, firstName, memberName } from "../shared";
import { useBankChecks, type BankCheck } from "../sms/bankCheck";

const GROUPS: { label: string; types: AccountType[] }[] = [
  { label: "BANKS", types: ["savings", "checking"] },
  { label: "CREDIT CARDS", types: ["credit"] },
  { label: "CASH & WALLETS", types: ["cash", "wallet"] },
  { label: "INVESTMENTS", types: ["investment"] },
];

export function AccountsScreen() {
  const accounts = useAccounts();
  const checks = useBankChecks();
  const { data: household } = useHousehold();
  const [editing, setEditing] = useState<{ account?: Account } | null>(null);
  const rows = accounts.data ?? [];
  const total = rows.reduce((sum, a) => sum + toNumber(a.balance), 0);
  const owed = rows.filter((a) => a.account_type === "credit").reduce((sum, a) => sum + Math.min(0, toNumber(a.balance)), 0);

  return (
    <Screen>
      <StackHeader
        title="Accounts"
        subtitle="Banks, cards, cash and wallets"
        right={<Button size="sm" icon="plus" label="Add" onPress={() => setEditing({})} />}
      />

      {rows.length ? (
        <Rise delay={80} style={{ marginHorizontal: GUTTER, marginTop: 20 }}>
          <EdgeCard radius={20} padding={18}>
            <Txt variant="caption">Net balance</Txt>
            <Money value={total} size={34} weight="light" paise style={{ marginTop: 6 }} />
            {owed < 0 ? (
              <Txt variant="caption" style={{ marginTop: 8 }} tabular>
                Includes {formatINR(Math.abs(owed))} owed on credit cards
              </Txt>
            ) : null}
          </EdgeCard>
        </Rise>
      ) : null}

      {accounts.isSuccess && rows.length === 0 ? (
        <EmptyState
          icon="bank"
          title="No accounts yet"
          body="Add each bank, credit card, cash in hand and wallet with today's balance."
          action={<Button icon="plus" label="Add an account" onPress={() => setEditing({})} />}
        />
      ) : null}

      {GROUPS.map((g, gi) => {
        const items = rows.filter((a) => g.types.includes(a.account_type));
        if (!items.length) return null;
        return (
          <Rise key={g.label} delay={140 + gi * 60} style={{ marginTop: 22 }}>
            <SectionLabel label={g.label} right={formatINR(items.reduce((s, a) => s + toNumber(a.balance), 0))} />
            <View style={{ paddingHorizontal: GUTTER }}>
              {items.map((a) => {
                const owner = a.owner_user_id ? memberName(household?.members, a.owner_user_id) : "Joint";
                const check = checks[a.id];
                const off = check ? Math.abs(check.diff) >= 1 : false;
                return (
                  <View key={a.id}>
                    <ListRow
                      divider={!check}
                      icon={accountIcon(a.account_type)}
                      title={a.display_name}
                      subtitle={[a.institution, a.mask_last4 ? `••${a.mask_last4}` : null, (household?.members.length ?? 1) > 1 ? firstName(owner) : null]
                        .filter(Boolean)
                        .join(" · ") || ACCOUNT_TYPES.find((t) => t.value === a.account_type)?.label}
                      onPress={() => setEditing({ account: a })}
                      right={<Money value={a.balance} tone={toNumber(a.balance) < 0 ? "negative" : "text"} />}
                    />
                    {check ? <BankLine check={check} off={off} accountId={a.id} /> : null}
                  </View>
                );
              })}
            </View>
          </Rise>
        );
      })}

      <AccountEditor editing={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

/** Under an account: what the bank's last SMS said, and a way to line Sthira up with it. */
function BankLine({ check, off, accountId }: { check: BankCheck; off: boolean; accountId: string }) {
  const palette = usePalette();
  const nav = useNavigation();
  const when = dayHeader(new Date(check.date));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 53, paddingBottom: 10, minHeight: 30, borderBottomWidth: 1, borderBottomColor: palette.hairline }}>
      {off ? (
        <>
          <Txt variant="caption" tone="due" tabular numberOfLines={2} style={{ flex: 1, lineHeight: 17 }}>
            Bank SMS {when}: {formatINR(check.bankBalance, { paise: check.bankBalance % 1 !== 0 })} ·{" "}
            {formatINR(Math.abs(check.diff))} {check.diff < 0 ? "less than Sthira" : "more than Sthira"}
          </Txt>
          {check.waiting ? (
            <PressableScale onPress={() => nav.navigate("CatchUp")} accessibilityLabel={`Add ${check.waiting} waiting SMS`}>
              <Pill variant="outline" label={`${check.waiting} SMS waiting`} />
            </PressableScale>
          ) : (
            <PressableScale onPress={() => nav.navigate("Reconcile", { fill: { [accountId]: check.fixTo } })} accessibilityLabel="Fix balance">
              <Pill label="Fix" />
            </PressableScale>
          )}
        </>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="check" size={12} color={palette.positive} strokeWidth={2.4} />
          <Txt variant="caption" tone="faint">
            Matches the bank SMS · {when}
          </Txt>
        </View>
      )}
    </View>
  );
}

function AccountEditor({ editing, onClose }: { editing: { account?: Account } | null; onClose: () => void }) {
  const palette = usePalette();
  const { user } = useAuth();
  const { data: household } = useHousehold();
  const save = useSaveAccount();
  const reconcile = useReconcileAccount();
  const remove = useDeleteAccount();
  const [account, setAccount] = useState<Account | undefined>(undefined);
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [type, setType] = useState<AccountType>("savings");
  const [last4, setLast4] = useState("");
  const [balance, setBalance] = useState("");
  const [owner, setOwner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    const a = editing.account;
    setAccount(a);
    setName(a?.display_name ?? "");
    setBank(a?.institution ?? "");
    setType(a?.account_type ?? "savings");
    setLast4(a?.mask_last4 ?? "");
    setBalance(a ? String(Math.abs(toNumber(a.balance))).replace(/\.0+$/, "") : "");
    setOwner(a ? a.owner_user_id : (user?.id ?? null));
    setError(null);
  }, [editing, user?.id]);

  const isCard = type === "credit";
  const members = household?.members ?? [];
  const typeOptions = useMemo(() => ACCOUNT_TYPES, []);

  async function submit() {
    if (!name.trim()) return setError("Give the account a name, e.g. HDFC Savings");
    if (last4 && !/^\d{4}$/.test(last4)) return setError("Last 4 digits should be 4 numbers");
    const amount = balance.trim() ? keypadToDecimal(balance.trim()) ?? (Number(balance) === 0 ? "0" : null) : "0";
    if (amount === null) return setError("Enter the balance as a number");
    // Credit cards: what you owe is a negative balance.
    const signed = isCard && Number(amount) > 0 ? `-${amount}` : amount;
    setError(null);
    // A changed balance on an existing account is recorded as a correction entry, so
    // the change stays visible in Activity instead of silently overwriting the number.
    const balanceChanged = account && Math.abs(Number(signed) - toNumber(account.balance)) >= 0.005;
    try {
      await save.mutateAsync({
        id: account?.id,
        body: {
          display_name: name.trim(),
          institution: bank.trim() || null,
          account_type: type,
          mask_last4: last4 || null,
          ...(account ? {} : { balance: signed }),
          owner_user_id: owner,
        },
      });
      if (account && balanceChanged) {
        await reconcile.mutateAsync({ id: account.id, body: { balance: signed, as_spending: false } });
      }
      tapHaptic("success");
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save the account.");
    }
  }

  function confirmDelete() {
    if (!account) return;
    Alert.alert(`Delete ${account.display_name}?`, "Its entries are deleted too. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate(account.id, { onSuccess: onClose }) },
    ]);
  }

  return (
    <Sheet
      visible={Boolean(editing)}
      onClose={onClose}
      title={account ? "Edit account" : "New account"}
      headerRight={
        account ? (
          <PressableScale accessibilityLabel="Delete account" onPress={confirmDelete} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
            <Icon name="trash" size={18} color={palette.negative} />
          </PressableScale>
        ) : null
      }
    >
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {typeOptions.map((t) => (
            <Chip key={t.value} icon={t.icon} label={t.label} selected={type === t.value} onPress={() => setType(t.value)} />
          ))}
        </View>
        <TextField label="Name" value={name} onChangeText={setName} placeholder={isCard ? "e.g. HDFC Card" : type === "cash" ? "Cash" : "e.g. SBI Savings"} maxLength={60} />
        {type === "cash" ? null : (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1.4 }}>
              <TextField label="Bank / provider" value={bank} onChangeText={setBank} placeholder="e.g. HDFC" maxLength={60} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Last 4 digits" value={last4} onChangeText={(t) => setLast4(t.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" placeholder="4821" maxLength={4} />
            </View>
          </View>
        )}
        <TextField
          label={isCard ? "Amount owed today (₹)" : account ? "Balance (₹)" : "Balance today (₹)"}
          value={balance}
          onChangeText={(t) => setBalance(t.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          placeholder="0"
          hint={account ? "A change is saved as a balance correction. To count missing spending, use Catch up → Check balances." : "From here on, entries keep it up to date."}
        />
        {members.length > 1 ? (
          <View style={{ gap: 10 }}>
            <Txt variant="caption">Whose account</Txt>
            <Segmented
              value={owner ?? "joint"}
              onChange={(v) => setOwner(v === "joint" ? null : v)}
              options={[...members.map((m) => ({ value: m.id, label: firstName(m.display_name) || m.email.split("@")[0] })), { value: "joint", label: "Joint" }]}
            />
          </View>
        ) : null}
        {error ? (
          <Txt variant="caption" tone="negative">
            {error}
          </Txt>
        ) : null}
        <Button size="lg" icon="check" label={account ? "Save changes" : "Add account"} loading={save.isPending || reconcile.isPending} onPress={submit} />
      </ScrollView>
    </Sheet>
  );
}

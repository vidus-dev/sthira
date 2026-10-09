import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useAccounts,
  useCategories,
  useCategoryMap,
  useCreateTransaction,
  useCreateTransfer,
  useDeleteTransaction,
  useMonthTransactions,
  useUpdateTransaction,
} from "../../api/hooks";
import type { Transaction } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../core/api/ApiError";
import { currentMonth, dayHeader, monoDay, timeLabel } from "../../core/format/dates";
import { formatINR, groupIndian, keypadToDecimal, toNumber } from "../../core/format/money";
import { usePalette } from "../../theme/ThemeProvider";
import { fonts, GUTTER } from "../../theme/tokens";
import { Calendar, withTimeOf } from "../../ui/Calendar";
import { Button, Chip, Segmented } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { Icon } from "../../ui/Icon";
import { IconCircle } from "../../ui/ListRow";
import { PressableScale, tapHaptic } from "../../ui/PressableScale";
import { Sheet } from "../../ui/Sheet";
import { Txt } from "../../ui/Txt";
import { accountIcon, accountLabel } from "../shared";

export type EntryKind = "expense" | "income" | "transfer";

const LAST_ACCOUNT_KEY = "sthira.lastAccount";
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;
type Picker = null | "account" | "dest" | "category" | "date";

function errorMessage(e: unknown): string {
  return e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.";
}

function Caret() {
  const palette = usePalette();
  const reduce = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (!reduce) o.value = withRepeat(withSequence(withTiming(1, { duration: 520 }), withTiming(0, { duration: 0 }), withTiming(0, { duration: 520 }), withTiming(1, { duration: 0 })), -1);
  }, [o, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 2, height: 56, marginLeft: 5, marginBottom: 8, borderRadius: 1, backgroundColor: palette.text }, style]} />;
}

function KeypadKey({ k, onPress, onLongPress }: { k: (typeof KEYS)[number]; onPress: () => void; onLongPress?: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={k === "back" ? "Delete" : k === "." ? "Decimal point" : k}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        height: 52,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 26,
        marginHorizontal: 18,
        backgroundColor: pressed ? palette.surfaceRaised : "transparent",
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      {k === "back" ? (
        <Icon name="backspace" size={24} color={palette.text} strokeWidth={1.5} />
      ) : (
        <Txt allowFontScaling={false} style={{ fontFamily: fonts.light, fontSize: k === "." ? 30 : 27 }}>
          {k}
        </Txt>
      )}
    </Pressable>
  );
}

type Props = { visible: boolean; onClose: () => void; options: { kind?: EntryKind; edit?: Transaction } };

export function QuickAddSheet({ visible, onClose, options }: Props) {
  const palette = usePalette();
  const { user } = useAuth();
  const editing = options.edit;
  const isTransferLeg = Boolean(editing?.transfer_id);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const categoryMap = useCategoryMap();
  const { data: monthTx = [] } = useMonthTransactions(currentMonth());
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();
  const createTransfer = useCreateTransfer();

  const [kind, setKind] = useState<EntryKind>(
    editing ? (isTransferLeg ? "transfer" : toNumber(editing.amount) < 0 ? "expense" : "income") : options.kind ?? "expense"
  );
  const [amount, setAmount] = useState(() =>
    editing ? String(Math.abs(toNumber(editing.amount))).replace(/\.0+$/, "") : ""
  );
  const [note, setNote] = useState(editing?.description ?? "");
  const [slug, setSlug] = useState<string | null>(editing?.category_slug ?? null);
  const [accountId, setAccountId] = useState<string | null>(editing?.account_id ?? null);
  const [destId, setDestId] = useState<string | null>(null);
  const [when, setWhen] = useState<Date>(() => (editing ? new Date(editing.occurred_at) : new Date()));
  const [picker, setPicker] = useState<Picker>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Default account: the one used last, else the default, else my first, else any.
  useEffect(() => {
    if (accountId || accounts.length === 0) return;
    AsyncStorage.getItem(LAST_ACCOUNT_KEY)
      .catch(() => null)
      .then((last) => {
        const pick =
          accounts.find((a) => a.id === last) ??
          accounts.find((a) => a.is_default) ??
          accounts.find((a) => a.owner_user_id === user?.id) ??
          accounts[0];
        setAccountId((cur) => cur ?? pick.id);
      });
  }, [accounts, accountId, user?.id]);

  const kindCategories = useMemo(
    () => categories.filter((c) => c.kind === (kind === "income" ? "income" : "expense")),
    [categories, kind]
  );

  // Recent first: most used this month, then the household's own order.
  const recent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of monthTx) {
      if (t.transfer_id) continue;
      if ((toNumber(t.amount) < 0) !== (kind === "expense")) continue;
      counts.set(t.category_slug, (counts.get(t.category_slug) ?? 0) + 1);
    }
    return [...kindCategories]
      .sort((a, b) => (counts.get(b.slug) ?? 0) - (counts.get(a.slug) ?? 0) || a.sort_order - b.sort_order)
      .slice(0, 6);
  }, [monthTx, kindCategories, kind]);

  useEffect(() => {
    if (kind === "transfer") return;
    if (slug && kindCategories.some((c) => c.slug === slug)) return;
    if (editing && slug) return;
    setSlug(kind === "income" ? kindCategories.find((c) => c.slug === "salary")?.slug ?? kindCategories[0]?.slug ?? null : recent[0]?.slug ?? null);
  }, [kind, kindCategories, recent, slug, editing]);

  const account = accounts.find((a) => a.id === accountId);
  const dest = accounts.find((a) => a.id === destId);

  // Editing a transfer: show both sides, whichever leg was tapped.
  const legDate = editing ? new Date(editing.occurred_at) : new Date();
  const { data: legMonthTx = [] } = useMonthTransactions({ year: legDate.getFullYear(), month: legDate.getMonth() + 1 });
  const otherLeg = isTransferLeg ? legMonthTx.find((t) => t.transfer_id === editing?.transfer_id && t.id !== editing?.id) : undefined;
  const tappedIncoming = isTransferLeg && toNumber(editing?.amount) > 0;
  const transferFrom = accounts.find((a) => a.id === (tappedIncoming ? otherLeg?.account_id : editing?.account_id));
  const transferTo = accounts.find((a) => a.id === (tappedIncoming ? editing?.account_id : otherLeg?.account_id));
  const fromAccount = isTransferLeg ? transferFrom : account;
  const selectedCategory = slug ? categoryMap.get(slug) : undefined;

  const press = (k: (typeof KEYS)[number]) => {
    tapHaptic("selection");
    setError(null);
    setAmount((cur) => {
      if (k === "back") return cur.slice(0, -1);
      if (k === ".") return cur.includes(".") ? cur : cur === "" ? "0." : `${cur}.`;
      const [int, dec] = cur.split(".");
      if (dec !== undefined && dec.length >= 2) return cur;
      if (dec === undefined && int.length >= 9) return cur;
      return cur === "0" ? k : cur + k;
    });
  };

  const [intPart, decPart] = amount.split(".");
  const displayAmount = amount ? `${groupIndian(intPart || "0")}${decPart !== undefined ? `.${decPart}` : ""}` : "0";
  const decimal = keypadToDecimal(amount);

  async function save() {
    if (!decimal) return setError("Enter an amount");
    if (!accountId) return setError("Add an account first (Settings → Accounts)");
    const occurred_at = when.toISOString();
    const description = note.trim();

    if (kind === "transfer" && !editing) {
      if (!destId || destId === accountId) return setError("Choose a different account to move money to");
      setSaving(true);
      try {
        await createTransfer.mutateAsync({ source_account_id: accountId, dest_account_id: destId, amount: decimal, description, occurred_at });
        tapHaptic("success");
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setSaving(false);
      }
      return;
    }

    const signed = kind === "expense" ? `-${decimal}` : decimal;
    if (editing) {
      setSaving(true);
      try {
        await updateTx.mutateAsync({
          id: editing.id,
          // A transfer's amount is sent as positive; the server moves both legs.
          patch: isTransferLeg
            ? { amount: decimal, description, occurred_at }
            : { amount: signed, category_slug: slug ?? "uncategorized", description, occurred_at },
        });
        tapHaptic("success");
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!slug) return setError("Pick a category");
    AsyncStorage.setItem(LAST_ACCOUNT_KEY, accountId).catch(() => {});
    tapHaptic("success");
    // Optimistic: the entry appears instantly; the sheet closes right away.
    createTx.mutate(
      { account_id: accountId, amount: signed, category_slug: slug, description, occurred_at },
      { onError: (e) => Alert.alert("Couldn't save that entry", errorMessage(e)) }
    );
    onClose();
  }

  function confirmDelete() {
    if (!editing) return;
    Alert.alert(isTransferLeg ? "Delete this transfer?" : "Delete this entry?", "Balances update right away.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          tapHaptic("warning");
          deleteTx.mutate(editing); // a transfer's other leg goes with it
          onClose();
        },
      },
    ]);
  }

  const verb = kind === "expense" ? "expense" : kind === "income" ? "income" : "transfer";

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      tall
      title={editing ? (isTransferLeg ? "Transfer" : "Edit entry") : undefined}
      headerRight={
        editing ? (
          <PressableScale
            accessibilityLabel="Delete"
            onPress={confirmDelete}
            style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="trash" size={18} color={palette.negative} />
          </PressableScale>
        ) : null
      }
    >
      <View style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {editing ? null : (
            <Segmented
              style={{ marginTop: 8 }}
              value={kind}
              onChange={(v) => {
                setKind(v);
                setPicker(null);
                setError(null);
              }}
              options={[
                { value: "expense", label: "Expense" },
                { value: "income", label: "Income" },
                { value: "transfer", label: "Transfer" },
              ]}
            />
          )}

          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", marginTop: 26 }}>
            <Txt allowFontScaling={false} style={{ fontFamily: fonts.light, fontSize: 30, color: palette.textMuted, marginRight: 6, marginBottom: 9 }}>
              ₹
            </Txt>
            <Txt allowFontScaling={false} tabular style={{ fontFamily: fonts.light, fontSize: 72, letterSpacing: -3.5, color: amount ? palette.text : palette.textFaint }}>
              {displayAmount}
            </Txt>
            <Caret />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 8 }}>
            <Icon name="edit" size={13} color={palette.textMuted} strokeWidth={1.8} />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={kind === "transfer" ? "Note (optional)" : selectedCategory ? `${selectedCategory.name} · add a note` : "Add a note"}
              placeholderTextColor={palette.textFaint}
              selectionColor={palette.text}
              maxLength={120}
              accessibilityLabel="Note"
              style={{ minWidth: 140, color: palette.text, fontFamily: fonts.regular, fontSize: 14, textAlign: "center", paddingVertical: 4 }}
            />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 10 }}>
            <PressableScale onPress={() => setPicker(picker === "date" ? null : "date")}>
              <EdgeCard radius={13} padding={0} innerStyle={{ height: 26, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="calendar" size={12} color={palette.textMuted} strokeWidth={1.8} />
                <Txt variant="tag" style={{ letterSpacing: 0.6 }}>
                  {`${dayHeader(when) === "Today" || dayHeader(when) === "Yesterday" ? dayHeader(when) : monoDay(when)}${when.getFullYear() !== new Date().getFullYear() ? ` ${when.getFullYear()}` : ""} · ${timeLabel(when)}`}
                </Txt>
              </EdgeCard>
            </PressableScale>
          </View>

          {picker === "date" ? (
            <EdgeCard radius={20} padding={12} style={{ marginTop: 14 }}>
              <Calendar
                value={when}
                onChange={(day) => {
                  setWhen(withTimeOf(day, when));
                  setPicker(null);
                }}
              />
            </EdgeCard>
          ) : null}

          {kind === "transfer" || isTransferLeg ? null : (
            <View style={{ marginTop: 22 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="caption">Category</Txt>
                <PressableScale onPress={() => setPicker(picker === "category" ? null : "category")} hitSlop={8}>
                  <Txt variant="tag">{picker === "category" ? "RECENT" : "ALL"}</Txt>
                </PressableScale>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {(picker === "category" ? kindCategories : recent).map((c) => (
                  <Chip
                    key={c.slug}
                    label={c.name}
                    icon={c.icon}
                    selected={c.slug === slug}
                    onPress={() => {
                      setSlug(c.slug);
                      if (picker === "category") setPicker(null);
                    }}
                  />
                ))}
                {picker !== "category" && selectedCategory && !recent.some((c) => c.slug === slug) ? (
                  <Chip label={selectedCategory.name} icon={selectedCategory.icon} selected />
                ) : null}
              </View>
            </View>
          )}

          <AccountRow
            label={kind === "income" ? "Received in" : kind === "transfer" ? "From" : "Paid from"}
            value={fromAccount ? accountLabel(fromAccount) : accounts.length ? "Choose account" : "No accounts yet"}
            icon={fromAccount ? accountIcon(fromAccount.account_type) : "bank"}
            open={picker === "account"}
            disabled={Boolean(editing)}
            onPress={() => setPicker(picker === "account" ? null : "account")}
          />
          {picker === "account"
            ? accounts.map((a) => (
                <AccountOption key={a.id} label={accountLabel(a)} icon={accountIcon(a.account_type)} balance={a.balance} selected={a.id === accountId} onPress={() => { setAccountId(a.id); setPicker(null); }} />
              ))
            : null}

          {isTransferLeg ? (
            <AccountRow
              label="To"
              value={transferTo ? accountLabel(transferTo) : "—"}
              icon={transferTo ? accountIcon(transferTo.account_type) : "swap"}
              open={false}
              disabled
              onPress={() => {}}
            />
          ) : null}

          {kind === "transfer" && !editing ? (
            <>
              <AccountRow
                label="To"
                value={dest ? accountLabel(dest) : "Choose account"}
                icon={dest ? accountIcon(dest.account_type) : "swap"}
                open={picker === "dest"}
                onPress={() => setPicker(picker === "dest" ? null : "dest")}
              />
              {picker === "dest"
                ? accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <AccountOption key={a.id} label={accountLabel(a)} icon={accountIcon(a.account_type)} balance={a.balance} selected={a.id === destId} onPress={() => { setDestId(a.id); setPicker(null); }} />
                    ))
                : null}
            </>
          ) : null}

          {error ? (
            <Txt variant="caption" tone="negative" style={{ marginTop: 12, textAlign: "center" }}>
              {error}
            </Txt>
          ) : null}
        </ScrollView>

        <View style={{ paddingHorizontal: GUTTER }}>
          {picker === "date" ? null : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
              {KEYS.map((k) => (
                <View key={k} style={{ width: "33.333%" }}>
                  <KeypadKey k={k} onPress={() => press(k)} onLongPress={k === "back" ? () => setAmount("") : undefined} />
                </View>
              ))}
            </View>
          )}
          <Button
            size="lg"
            icon="check"
            label={editing ? "Save changes" : `Save ${verb}`}
            loading={saving}
            onPress={save}
            trailing={
              decimal ? (
                <Txt variant="mono" color={palette.scheme === "dark" ? "#4A4A4A" : "#B5B5B5"}>
                  {formatINR(decimal)}
                </Txt>
              ) : undefined
            }
          />
        </View>
      </View>
    </Sheet>
  );
}

function AccountRow({ label, value, icon, open, disabled, onPress }: { label: string; value: string; icon: string; open: boolean; disabled?: boolean; onPress: () => void }) {
  const palette = usePalette();
  return (
    <PressableScale onPress={onPress} disabled={disabled} scaleTo={0.985} style={{ marginTop: 14 }}>
      <EdgeCard radius={16} padding={0} innerStyle={{ height: 56, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconCircle name={icon} size={32} />
        <View style={{ flex: 1 }}>
          <Txt variant="caption" size={11.5}>
            {label}
          </Txt>
          <Txt variant="bodyMedium" size={14} numberOfLines={1}>
            {value}
          </Txt>
        </View>
        {disabled ? null : <Icon name={open ? "chevronDown" : "chevronRight"} size={15} color={palette.textMuted} strokeWidth={2} />}
      </EdgeCard>
    </PressableScale>
  );
}

function AccountOption({ label, icon, balance, selected, onPress }: { label: string; icon: string; balance: string; selected: boolean; onPress: () => void }) {
  const palette = usePalette();
  return (
    <PressableScale onPress={onPress} scaleTo={0.985}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: palette.hairline }}>
        <Icon name={icon} size={17} color={palette.textMuted} />
        <Txt variant="body" style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </Txt>
        <Txt variant="mono" tabular>
          {formatINR(balance)}
        </Txt>
        {selected ? <Icon name="check" size={16} color={palette.text} strokeWidth={2.2} /> : <View style={{ width: 16 }} />}
      </View>
    </PressableScale>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useAccounts, useArchivePlanItem, useCategories, useCategoryMap, usePlanItems, useSavePlanItem } from "../../api/hooks";
import type { AmountType, PlanItem, PlanItemInput } from "../../api/types";
import { ApiError } from "../../core/api/ApiError";
import { formatINR, keypadToDecimal, toNumber } from "../../core/format/money";
import { usePalette } from "../../theme/ThemeProvider";
import { GUTTER } from "../../theme/tokens";
import { Button, Chip, Segmented, TextField } from "../../ui/controls";
import { Icon } from "../../ui/Icon";
import { EmptyState, Rise, Screen, SectionLabel } from "../../ui/layout";
import { ListRow } from "../../ui/ListRow";
import { PressableScale, tapHaptic } from "../../ui/PressableScale";
import { Sheet } from "../../ui/Sheet";
import { StackHeader } from "../../ui/StackHeader";
import { Txt } from "../../ui/Txt";
import { accountIcon, accountLabel, categoryIcon } from "../shared";

/** The compulsory payments from our notebook, one tap to add. */
const TEMPLATES: PlanItemInput[] = [
  { name: "Guru dakshina", category_slug: "guru-dakshina", amount_type: "percent", percent: "10" },
  { name: "Donations", category_slug: "donations", amount_type: "percent", percent: "5" },
  { name: "Rent", category_slug: "rent", amount_type: "fixed" },
  { name: "Maintenance", category_slug: "maintenance", amount_type: "fixed" },
  { name: "Vegetables", category_slug: "vegetables", amount_type: "fixed" },
  { name: "Non-veg", category_slug: "non-veg", amount_type: "fixed" },
  { name: "Loan EMI", category_slug: "loan-emi", amount_type: "fixed" },
  { name: "Internet", category_slug: "internet", amount_type: "fixed" },
  { name: "Electricity", category_slug: "electricity", amount_type: "variable" },
];

export function describePlanItem(item: PlanItem | PlanItemInput): string {
  const day = item.due_day ? ` · due on the ${ordinal(item.due_day)}` : "";
  if (item.amount_type === "percent") return `${toNumber(item.percent)}% of salary${day}`;
  if (item.amount_type === "variable")
    return `${item.amount ? `About ${formatINR(item.amount)}` : "Varies"}${day}`;
  return `${formatINR(item.amount)} every month${day}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export function PlanItemsScreen() {
  const palette = usePalette();
  const items = usePlanItems();
  const categoryMap = useCategoryMap();
  const [editing, setEditing] = useState<{ item?: PlanItem; draft: PlanItemInput } | null>(null);

  const taken = new Set((items.data ?? []).map((i) => i.category_slug));
  const templates = TEMPLATES.filter((t) => !taken.has(t.category_slug));

  return (
    <Screen>
      <StackHeader title="Plan items" subtitle="Payments you make every month" />

      <Rise delay={80} style={{ paddingHorizontal: GUTTER, marginTop: 18 }}>
        {(items.data ?? []).length === 0 && !items.isLoading ? (
          <EmptyState icon="plan" title="Nothing here yet" body="Start with the suggestions below, or add your own." />
        ) : null}
        {(items.data ?? []).map((item) => (
          <ListRow
            key={item.id}
            icon={categoryIcon(categoryMap, item.category_slug)}
            title={item.name}
            subtitle={describePlanItem(item)}
            onPress={() => setEditing({ item, draft: { ...item } })}
            right={<Icon name="chevronRight" size={15} color={palette.textMuted} strokeWidth={2} />}
          />
        ))}
        <Button
          variant="outline"
          icon="plus"
          label="Add an item"
          style={{ marginTop: 16 }}
          onPress={() => setEditing({ draft: { name: "", category_slug: "other", amount_type: "fixed" } })}
        />
      </Rise>

      {templates.length ? (
        <Rise delay={160} style={{ marginTop: 28 }}>
          <SectionLabel label="SUGGESTED" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: GUTTER, marginTop: 12 }}>
            {templates.map((t) => (
              <Chip
                key={t.category_slug}
                icon={categoryIcon(categoryMap, t.category_slug)}
                label={t.amount_type === "percent" ? `${t.name} · ${t.percent}%` : t.name}
                onPress={() => setEditing({ draft: { ...t } })}
              />
            ))}
          </View>
        </Rise>
      ) : null}

      <PlanItemEditor editing={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function PlanItemEditor({ editing, onClose }: { editing: { item?: PlanItem; draft: PlanItemInput } | null; onClose: () => void }) {
  const palette = usePalette();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const save = useSavePlanItem();
  const archive = useArchivePlanItem();
  const [last, setLast] = useState(editing);
  const [name, setName] = useState("");
  const [type, setType] = useState<AmountType>("fixed");
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState("");
  const [slug, setSlug] = useState("other");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [dueDay, setDueDay] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setLast(editing);
    const d = editing.draft;
    setName(d.name);
    setType(d.amount_type);
    setAmount(d.amount ? String(toNumber(d.amount)) : "");
    setPercent(d.percent ? String(toNumber(d.percent)) : "");
    setSlug(d.category_slug);
    setAccountId(d.default_account_id ?? null);
    setDueDay(d.due_day ? String(d.due_day) : "");
    setError(null);
  }, [editing]);

  const expenseCats = useMemo(() => categories.filter((c) => c.kind === "expense"), [categories]);

  async function submit() {
    const amt = amount.trim() ? keypadToDecimal(amount.trim()) : null;
    const pct = percent.trim() ? Number(percent) : null;
    const day = dueDay.trim() ? Number(dueDay) : null;
    if (!name.trim()) return setError("Give it a name");
    if (type === "fixed" && !amt) return setError("Enter the monthly amount");
    if (type === "percent" && (!pct || pct <= 0 || pct > 100)) return setError("Enter a percent between 1 and 100");
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) return setError("Due day is a date from 1 to 31");
    setError(null);
    const body: PlanItemInput = {
      name: name.trim(),
      category_slug: slug,
      amount_type: type,
      amount: type === "percent" ? null : amt,
      percent: type === "percent" ? String(pct) : null,
      base_category_slug: type === "percent" ? "salary" : null,
      default_account_id: accountId,
      due_day: day,
    };
    try {
      await save.mutateAsync({ id: last?.item?.id, body });
      tapHaptic("success");
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save.");
    }
  }

  function confirmArchive() {
    const item = last?.item;
    if (!item) return;
    Alert.alert(`Stop tracking ${item.name}?`, "It disappears from next months. Past payments stay.", [
      { text: "Cancel", style: "cancel" },
      { text: "Stop tracking", style: "destructive", onPress: () => archive.mutate(item.id, { onSuccess: onClose }) },
    ]);
  }

  return (
    <Sheet
      visible={Boolean(editing)}
      onClose={onClose}
      title={last?.item ? "Edit plan item" : "New plan item"}
      headerRight={
        last?.item ? (
          <PressableScale accessibilityLabel="Stop tracking" onPress={confirmArchive} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
            <Icon name="trash" size={18} color={palette.negative} />
          </PressableScale>
        ) : null
      }
    >
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Rent" maxLength={80} />
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: "fixed", label: "Fixed" },
            { value: "percent", label: "% of salary" },
            { value: "variable", label: "Varies" },
          ]}
        />
        {type === "percent" ? (
          <TextField label="Percent of salary" value={percent} onChangeText={(t) => setPercent(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholder="10" hint="Worked out from the salary you record each month." />
        ) : (
          <TextField
            label={type === "fixed" ? "Amount every month (₹)" : "Usual amount (₹, optional)"}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        )}
        <View style={{ gap: 10 }}>
          <Txt variant="caption">Category</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {expenseCats.map((c) => (
              <Chip key={c.slug} icon={c.icon} label={c.name} selected={c.slug === slug} onPress={() => setSlug(c.slug)} />
            ))}
          </ScrollView>
        </View>
        <View style={{ gap: 10 }}>
          <Txt variant="caption">Usually paid from</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label="Ask each time" selected={accountId === null} onPress={() => setAccountId(null)} />
            {accounts.map((a) => (
              <Chip key={a.id} icon={accountIcon(a.account_type)} label={accountLabel(a, false)} selected={a.id === accountId} onPress={() => setAccountId(a.id)} />
            ))}
          </View>
        </View>
        <TextField label="Due day (optional)" value={dueDay} onChangeText={(t) => setDueDay(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="e.g. 5" maxLength={2} error={error} />
        <Button size="lg" icon="check" label="Save" loading={save.isPending} onPress={submit} />
      </ScrollView>
    </Sheet>
  );
}

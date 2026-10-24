import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { api } from "../../api/client";
import { useAccounts, useCategories, usePlanAction } from "../../api/hooks";
import type { LineCreate, LineFields, LineKind, PlanLine } from "../../api/types";
import { ApiError } from "../../core/api/ApiError";
import type { YearMonth } from "../../core/format/dates";
import { keypadToDecimal, toNumber } from "../../core/format/money";
import { usePalette } from "../../theme/ThemeProvider";
import { GUTTER } from "../../theme/tokens";
import { Button, Chip, Segmented, TextField, Toggle } from "../../ui/controls";
import { Icon } from "../../ui/Icon";
import { PressableScale, tapHaptic } from "../../ui/PressableScale";
import { Sheet } from "../../ui/Sheet";
import { Txt } from "../../ui/Txt";
import { accountIcon, accountLabel } from "../shared";
import { monthWord, RULES, ruleOf, type Rule } from "./planText";

export type EditorTarget = { line?: PlanLine; draft?: LineCreate } | null;

type Form = {
  name: string;
  kind: LineKind;
  rule: Rule;
  /** For "only this month": fixed amount or % of salary. */
  onceType: "fixed" | "percent";
  amount: string;
  percent: string;
  slug: string;
  coversRest: boolean;
  destId: string | null;
  fromId: string | null;
  dueDay: string;
  /** Paid to over UPI (bills paid out, not moved to a bucket). */
  upi: string;
  payeeName: string;
};

/** Same rule as the server: handle@provider. */
export const UPI_ID = /^[a-z0-9._-]{2,64}@[a-z][a-z0-9.-]{1,32}$/;

function formFrom(t: NonNullable<EditorTarget>): Form {
  const src = t.line ?? t.draft!;
  const rule: Rule = t.line ? ruleOf(t.line) : t.draft!.repeat === false ? "once" : src.amount_type === "percent" ? "percent" : src.amount_type === "variable" ? "varies" : "same";
  return {
    name: src.name ?? "",
    kind: (src.kind as LineKind) ?? "bill",
    rule,
    onceType: src.amount_type === "percent" ? "percent" : "fixed",
    amount: src.amount ? String(toNumber(src.amount)) : "",
    percent: src.percent ? String(toNumber(src.percent)) : "",
    slug: src.category_slug ?? "other",
    coversRest: Boolean(src.covers_rest),
    destId: src.dest_account_id ?? null,
    fromId: src.default_account_id ?? null,
    dueDay: src.due_day ? String(src.due_day) : "",
    upi: src.payee_upi ?? "",
    payeeName: src.payee_name ?? "",
  };
}

/** Add or change a line of a month's plan. */
export function LineEditor({ target, ym, onClose }: { target: EditorTarget; ym: YearMonth; onClose: () => void }) {
  const palette = usePalette();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const action = usePlanAction(ym);
  const [last, setLast] = useState<EditorTarget>(target);
  const [f, setF] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const month = monthWord(ym.year, ym.month);

  useEffect(() => {
    if (!target) return;
    setLast(target);
    setF(formFrom(target));
    setError(null);
  }, [target]);

  // The chosen category first, so it's visible without scrolling the row.
  const chosenSlug = f?.slug;
  const expenseCats = useMemo(() => {
    const list = categories.filter((c) => c.kind === "expense");
    const i = list.findIndex((c) => c.slug === chosenSlug);
    return i > 0 ? [list[i], ...list.slice(0, i), ...list.slice(i + 1)] : list;
    // Only reorder when the sheet opens, not on every tap.
  }, [categories, last]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<Form>) => setF((cur) => (cur ? { ...cur, ...patch } : cur));
  const line = last?.line;

  function fields(form: Form): LineFields | string {
    if (!form.name.trim()) return "Give it a name";
    const amountType = form.rule === "percent" || (form.rule === "once" && form.onceType === "percent") ? "percent" : form.rule === "varies" ? "variable" : "fixed";
    const amt = form.amount.trim() ? keypadToDecimal(form.amount.trim()) : null;
    const pct = form.percent.trim() ? Number(form.percent) : null;
    const day = form.dueDay.trim() ? Number(form.dueDay) : null;
    if (amountType === "fixed" && !amt) return "Enter the amount";
    if (amountType === "percent" && (!pct || pct <= 0 || pct > 100)) return "Enter a percent between 1 and 100";
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) return "Due day is a date from 1 to 31";
    const upi = form.destId ? "" : form.upi.trim().toLowerCase();
    if (upi && !UPI_ID.test(upi)) return "Enter a UPI ID like name@okicici";
    return {
      name: form.name.trim(),
      kind: form.kind,
      amount_type: amountType,
      amount: amountType === "percent" ? null : amt,
      percent: amountType === "percent" ? String(pct) : null,
      category_slug: form.slug,
      covers_rest: form.kind === "allowance" && form.coversRest,
      dest_account_id: form.destId,
      default_account_id: form.fromId,
      due_day: day,
      payee_upi: upi || null,
      payee_name: upi ? form.payeeName.trim() || null : null,
    };
  }

  function run(call: () => Promise<unknown>) {
    action.mutate(call as never, {
      onSuccess: () => {
        tapHaptic("success");
        onClose();
      },
      onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't save."),
    });
  }

  function save() {
    if (!f) return;
    const body = fields(f);
    if (typeof body === "string") return setError(body);
    setError(null);
    const repeat = f.rule !== "once";
    if (!line) {
      return run(() => api.monthPlan.addLine(ym.year, ym.month, { ...body, name: body.name!, category_slug: body.category_slug!, repeat }));
    }
    const update = (scope: "month" | "future") =>
      run(() => api.monthPlan.updateLine(ym.year, ym.month, line.id, { ...body, scope, repeat: repeat === line.repeats ? undefined : repeat }));
    // Only ask when it matters: the line repeats and stays repeating.
    if (line.repeats && repeat) {
      Alert.alert("Change for which months?", undefined, [
        { text: `Only ${month}`, onPress: () => update("month") },
        { text: `${month} and later`, onPress: () => update("future") },
        { text: "Cancel", style: "cancel" },
      ]);
    } else update(repeat ? "future" : "month");
  }

  function remove() {
    if (!line) return;
    const del = (alsoFuture: boolean) => run(() => api.monthPlan.deleteLine(ym.year, ym.month, line.id, alsoFuture));
    if (line.repeats) {
      Alert.alert(`Remove ${line.name}?`, "Payments already made stay in Activity.", [
        { text: `Only from ${month}`, onPress: () => del(false) },
        { text: "From now on", style: "destructive", onPress: () => del(true) },
        { text: "Cancel", style: "cancel" },
      ]);
    } else {
      Alert.alert(`Remove ${line.name} from ${month}?`, "Payments already made stay in Activity.", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => del(false) },
      ]);
    }
  }

  const amountType = f ? (f.rule === "percent" || (f.rule === "once" && f.onceType === "percent") ? "percent" : f.rule === "varies" ? "variable" : "fixed") : "fixed";

  return (
    <Sheet
      visible={Boolean(target)}
      onClose={onClose}
      title={line ? `Edit ${line.name}` : `Add to ${month}`}
      tall
      headerRight={
        line ? (
          <PressableScale accessibilityLabel="Remove" onPress={remove} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
            <Icon name="trash" size={18} color={palette.negative} />
          </PressableScale>
        ) : null
      }
    >
      {f ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 18, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
          <TextField label="Name" value={f.name} onChangeText={(t) => set({ name: t })} placeholder="e.g. Rent" maxLength={80} />

          <View style={{ gap: 8 }}>
            <Segmented<LineKind>
              value={f.kind}
              onChange={(v) => set({ kind: v })}
              options={[
                { value: "bill", label: "Bill" },
                { value: "allowance", label: "Allowance" },
              ]}
            />
            <Txt variant="caption" tone="faint">
              {f.kind === "bill" ? "Paid once, like rent or EMI." : "Money set aside and spent through the month, like groceries."}
            </Txt>
          </View>

          <View style={{ gap: 8 }}>
            <Txt variant="caption">Next month</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {RULES.map((r) => (
                <Chip key={r.value} label={r.label} selected={f.rule === r.value} onPress={() => set({ rule: r.value })} />
              ))}
            </View>
            <Txt variant="caption" tone="faint">
              {RULES.find((r) => r.value === f.rule)?.hint}
            </Txt>
          </View>

          {f.rule === "once" ? (
            <Segmented<"fixed" | "percent">
              value={f.onceType}
              onChange={(v) => set({ onceType: v })}
              options={[
                { value: "fixed", label: "Amount" },
                { value: "percent", label: "% of salary" },
              ]}
            />
          ) : null}

          {amountType === "percent" ? (
            <TextField label="Percent of salary" value={f.percent} onChangeText={(t) => set({ percent: t.replace(/[^0-9.]/g, "") })} keyboardType="decimal-pad" placeholder="10" />
          ) : (
            <TextField
              label={amountType === "variable" ? `${month} amount (₹, fill when you know it)` : "Amount (₹)"}
              value={f.amount}
              onChangeText={(t) => set({ amount: t.replace(/[^0-9.]/g, "") })}
              keyboardType="decimal-pad"
              placeholder={line?.last_month_amount ? `Last month ${toNumber(line.last_month_amount)}` : "0"}
            />
          )}

          <View style={{ gap: 10 }}>
            <Txt variant="caption">Category</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {expenseCats.map((c) => (
                <Chip key={c.slug} icon={c.icon} label={c.name} selected={c.slug === f.slug} onPress={() => set({ slug: c.slug })} />
              ))}
            </ScrollView>
          </View>

          {f.kind === "allowance" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyMedium">Counts everything else</Txt>
                <Txt variant="caption">For Misc: all spending not covered by another item</Txt>
              </View>
              <Toggle value={f.coversRest} onChange={(v) => set({ coversRest: v })} />
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            <Txt variant="caption">Move the money to (your bucket account)</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip label="Don't move" selected={f.destId === null} onPress={() => set({ destId: null })} />
              {accounts
                .filter((a) => a.account_type !== "credit")
                .map((a) => (
                  <Chip key={a.id} icon={accountIcon(a.account_type)} label={accountLabel(a, false)} selected={a.id === f.destId} onPress={() => set({ destId: a.id })} />
                ))}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Txt variant="caption">{f.destId ? "Usually moved from" : "Usually paid from"}</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip label="Ask each time" selected={f.fromId === null} onPress={() => set({ fromId: null })} />
              {accounts
                .filter((a) => a.id !== f.destId)
                .map((a) => (
                  <Chip key={a.id} icon={accountIcon(a.account_type)} label={accountLabel(a, false)} selected={a.id === f.fromId} onPress={() => set({ fromId: a.id })} />
                ))}
            </View>
          </View>

          {f.destId ? null : (
            <View style={{ gap: 10 }}>
              <TextField
                label="Pay to UPI ID (optional)"
                value={f.upi}
                onChangeText={(t) => set({ upi: t.replace(/\s/g, "") })}
                placeholder="e.g. 98xxxxxx@ybl"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                maxLength={100}
              />
              {f.upi.trim() ? (
                <TextField label="Their name (optional)" value={f.payeeName} onChangeText={(t) => set({ payeeName: t })} placeholder="Shown in your UPI app" maxLength={80} />
              ) : (
                <Txt variant="caption" tone="faint">
                  With a UPI ID, Pay opens your UPI app with the amount filled in.
                </Txt>
              )}
            </View>
          )}

          <TextField label="Due day (optional)" value={f.dueDay} onChangeText={(t) => set({ dueDay: t.replace(/[^0-9]/g, "") })} keyboardType="number-pad" placeholder="e.g. 5" maxLength={2} error={error} />
          <Button size="lg" icon="check" label={line ? "Save" : `Add to ${month}`} loading={action.isPending} onPress={save} />
        </ScrollView>
      ) : null}
    </Sheet>
  );
}

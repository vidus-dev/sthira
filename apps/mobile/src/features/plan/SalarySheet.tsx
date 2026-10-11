import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { api } from "../../api/client";
import { usePlanAction } from "../../api/hooks";
import type { MonthPlan } from "../../api/types";
import { ApiError } from "../../core/api/ApiError";
import { dayHeader, parseDay, type YearMonth } from "../../core/format/dates";
import { formatINR, keypadToDecimal, toNumber } from "../../core/format/money";
import { GUTTER } from "../../theme/tokens";
import { Button, TextField } from "../../ui/controls";
import { ListRow } from "../../ui/ListRow";
import { Money } from "../../ui/Money";
import { tapHaptic } from "../../ui/PressableScale";
import { Sheet } from "../../ui/Sheet";
import { Txt } from "../../ui/Txt";
import { useQuickAdd } from "../add/QuickAddContext";
import { monthWord } from "./planText";

/** Which salary the month's % items use: the salary entries, or an amount set by hand. */
export function SalarySheet({ visible, plan, ym, onClose }: { visible: boolean; plan: MonthPlan | undefined; ym: YearMonth; onClose: () => void }) {
  const { open } = useQuickAdd();
  const action = usePlanAction(ym);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const month = monthWord(ym.year, ym.month);
  const prev = monthWord(ym.month === 1 ? ym.year - 1 : ym.year, ym.month === 1 ? 12 : ym.month - 1);

  useEffect(() => {
    if (!visible) return;
    setText(plan?.salary.override ? String(toNumber(plan.salary.override)) : "");
    setError(null);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function setOverride(value: string | null) {
    action.mutate(() => api.monthPlan.update(ym.year, ym.month, { salary_override: value }), {
      onSuccess: () => {
        tapHaptic("success");
        onClose();
      },
      onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't save."),
    });
  }

  const salary = plan?.salary;
  return (
    <Sheet visible={visible} onClose={onClose} title={`Salary for ${month}`}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        <Txt variant="label" style={{ lineHeight: 20 }}>
          Salary entered on the last day of {prev} or during {month} sets {month}'s % items.
        </Txt>
        {salary?.entries.length ? (
          <View>
            {salary.entries.map((e, i) => (
              <ListRow key={i} icon="salary" title="Salary" subtitle={dayHeader(parseDay(e.date))} right={<Money value={e.amount} tone="positive" />} height={54} />
            ))}
          </View>
        ) : (
          <Button variant="outline" icon="plus" label="Add salary entry" onPress={() => { onClose(); open({ kind: "income" }); }} />
        )}
        <TextField
          label="Or use this amount (₹)"
          value={text}
          onChangeText={(t) => setText(t.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          placeholder={salary ? String(toNumber(salary.auto)) : "0"}
          error={error}
        />
        <Button size="lg" icon="check" label="Use this amount" loading={action.isPending} onPress={() => {
          const d = keypadToDecimal(text.trim());
          if (!d) return setError("Enter the salary amount");
          setOverride(d);
        }} />
        {salary?.override ? (
          <Button variant="ghost" label={`Use salary entries (${formatINR(salary.auto)})`} onPress={() => setOverride(null)} />
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

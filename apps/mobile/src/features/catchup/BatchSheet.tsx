import { useEffect, useMemo, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAccounts, useCategories, useCategoryMap, useRecentTransactions } from "../../api/hooks";
import { enqueue } from "../../api/outbox";
import { dayHeader, monoDay } from "../../core/format/dates";
import { usePalette } from "../../theme/ThemeProvider";
import { fonts, GUTTER } from "../../theme/tokens";
import { Calendar, withTimeOf } from "../../ui/Calendar";
import { Button, Chip } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { Icon } from "../../ui/Icon";
import { ListRow } from "../../ui/ListRow";
import { Money } from "../../ui/Money";
import { PressableScale, tapHaptic } from "../../ui/PressableScale";
import { Sheet } from "../../ui/Sheet";
import { Txt } from "../../ui/Txt";
import { accountIcon, accountLabel, categoryIcon, categoryName } from "../shared";
import { categoryHistory } from "../sms/drafts";
import { parseBatch } from "./batch";

const LAST_ACCOUNT_KEY = "sthira.lastAccount";

/** Several entries typed as text, one per line (or comma), all on one day. */
export function BatchSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const palette = usePalette();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const categoryMap = useCategoryMap();
  const { data: recent = [] } = useRecentTransactions();
  const [text, setText] = useState("");
  const [day, setDay] = useState(() => new Date());
  const [picking, setPicking] = useState(false);
  const [fallbackId, setFallbackId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setText("");
    setDay(new Date());
    setPicking(false);
    AsyncStorage.getItem(LAST_ACCOUNT_KEY)
      .catch(() => null)
      .then((last) => setFallbackId(accounts.find((a) => a.id === last)?.id ?? accounts.find((a) => a.is_default)?.id ?? accounts[0]?.id ?? null));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const learned = useMemo(() => {
    // Single words learned from past notes ("swiggy" → Food delivery).
    const m = new Map<string, string>();
    for (const [k, v] of categoryHistory(recent)) if (!k.includes(" ")) m.set(k, v);
    return m;
  }, [recent]);
  const lines = useMemo(() => parseBatch(text, accounts, categories, learned), [text, accounts, categories, learned]);
  const ready = lines.filter((l) => l.amount && (l.accountId ?? fallbackId));
  const byId = new Map(accounts.map((a) => [a.id, a]));

  function save() {
    if (!ready.length) return;
    const base = withTimeOf(day, new Date());
    enqueue(
      ...ready.map((l, i) => ({
        kind: "tx" as const,
        body: {
          account_id: (l.accountId ?? fallbackId)!,
          amount: (l.kind === "expense" ? -l.amount! : l.amount!).toFixed(2),
          category_slug: l.categorySlug ?? (l.kind === "expense" ? "other" : "other-income"),
          description: l.note,
          // Keep the typed order within the day.
          occurred_at: new Date(base.getTime() + i * 1000).toISOString(),
        },
      }))
    );
    tapHaptic("success");
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Type several" tall>
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 8, gap: 14 }} keyboardShouldPersistTaps="handled">
        <EdgeCard radius={16} padding={0} innerStyle={{ padding: 14 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            placeholder={"swiggy 450 hdfc\nmilk 60 cash\nauto 80\n+85000 salary"}
            placeholderTextColor={palette.textFaint}
            selectionColor={palette.text}
            style={{ minHeight: 110, color: palette.text, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, textAlignVertical: "top" }}
            accessibilityLabel="Entries, one per line"
          />
        </EdgeCard>
        <Txt variant="caption" style={{ lineHeight: 18 }}>
          One per line or comma: what, amount, and the account if it isn't the usual one. Start with + for money in.
        </Txt>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <PressableScale onPress={() => setPicking(!picking)}>
            <EdgeCard radius={13} padding={0} innerStyle={{ height: 30, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="calendar" size={12} color={palette.textMuted} strokeWidth={1.8} />
              <Txt variant="tag" style={{ letterSpacing: 0.6 }}>
                {dayHeader(day) === "Today" || dayHeader(day) === "Yesterday" ? dayHeader(day).toUpperCase() : monoDay(day)}
              </Txt>
            </EdgeCard>
          </PressableScale>
          <Txt variant="caption">for all of these</Txt>
        </View>
        {picking ? (
          <EdgeCard radius={20} padding={12}>
            <Calendar
              value={day}
              onChange={(d) => {
                setDay(d);
                setPicking(false);
              }}
            />
          </EdgeCard>
        ) : null}

        <View style={{ gap: 10 }}>
          <Txt variant="caption">Otherwise paid from</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {accounts.map((a) => (
              <Chip key={a.id} label={accountLabel(a, false)} icon={accountIcon(a.account_type)} selected={a.id === fallbackId} onPress={() => setFallbackId(a.id)} />
            ))}
          </View>
        </View>

        {lines.length ? (
          <View>
            {lines.map((l, i) => {
              const acc = byId.get((l.accountId ?? fallbackId) ?? "");
              return (
                <ListRow
                  key={`${i}-${l.raw}`}
                  icon={categoryIcon(categoryMap, l.categorySlug ?? "dots")}
                  title={l.note || categoryName(categoryMap, l.categorySlug ?? "uncategorized")}
                  subtitle={l.amount ? `${categoryName(categoryMap, l.categorySlug ?? "uncategorized")} · ${acc ? accountLabel(acc, false) : "No account"}` : `No amount in “${l.raw}”`}
                  dim={!l.amount}
                  right={l.amount ? <Money value={l.kind === "expense" ? -l.amount : l.amount} signed tone={l.kind === "income" ? "positive" : "text"} /> : null}
                />
              );
            })}
          </View>
        ) : null}

        <Button
          size="lg"
          icon="check"
          label={ready.length ? `Add ${ready.length} ${ready.length === 1 ? "entry" : "entries"}` : "Add entries"}
          disabled={!ready.length}
          onPress={save}
        />
      </ScrollView>
    </Sheet>
  );
}

import { useMemo, useState } from "react";
import { RefreshControl, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAccountsWithPending, useCategoryMap, useHousehold, useMonthTransactions, usePendingTransactions, withPending } from "../../api/hooks";
import type { Transaction } from "../../api/types";
import {
  currentMonth,
  dayHeader,
  dayKey,
  monthName,
  monthTag,
  sameMonth,
  shiftMonth,
  timeLabel,
  type YearMonth,
} from "../../core/format/dates";
import { formatINR, toNumber } from "../../core/format/money";
import { usePalette } from "../../theme/ThemeProvider";
import { fonts, GUTTER } from "../../theme/tokens";
import { Chip } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { Icon } from "../../ui/Icon";
import { EmptyState, Rise, Skeleton, TAB_BAR_SPACE } from "../../ui/layout";
import { Avatar, IconCircle } from "../../ui/ListRow";
import { Money } from "../../ui/Money";
import { PressableScale } from "../../ui/PressableScale";
import { Txt } from "../../ui/Txt";
import { useQuickAdd } from "../add/QuickAddContext";
import { accountLabel, categoryIcon, categoryName, isAdjustment, isLocalOnly, memberName, txTitle } from "../shared";

type Filter = "all" | "expense" | "income" | "transfer";
type Item =
  | { type: "header"; key: string; title: string; spent: number }
  | { type: "row"; key: string; tx: Transaction; pair?: Transaction };

export function MonthSwitcher({ month, onChange }: { month: YearMonth; onChange: (m: YearMonth) => void }) {
  const palette = usePalette();
  const atCurrent = sameMonth(month, currentMonth());
  return (
    <EdgeCard radius={17} padding={0} innerStyle={{ height: 34, flexDirection: "row", alignItems: "center" }}>
      <PressableScale accessibilityLabel="Previous month" onPress={() => onChange(shiftMonth(month, -1))} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
        <Icon name="chevronLeft" size={14} color={palette.textMuted} strokeWidth={2} />
      </PressableScale>
      <Txt variant="tag" color={palette.text} style={{ letterSpacing: 0.9, minWidth: 64, textAlign: "center" }}>
        {monthTag(month)}
      </Txt>
      <PressableScale
        accessibilityLabel="Next month"
        disabled={atCurrent}
        onPress={() => onChange(shiftMonth(month, 1))}
        style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
      >
        <Icon name="chevronRight" size={14} color={palette.textMuted} strokeWidth={2} />
      </PressableScale>
    </EdgeCard>
  );
}

export function ActivityScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { open } = useQuickAdd();
  const [month, setMonth] = useState<YearMonth>(currentMonth());
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const txq = useMonthTransactions(month);
  const { data: accounts = [] } = useAccountsWithPending();
  const pending = usePendingTransactions();
  const { data: household } = useHousehold();
  const categoryMap = useCategoryMap();

  const { items, stickyIndices, spent, received, moved } = useMemo(() => {
    const rows = withPending(txq.data, pending, month);
    const legsByTransfer = new Map<string, Transaction[]>();
    for (const t of rows) {
      if (t.transfer_id) legsByTransfer.set(t.transfer_id, [...(legsByTransfer.get(t.transfer_id) ?? []), t]);
    }
    const q = search.trim().toLowerCase();
    const visible = rows.filter((t) => {
      // A transfer shows once, as its outgoing leg.
      if (t.transfer_id && toNumber(t.amount) > 0 && (legsByTransfer.get(t.transfer_id)?.length ?? 0) > 1) return false;
      const kind: Filter = t.transfer_id ? "transfer" : toNumber(t.amount) < 0 ? "expense" : "income";
      if (filter !== "all" && filter !== kind) return false;
      if (!q) return true;
      const acc = accounts.find((a) => a.id === t.account_id);
      return [txTitle(t, categoryMap), categoryName(categoryMap, t.category_slug), acc?.display_name ?? "", t.notes ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const out: Item[] = [];
    const sticky: number[] = [];
    let currentDay = "";
    let spentTotal = 0;
    let receivedTotal = 0;
    let movedTotal = 0;
    for (const t of visible) {
      const d = new Date(t.occurred_at);
      const k = dayKey(d);
      if (k !== currentDay) {
        currentDay = k;
        sticky.push(out.length);
        out.push({ type: "header", key: `h${k}`, title: dayHeader(d), spent: 0 });
      }
      const header = out[sticky[sticky.length - 1]] as Extract<Item, { type: "header" }>;
      const amount = toNumber(t.amount);
      if (t.transfer_id) movedTotal += Math.abs(amount);
      else if (isAdjustment(t)) {
        // A balance correction isn't spending or income.
      } else {
        if (amount < 0) {
          header.spent += -amount;
          spentTotal += -amount;
        } else receivedTotal += amount;
      }
      const pair = t.transfer_id ? legsByTransfer.get(t.transfer_id)?.find((l) => l.id !== t.id) : undefined;
      out.push({ type: "row", key: t.id, tx: t, pair });
    }
    return { items: out, stickyIndices: sticky, spent: spentTotal, received: receivedTotal, moved: movedTotal };
  }, [txq.data, pending, month, filter, search, accounts, categoryMap]);

  const header = (
    <View style={{ paddingTop: insets.top + 14 }}>
      <Rise>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: GUTTER }}>
          <Txt variant="title">Activity</Txt>
          <MonthSwitcher month={month} onChange={setMonth} />
        </View>
      </Rise>
      <Rise delay={90} style={{ paddingHorizontal: GUTTER, marginTop: 20 }}>
        <Txt variant="tag">
          {monthName(month).toUpperCase()} ·{" "}
          {filter === "income" ? "MONEY IN" : filter === "transfer" ? "MOVED BETWEEN ACCOUNTS" : "SPENT"}
        </Txt>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 18, marginTop: 8 }}>
          <Money
            value={filter === "income" ? received : filter === "transfer" ? moved : spent}
            size={40}
            weight="light"
            tone={filter === "income" ? "positive" : "text"}
          />
          {filter === "all" && received > 0 ? (
            <Txt variant="label" tone="positive" tabular style={{ marginBottom: 6 }}>
              +{formatINR(received)} in
            </Txt>
          ) : null}
        </View>
      </Rise>
      <Rise delay={180} style={{ paddingHorizontal: GUTTER, marginTop: 18, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 44, borderRadius: 14, paddingHorizontal: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline }}>
          <Icon name="search" size={17} color={palette.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search notes, categories, accounts"
            placeholderTextColor={palette.textFaint}
            selectionColor={palette.text}
            accessibilityLabel="Search"
            style={{ flex: 1, color: palette.text, fontFamily: fonts.regular, fontSize: 14 }}
          />
          {search ? (
            <PressableScale accessibilityLabel="Clear search" onPress={() => setSearch("")} hitSlop={8}>
              <Icon name="x" size={15} color={palette.textMuted} />
            </PressableScale>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["all", "expense", "income", "transfer"] as Filter[]).map((f) => (
            <Chip key={f} label={f === "all" ? "All" : f === "expense" ? "Spent" : f === "income" ? "Income" : "Transfers"} selected={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>
      </Rise>
      <View style={{ height: 8 }} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <FlashList
        data={items}
        keyExtractor={(i) => i.key}
        getItemType={(i) => i.type}
        stickyHeaderIndices={stickyIndices}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }}
        refreshControl={<RefreshControl refreshing={txq.isRefetching} onRefresh={() => txq.refetch()} tintColor={palette.textMuted} colors={[palette.text]} progressBackgroundColor={palette.surfaceRaised} />}
        ListEmptyComponent={
          txq.isLoading ? (
            <View style={{ paddingHorizontal: GUTTER, gap: 14, marginTop: 10 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} width="100%" height={52} radius={14} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="list"
              title={search || filter !== "all" ? "Nothing matches" : `No entries in ${monthName(month)}`}
              body={search || filter !== "all" ? "Try a different search or filter." : "Tap + to add an expense, income or transfer."}
            />
          )
        }
        renderItem={({ item }) =>
          item.type === "header" ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 6, backgroundColor: palette.bg }}>
              <Txt variant="tag" style={{ letterSpacing: 1.1 }}>
                {item.title.toUpperCase()}
              </Txt>
              {item.spent > 0 ? (
                <Txt variant="tag" tabular>
                  −{formatINR(item.spent)}
                </Txt>
              ) : null}
            </View>
          ) : (
            <TxRow
              tx={item.tx}
              pair={item.pair}
              accountName={(id) => accountLabel(accounts.find((a) => a.id === id))}
              who={memberName(household?.members, item.tx.user_id)}
              showWho={(household?.members.length ?? 1) > 1}
              title={item.tx.transfer_id ? "Transfer" : txTitle(item.tx, categoryMap)}
              icon={categoryIcon(categoryMap, item.tx.category_slug)}
              category={categoryName(categoryMap, item.tx.category_slug)}
              onPress={() => (isLocalOnly(item.tx) ? undefined : open({ edit: item.tx }))}
            />
          )
        }
      />
    </View>
  );
}

function TxRow({
  tx,
  pair,
  accountName,
  who,
  showWho,
  title,
  icon,
  category,
  onPress,
}: {
  tx: Transaction;
  pair?: Transaction;
  accountName: (id: string) => string;
  who: string | null;
  showWho: boolean;
  title: string;
  icon: string;
  category: string;
  onPress: () => void;
}) {
  const palette = usePalette();
  const amount = toNumber(tx.amount);
  const isTransfer = Boolean(tx.transfer_id);
  const subtitle = isTransfer
    ? `${accountName(tx.account_id)} → ${pair ? accountName(pair.account_id) : "…"}`
    : `${tx.description?.trim() && tx.description.trim() !== category ? `${category} · ` : ""}${accountName(tx.account_id)}`;
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={{ paddingHorizontal: GUTTER }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13, minHeight: 64, borderBottomWidth: 1, borderBottomColor: palette.hairline, opacity: isLocalOnly(tx) ? 0.6 : 1 }}>
        <IconCircle name={icon} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Txt variant="bodyMedium" numberOfLines={1}>
            {title}
          </Txt>
          <Txt variant="caption" numberOfLines={1}>
            {isLocalOnly(tx) ? `Waiting to sync · ${subtitle}` : subtitle}
          </Txt>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Money value={isTransfer ? Math.abs(amount) : amount} signed={!isTransfer} tone={isTransfer ? "muted" : amount > 0 ? "positive" : "text"} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {tx.monthly_payment_id ? <Icon name="plan" size={11} color={palette.due} strokeWidth={1.8} /> : null}
            <Txt variant="tag" size={9.5} tone="faint">
              {timeLabel(new Date(tx.occurred_at)).toUpperCase()}
            </Txt>
            {showWho && who ? <Avatar name={who} size={16} /> : null}
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

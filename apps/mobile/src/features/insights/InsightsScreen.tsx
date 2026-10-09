import { useMemo, useState } from "react";
import { View } from "react-native";
import { useCategoryMap, useHousehold, useMonthSummary } from "../../api/hooks";
import type { MonthSummary } from "../../api/types";
import { currentMonth, monthName, sameMonth, shiftMonth, type YearMonth } from "../../core/format/dates";
import { formatINR, toNumber } from "../../core/format/money";
import { usePalette } from "../../theme/ThemeProvider";
import { GUTTER } from "../../theme/tokens";
import { GrowBar } from "../../ui/charts";
import { EdgeCard } from "../../ui/EdgeCard";
import { Icon } from "../../ui/Icon";
import { EmptyState, Rise, Screen, Skeleton } from "../../ui/layout";
import { Avatar } from "../../ui/ListRow";
import { Money } from "../../ui/Money";
import { PressableScale } from "../../ui/PressableScale";
import { Txt } from "../../ui/Txt";
import { MonthSwitcher } from "../activity/ActivityScreen";
import { categoryName, memberName } from "../shared";

const BAR_TONES_DARK = ["#F2F2F2", "#D0D0D0", "#ADADAD", "#8C8C8C", "#6E6E6E", "#5A5A5A"];
const BAR_TONES_LIGHT = ["#0A0A0A", "#333333", "#555555", "#777777", "#999999", "#AAAAAA"];

/** One plain-language observation, computed from the numbers (no AI yet). */
function noticeFor(
  s: MonthSummary,
  prev: MonthSummary | undefined,
  names: (slug: string) => string,
  isCurrent: boolean
): string | null {
  const top = s.expense_by_category[0];
  const spent = toNumber(s.expense_total);
  if (!top || spent <= 0) return null;
  if (!isCurrent && prev) {
    let best: { slug: string; change: number; now: number } | null = null;
    for (const c of s.expense_by_category) {
      const before = toNumber(prev.expense_by_category.find((p) => p.slug === c.slug)?.total);
      if (before < 500) continue;
      const change = (toNumber(c.total) - before) / before;
      if (!best || Math.abs(change) > Math.abs(best.change)) best = { slug: c.slug, change, now: toNumber(c.total) };
    }
    if (best && Math.abs(best.change) >= 0.1) {
      const dir = best.change < 0 ? "down" : "up";
      return `${names(best.slug)} was ${dir} ${Math.round(Math.abs(best.change) * 100)}% from ${monthName({ year: prev.year, month: prev.month })}, at ${formatINR(best.now)}.`;
    }
  }
  const share = Math.round((toNumber(top.total) / spent) * 100);
  const perDay = spent / Math.max(1, s.as_of_day);
  return `${names(top.slug)} is ${share}% of spending${isCurrent ? " so far" : ""}. You spend about ${formatINR(perDay)} a day on average.`;
}

export function InsightsScreen() {
  const palette = usePalette();
  const [month, setMonth] = useState<YearMonth>(currentMonth());
  const [expanded, setExpanded] = useState(false);
  const summary = useMonthSummary(month);
  const prev = useMonthSummary(shiftMonth(month, -1));
  const { data: household } = useHousehold();
  const categoryMap = useCategoryMap();
  const tones = palette.scheme === "dark" ? BAR_TONES_DARK : BAR_TONES_LIGHT;
  const isCurrent = sameMonth(month, currentMonth());

  const s = summary.data;
  const spent = toNumber(s?.expense_total);
  const cats = s?.expense_by_category ?? [];
  const maxCat = toNumber(cats[0]?.total) || 1;
  const visible = expanded ? cats : cats.slice(0, 5);
  const rest = cats.slice(5).reduce((sum, c) => sum + toNumber(c.total), 0);
  const prevSame = toNumber(s?.previous.expense_to_same_day);
  const diff = prevSame - spent;
  const members = household?.members ?? [];

  const notice = useMemo(
    () => (s ? noticeFor(s, prev.data, (slug) => categoryName(categoryMap, slug), isCurrent) : null),
    [s, prev.data, categoryMap, isCurrent]
  );

  return (
    <Screen withTabBar refreshing={summary.isRefetching} onRefresh={() => summary.refetch()}>
      <Rise>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: GUTTER }}>
          <Txt variant="title">Insights</Txt>
          <MonthSwitcher month={month} onChange={setMonth} />
        </View>
      </Rise>

      <Rise delay={90} style={{ paddingHorizontal: GUTTER, marginTop: 24 }}>
        <Txt variant="tag" style={{ letterSpacing: 1.3 }}>
          {monthName(month).toUpperCase()}
          {isCurrent && s ? ` · FIRST ${s.as_of_day} DAY${s.as_of_day === 1 ? "" : "S"}` : ""}
        </Txt>
        <View style={{ marginTop: 10 }}>
          {s ? <Money value={spent} size={50} weight="light" /> : <Skeleton width={200} height={50} />}
        </View>
        {s && prevSame > 0 ? (
          <Txt variant="label" style={{ marginTop: 11 }} tabular>
            <Txt variant="label" tone={diff >= 0 ? "positive" : "negative"} tabular>
              {formatINR(Math.abs(diff))} {diff >= 0 ? "less" : "more"}
            </Txt>{" "}
            than {isCurrent ? "this point in" : ""} {monthName({ year: s.previous.year, month: s.previous.month })}
          </Txt>
        ) : null}
      </Rise>

      {s && cats.length === 0 ? (
        <EmptyState icon="pie" title={`No spending in ${monthName(month)}`} body="Entries you add show up here, grouped by category." />
      ) : null}

      {cats.length ? (
        <Rise delay={180} style={{ paddingHorizontal: GUTTER, marginTop: 20 }}>
          {visible.map((c, i) => (
            <View key={c.slug} style={{ paddingVertical: 10, gap: 9 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Txt variant="body" style={{ flex: 1 }} numberOfLines={1}>
                  {categoryName(categoryMap, c.slug)}
                </Txt>
                <Txt variant="tag" tone="faint" tabular>
                  {((toNumber(c.total) / (spent || 1)) * 100).toFixed(1)}%
                </Txt>
                <Txt variant="body" tabular style={{ minWidth: 76, textAlign: "right" }}>
                  {formatINR(c.total)}
                </Txt>
              </View>
              <GrowBar fraction={toNumber(c.total) / maxCat} color={tones[Math.min(i, tones.length - 1)]} delay={450 + i * 70} />
            </View>
          ))}
          {cats.length > 5 ? (
            <PressableScale onPress={() => setExpanded((e) => !e)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 }}>
              <Txt variant="label">{expanded ? "Show fewer" : `${cats.length - 5} more categories`}</Txt>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                {expanded ? null : (
                  <Txt variant="label" tabular>
                    {formatINR(rest)}
                  </Txt>
                )}
                <Icon name={expanded ? "chevronDown" : "chevronRight"} size={13} color={palette.textMuted} strokeWidth={2} />
              </View>
            </PressableScale>
          ) : null}
        </Rise>
      ) : null}

      {s && spent > 0 && members.length > 1 ? (
        <Rise delay={260} style={{ marginHorizontal: GUTTER, marginTop: 14 }}>
          <EdgeCard radius={18} padding={16}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Txt variant="bodyMedium" size={13}>
                Who spent
              </Txt>
              <Txt variant="tag">{monthName(month, false).toUpperCase()}</Txt>
            </View>
            <View style={{ flexDirection: "row", gap: 3, height: 6, marginTop: 12 }}>
              {s.by_member.map((m, i) => (
                <View key={m.user_id} style={{ flex: Math.max(toNumber(m.expense), 1), borderRadius: 3, backgroundColor: i === 0 ? palette.text : palette.scheme === "dark" ? "#3F3F3F" : "#BDBDB9" }} />
              ))}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
              {s.by_member.map((m) => (
                <View key={m.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <Avatar name={memberName(members, m.user_id)} size={20} />
                  <Txt variant="label" tone="text">
                    {memberName(members, m.user_id)}
                  </Txt>
                  <Txt variant="label" tabular>
                    {formatINR(m.expense)}
                  </Txt>
                </View>
              ))}
            </View>
          </EdgeCard>
        </Rise>
      ) : null}

      {s && toNumber(s.income_total) > 0 ? (
        <Rise delay={320} style={{ marginHorizontal: GUTTER, marginTop: 12 }}>
          <EdgeCard radius={18} padding={16}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Txt variant="bodyMedium" size={13}>
                Income
              </Txt>
              <Money value={s.income_total} tone="positive" />
            </View>
            {s.income_by_category.map((c) => (
              <View key={c.slug} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                <Txt variant="label">{categoryName(categoryMap, c.slug)}</Txt>
                <Txt variant="label" tabular>
                  {formatINR(c.total)}
                </Txt>
              </View>
            ))}
          </EdgeCard>
        </Rise>
      ) : null}

      {notice ? (
        <Rise delay={380} style={{ marginHorizontal: GUTTER, marginTop: 12 }}>
          <EdgeCard radius={20} padding={16}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Icon name="sparkle" size={14} color={palette.due} strokeWidth={1.7} />
              <Txt variant="tag" style={{ letterSpacing: 1.6 }}>
                STHIRA NOTICED
              </Txt>
            </View>
            <Txt variant="body" style={{ marginTop: 9, lineHeight: 21 }}>
              {notice}
            </Txt>
          </EdgeCard>
        </Rise>
      ) : null}
    </Screen>
  );
}

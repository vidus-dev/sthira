import { useMemo, useState } from "react";
import { View } from "react-native";
import { monthName, shiftMonth, startOfDay, type YearMonth } from "../core/format/dates";
import { usePalette } from "../theme/ThemeProvider";
import { fonts } from "../theme/tokens";
import { Icon } from "./Icon";
import { PressableScale } from "./PressableScale";
import { Txt } from "./Txt";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

type Props = {
  value: Date;
  onChange: (day: Date) => void;
  /** Days after this can't be picked (entries are for things that happened). */
  maxDate?: Date;
};

/** A month grid in the Onyx style: today ringed, the chosen day filled. */
export function Calendar({ value, onChange, maxDate = new Date() }: Props) {
  const palette = usePalette();
  const [shown, setShown] = useState<YearMonth>({ year: value.getFullYear(), month: value.getMonth() + 1 });
  const today = startOfDay(new Date()).getTime();
  const selected = startOfDay(value).getTime();
  const max = startOfDay(maxDate).getTime();
  const atMax = shown.year * 12 + shown.month >= maxDate.getFullYear() * 12 + maxDate.getMonth() + 1;

  const cells = useMemo(() => {
    const first = new Date(shown.year, shown.month - 1, 1);
    const days = new Date(shown.year, shown.month, 0).getDate();
    const blanks = first.getDay();
    return [
      ...Array.from({ length: blanks }, () => null),
      ...Array.from({ length: days }, (_, i) => new Date(shown.year, shown.month - 1, i + 1)),
    ];
  }, [shown]);

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <PressableScale accessibilityLabel="Previous month" onPress={() => setShown(shiftMonth(shown, -1))} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Icon name="chevronLeft" size={16} color={palette.textMuted} strokeWidth={2} />
        </PressableScale>
        <Txt variant="bodyMedium" size={14}>
          {monthName(shown)} {shown.year}
        </Txt>
        <PressableScale
          accessibilityLabel="Next month"
          disabled={atMax}
          onPress={() => setShown(shiftMonth(shown, 1))}
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="chevronRight" size={16} color={palette.textMuted} strokeWidth={2} />
        </PressableScale>
      </View>
      <View style={{ flexDirection: "row" }}>
        {WEEKDAYS.map((d, i) => (
          <Txt key={i} variant="tag" tone="faint" style={{ width: `${100 / 7}%`, textAlign: "center" }}>
            {d}
          </Txt>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
        {cells.map((day, i) => {
          if (!day) return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 42 }} />;
          const t = day.getTime();
          const isSelected = t === selected;
          const disabled = t > max;
          return (
            <View key={t} style={{ width: `${100 / 7}%`, height: 42, alignItems: "center", justifyContent: "center" }}>
              <PressableScale
                accessibilityLabel={day.toDateString()}
                accessibilityState={{ selected: isSelected, disabled }}
                disabled={disabled}
                haptic="selection"
                onPress={() => onChange(day)}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSelected ? palette.inverseBg : "transparent",
                  borderWidth: t === today && !isSelected ? 1 : 0,
                  borderColor: palette.textMuted,
                }}
              >
                <Txt
                  allowFontScaling={false}
                  tabular
                  style={{ fontFamily: isSelected ? fonts.semibold : fonts.regular, fontSize: 14 }}
                  color={isSelected ? palette.inverseText : disabled ? palette.textFaint : palette.text}
                >
                  {day.getDate()}
                </Txt>
              </PressableScale>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Keep the time of day of ``base`` (or now) on a newly picked day. */
export function withTimeOf(day: Date, base: Date = new Date()): Date {
  const next = new Date(day);
  next.setHours(base.getHours(), base.getMinutes(), 0, 0);
  return next;
}

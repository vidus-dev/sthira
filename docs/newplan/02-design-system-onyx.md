# Design system — Onyx

Approved mockups: <https://claude.ai/artifact/84FuvAF4zS6oX97U8gTugA>

Onyx is premium through **restraint**: black, white and greys, large thin numerals,
hairline edges, and colour only when it means something. If a screen starts to look
colourful, it has drifted.

## Principles

1. **Monochrome first.** Two accents only, both semantic:
   champagne = something is due; soft green = money coming in / doing better than usual.
   Over-budget warnings use a muted coral, sparingly.
2. **Numbers are the hero.** Big amounts in a thin weight, tabular figures, the `₹` and
   paise smaller and dimmer than the rupees.
3. **Few things per screen**, generous spacing, aligned to a 4-pt grid.
4. **Motion explains, never decorates.** Things rise into place, lines draw, numbers
   roll. No bouncing, glowing or pulsing for its own sake.
5. **Every touch answers.** Light haptic on taps, a success haptic on save.

## Colour tokens

| Token | Dark (default) | Light ("Porcelain") | Use |
|---|---|---|---|
| `bg` | `#000000` | `#FAFAF9` | Screen background |
| `surface` | `#0A0A0B` | `#FFFFFF` | Cards, sheets |
| `surfaceRaised` | `#141414` | `#F2F2F0` | Keypad press, segmented control track |
| `hairline` | `#161616` | `#E7E7E4` | Dividers |
| `edgeFrom` / `edgeTo` | `rgba(255,255,255,.22)` → `.02` | `rgba(0,0,0,.10)` → `.03` | Gradient card edge |
| `text` | `#F2F2F2` | `#0A0A0A` | Primary text, active icons |
| `textMuted` | `#7C7C7C` | `#6B6B6B` | Labels, secondary text |
| `textFaint` | `#4E4E4E` | `#A3A3A3` | Axis labels, hints |
| `accentDue` | `#D9C7A0` | `#8A6D2F` | Due dates, "due" badges, inbox dot |
| `positive` | `#A6D9B8` | `#2F7A4F` | Income, "under last month" |
| `negative` | `#E8A598` | `#B4462F` | Over budget only |
| `inverse` | `#F2F2F2` on `#000` | `#0A0A0A` on `#FFF` | Primary buttons, the `+` button, selected chips |

The theme follows the phone's setting, with a manual override in Settings.

## Typography

- **Geist** for everything; **Geist Mono** for dates, card digits (`••4821`), axis labels
  and small uppercase tags.
- Amounts use tabular figures. Rupee sign and paise at ~50% size in `textMuted` / `textFaint`.

| Style | Size / weight / tracking |
|---|---|
| Display amount | 58–60 / 300 / −4% |
| Screen title | 28 / 600 / −2.5% |
| Section title | 15–17 / 600 / −1% |
| Body | 14–15 / 400–500 |
| Label | 12–13 / 400, `textMuted` |
| Mono tag | 9.5–11 / 400, +6–14% tracking, uppercase |

## Components

- **Edge card**: `surface` fill, 1 px gradient border (`edgeFrom` top-left fading
  out), radius 16–22. Used for charts, chips, "Up next" cards, the tab bar.
- **Floating tab bar**: capsule, blurred background, edge border, 4 icons + centre `+`
  (inverse circle with a 5 px black gap ring). Active icon is `text` with a 4 px dot.
- **Row**: 58–66 px, 36 px icon circle (`#0F0F10`, hairline border), title + muted
  subtitle, amount right-aligned. Settled rows are dimmed and show a check.
- **Chips**: 36 px pills, hairline border; selected = inverse fill.
- **Segmented control**: `surfaceRaised` track, inverse selected pill.
- **Keypad**: 3×4, 26 px light digits, no key backgrounds; pressed key shows a soft circle.
- **Icons**: one line set, 1.5–1.7 px stroke, monochrome. Categories are told apart by
  icon, never by colour.

## Charts

All monochrome, drawn with `react-native-svg`, animated with Reanimated.

- **Spending pace**: cumulative line for this month (solid white), last month (dashed
  grey), forecast to month end (dotted with a faint cone). Today marked with a dot.
- **Monthly plan dial**: 60 watch-bezel ticks lit up to % settled, a thin inner arc.
- **Category bars**: 3 px bars, white fading to grey by rank, % in mono.
- **Who spent**: one split bar, white (you) / dark grey (wife).

## Motion

Built on **Reanimated** (runs on the UI thread, 60–120 fps) and **Gesture Handler**.

| Moment | Motion |
|---|---|
| Screen enters | Sections rise 12–14 px + blur-to-sharp, staggered ~100 ms, `ease-out-expo` |
| Balance appears / changes | Odometer: each digit rolls into place, left to right |
| Charts | Lines draw in (~1.6 s), forecast fades in after |
| Quick-add sheet | Slides up with a spring (iOS-style curve), background dims |
| Save | Success haptic, sheet closes, new row slides into the list |
| Plan item settled | Row dims, check draws, dial ticks advance; all settled → subtle celebration |
| Taps | Scale to 0.97 + light haptic |

Respect the phone's "reduce motion" setting: show final states without animation.

## Libraries (installed with `npx expo install` so versions match the Expo SDK)

`react-native-reanimated` · `react-native-worklets` · `react-native-gesture-handler` ·
`react-native-svg` · `expo-blur` · `expo-haptics` · `expo-font` +
`@expo-google-fonts/geist` + `@expo-google-fonts/geist-mono` · `@shopify/flash-list` ·
`@tanstack/react-query` · `@react-native-async-storage/async-storage` ·
`expo-local-authentication` (app lock).

## Screen specs (match the mockups)

- **Home**: header (avatars, "Our home", date in mono; `Ask` and inbox buttons) →
  balance (odometer) with change vs last month → Spent / Income / Safe today strip →
  Spending pace card → Up next (horizontal cards) → tab bar.
- **Quick add**: sheet over dimmed Home; Expense/Income/Transfer; big amount with
  caret; note; date + person tags; recent category chips; paid-from account row;
  keypad; full-width Save with amount.
- **Monthly plan**: title + month switcher → bezel dial (settled of planned, due this
  week) → salary received card → Due / In progress / Settled sections.
- **Insights**: title + Week/Month/Year → month total vs last month → category bars →
  who spent → "Sthira noticed" card with the Ask box (enabled in Phase 7).
- **Activity**: month switcher, search; days as sticky headers with day totals; rows show
  category icon, title, account in mono, amount, who added it.

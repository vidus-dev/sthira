# Phase 1 — the core app

Goal: everything the notebook does, done better, in the Onyx design. Personal by
default, with optional sharing. No SMS or AI yet, but the data model leaves room for both.

## Features

### 1. Personal by default, sharing optional
- On sign-up you get a private household of your own; the app shows only you — no
  partner prompts, no "who spent" split.
- **Share with family** (Settings) shows an **invite code** (e.g. `K7QM-4ZTX`). The other
  person signs up, opens Settings → Share with family → "Have an invite code?", and
  enters it. From then on both see the same accounts, entries, categories and plan,
  and shared-only touches appear (household name, who added each entry, who spent).
- Joining is allowed only from a fresh account (no accounts or entries yet), so no data
  is ever merged by accident. The code can be rotated.

### 2. Accounts
- Types: **bank (savings)**, **bank (current)**, **credit card**, **cash**, **wallet**
  (Paytm/Amazon Pay etc.), **investment**.
- Each account: nickname, bank name, type, last 4 digits, opening balance, whose it is
  (me / my wife / joint).
- Balances update automatically with every entry. Credit cards show what is owed
  (negative balance).

### 3. Categories we control
- Seeded with defaults that match the notebook (Food delivery, Groceries, Vegetables,
  Non-veg, Milk, Dining out, Rent, Maintenance, Electricity, Internet, Mobile recharge,
  Loan EMI, Guru dakshina, Donations, Fuel, Transport, Shopping, Medical, Entertainment,
  Personal care, Gifts, Household items, Education, Other; income: Salary, Other income,
  Interest & refunds).
- Add, rename, change icon, reorder, archive. Archived categories stay on old entries
  but disappear from pickers.

### 4. Entries (expenses, income, transfers)
- **Quick add** sheet from the centre `+` button: amount keypad, Expense / Income /
  Transfer, recent categories first, "paid from" account, date & time (default now),
  optional note. Target: an expense saved in under 5 seconds.
- **Transfers** between our own accounts (the "buckets") are one entry with two legs;
  they never count as spending. Paying the credit-card bill is a transfer too.
- **Activity** list grouped by day with day totals, month switcher, search, filters
  (account, category, person), swipe to edit/delete.

### 5. Monthly plan (the compulsory payments)
- Items have one of three amount types:
  - **Fixed** — rent, maintenance, EMI, internet, veg, non-veg.
  - **Percent of salary** — guru dakshina 10%, donations 5%. The base is the total
    income recorded that month in the *Salary* category (configurable per item).
  - **Variable** — electricity; the amount is entered when the bill comes.
- Each item has a category, a usual "pay from" account and an optional due day.
- For any month the plan shows **Due / In progress / Settled** with the amount due,
  paid and remaining. Donations can be paid in several parts.
- **Pay** creates the expense (or a transfer to our own bucket account) and links it to
  the item for that month. An expense already added can be linked instead.

### 6. Home & Insights
- Home: household balance, spent / income / safe-to-spend today, spending pace vs last
  month with a month-end forecast, "Up next" dues, monthly plan progress.
- Insights: spending by category, who spent what, month/week/year switch.

### 7. Settings
- Profile name, household (members, invite code, join), categories, monthly plan
  items, accounts, theme (system / dark / light), app lock with fingerprint, sign out.

## Data model changes (migration `0005_households`)

New tables:

```
households(id, name, invite_code UNIQUE, currency='INR', timezone='Asia/Kolkata', created_at)

categories(id, household_id → households, slug, name, kind: expense|income,
           icon, sort_order, is_archived, created_at, updated_at)
           UNIQUE(household_id, slug)

monthly_payments(id, household_id, name, category_slug,
                 amount_type: fixed|percent|variable, amount NULL, percent NULL,
                 base_category_slug NULL (default 'salary'), default_account_id NULL,
                 due_day NULL, is_active, sort_order, notes, created_by_user_id,
                 created_at, updated_at)
```

Changed tables:

| Table | Change |
|---|---|
| `users` | + `household_id` (required), + `display_name` |
| `financial_accounts` | + `household_id`, + `owner_user_id` (NULL = joint); `account_type` adds `cash`, `wallet` |
| `ledger_transactions` | + `household_id`, + `source` (`manual` default, `sms`, `ai`), + `source_ref` (unique per household when set), + `monthly_payment_id`, + `period_month` (first day of the month the payment counts for) |
| `budget_lines` | + `household_id`; uniqueness becomes (household, category, year, month) |
| `financial_goals` | + `household_id` |

`user_id` stays on every row and now means **who created it**. All reads and writes are
scoped by `household_id`. The migration creates one household per existing user and
backfills every row, so existing data keeps working.

Categories stay referenced by `slug` (as today), so renaming a category never touches
old entries and the web app keeps working.

## API (all under `/v1`, cookie session + CSRF as today)

| Endpoint | Purpose |
|---|---|
| `GET/PATCH /household` | Household name, invite code, members |
| `POST /household/join` | Join with an invite code |
| `POST /household/invite-code` | Rotate the code |
| `PATCH /auth/me` | Set display name |
| `GET/POST /categories`, `PATCH/DELETE /categories/{id}` | Manage categories (`DELETE` archives) |
| `GET/POST /monthly-payments`, `PATCH/DELETE /monthly-payments/{id}` | Manage plan items (`DELETE` archives) |
| `GET /monthly-payments/status?year=&month=` | Due / paid / remaining per item for a month |
| `POST /monthly-payments/{id}/pay` | Pay an item (expense or transfer) and link it |
| `GET /transactions?start=&end=&category_slug=&account_id=` | Filtered entries |
| `PATCH /transactions/{id}` | Now also links/unlinks a plan item |
| `GET /summary/month?year=&month=` | Totals, by category, by day, by member, last-month pace |

Existing endpoints keep their shapes; responses only gain fields.

## Mobile app

- Upgrade Expo SDK 54 → **57** first (the Play Store Expo Go only runs the latest SDK).
- New structure under `apps/mobile/src/`: `theme/` (Onyx tokens), `ui/` (components),
  `features/<area>/` (screens + hooks), `api/` (typed clients), React Query for caching
  and instant (optimistic) updates.
- Navigation: tabs **Home · Activity · (+) · Plan · Insights**; the `+` opens the quick-add
  sheet; Settings and Accounts open from the Home header.
- Screens: Sign in / Sign up, Onboarding (name, join or create household, first
  accounts), Home, Activity, Quick add, Monthly plan (+ item editor, pay sheet),
  Insights, Accounts (+ editor), Categories, Settings.

Full visual spec: [02-design-system-onyx.md](02-design-system-onyx.md).

## Done when

- [x] Works for one person out of the box; a second person can optionally join with an
      invite code and see the same data.
- [x] Accounts of every type, including cash, with correct balances.
- [x] Categories can be added/renamed/archived; defaults match the notebook.
- [x] Monthly plan computes 10% / 5% from the month's salary and tracks partial payments.
- [x] An expense can be added in under 5 seconds from the `+` button.
- [x] Transfers between our banks never count as spending.
- [x] Home, Activity, Plan and Insights match the approved mockups (checked in the browser
      preview; smoothness and haptics to be confirmed on the phones in Phase 2).
- [x] API tests (unit + Postgres integration) pass; mobile type-check passes.

Also done: a calendar for any past date (quick add and Pay), CSV export of every entry
(Settings → Export entries, `GET /v1/export/transactions.csv`), editing or deleting a
transfer moves both sides.

Not in Phase 1 (kept for later): budgets and goals screens on mobile (the API still has
them), Week/Year views in Insights.

# Sthira — handoff: everything built, done, and still to do

**State as of 11 Oct 2026.** Read this first if you are a developer or a Claude session
picking up the project. It is meant to be complete: product context, decisions and the
owner's preferences, how every part works, how it was verified, known issues, and the
exact next steps. The other files in this folder go deeper on specific topics:

| File | Topic |
|---|---|
| [README.md](README.md) | Overview, decisions, roadmap, how to try it |
| [01-phase-1-core-app.md](01-phase-1-core-app.md) | Phase 1 spec and done-criteria |
| [02-design-system-onyx.md](02-design-system-onyx.md) | The approved visual design (Onyx) |
| [03-run-host-install.md](03-run-host-install.md) | Run locally, host (Neon + Render), install APK, daily use |
| [04-sms-auto-detection.md](04-sms-auto-detection.md) | Phase 6 plan |
| [05-ai-assistant.md](05-ai-assistant.md) | Phase 7 plan |

---

## 1. TL;DR

- **What:** Sthira, a personal money tracker for one person (the repo owner) that replaces
  a paper expense notebook. Android first. Optional sharing with family (e.g. spouse) via
  an invite code.
- **Done (Phase 1):** FastAPI backend (households, categories, monthly plan with
  10%/5%-of-salary items, summaries, CSV export) + a fully rebuilt Expo React Native app
  in the approved "Onyx" design. 165 backend tests pass (88% coverage); mobile and web
  type-check; the owner tried it on their phone via Expo Go and approved it.
- **Where:** branch **`phase-1-onyx`** on GitHub (`vidus-dev/sthira`), 4 commits on top of
  `main`. **Not merged, no PR opened yet.**
- **Hosted (9 Oct 2026):** API live at <https://sthira-api-oes4.onrender.com> (Render free,
  Singapore, deploys `phase-1-onyx` on every push) on Neon Postgres (Singapore, free).
  Expo project **@vidus-ai/sthira**; first APK build started (see §12, Phase 4).
- **Now (from 10 Oct 2026):** the APK is installed on the owner's phone and the 3–4 day
  trial (Phase 5) is running. *Then* merge `phase-1-onyx` into `main` and switch Render to
  `main`. Parked ideas waiting for a go-ahead are in §12 "Parked — discussed, not
  started". Later Phase 6 (SMS), Phase 7 (AI).
- **11 Oct 2026 — app 1.1.0 built on branch `phase-2-catchup` (not committed yet):** the
  catch-up release — bank SMS inbox (Phase 6's core, pulled forward), balance check,
  "type several", offline outbox, password recovery key, crash reports, privacy screen,
  reminders, "Update ready — Restart", keyboard-safe sheets, nightly DB backup. Needs a
  new APK. Details and release steps in §12 "Catch-up release (1.1.0)".
- **Also 11 Oct — month-by-month plan** (same branch): each month its own plan, rules for
  what carries over, bills vs allowances, bucket accounts, auto-ticking. §12
  "Month-by-month plan".
- **24 Oct — over-the-air update:** pinned Catch up / Check balances buttons, bank vs Sthira
  on Accounts, balance line on Home, Savings in Insights, card bills from SMS in Plan
  (+ 2 read-only API endpoints). §12 "Over-the-air update, 24 Oct 2026".

---

## 2. The product and the owner's requirements

### What the notebook does today (what we replace)
- Every expense, date-wise: amount, what it was for (Swiggy, rent, vegetables, …), and how
  it was paid (which bank, which credit card, or cash).
- Money moved between the owner's own banks so each bank holds one "bucket" of money.
- A set of **compulsory monthly payments**:

| Item | Amount rule |
|---|---|
| Guru dakshina | **10% of salary** |
| Donations (to different people, often in parts) | **5% of salary** |
| Rent, maintenance, loan EMI, internet | fixed |
| Vegetables, non-veg | fixed monthly amounts |
| Electricity ("current bill") | varies each month |

### Standing preferences (treat as rules)
1. **Single-person by default.** Sharing with family is an opt-in feature under
   Settings → "Share with family". Never put partner prompts in default flows, onboarding
   or empty states; never hardcode "wife"/"partner" in UI copy. Shared-only UI (household
   name, member avatars, "added by" badges, "Who spent") appears only when the household
   has more than one member. *(Owner's words: "it must be default single only".)*
2. **Onyx design: premium through restraint.** Black/white/greys, thin large numerals,
   hairline gradient edges, monochrome icons and charts. Only two accents, both semantic:
   champagne `#D9C7A0` = due, soft green `#A6D9B8` = money in / better than usual. The owner
   rejected colourful designs as looking "cheap"; "more advanced" meant smarter details,
   not more colour.
3. **Show, don't describe** when a visual decision is needed — the owner couldn't choose a style
   from text and asked to see it.
4. The owner wants the whole path explained end to end (zero → installed on phone).
5. Android app installed as an APK (no Play Store).
6. Money in INR, Indian number grouping (₹1,24,560), dates in India time.

### Decisions log
| Date | Decision | Why |
|---|---|---|
| 9 Oct | Reuse this repo, don't start over | API/auth/accounts/transactions/transfers already existed and were tested |
| 9 Oct | Household model under the hood | Every user gets a private household; sharing = joining via invite code |
| 9 Oct | Percent items use the salary recorded *that month* (category `salary`) | Amounts follow salary changes automatically |
| 9 Oct | Upgrade mobile to Expo SDK 57 | Play Store Expo Go only runs the latest SDK |
| 9 Oct | Onyx chosen (after 6 rejected options + 3 restrained directions) | See §7 |
| 9 Oct | Single by default, sharing optional | Owner feedback after seeing the first phone build |
| 9 Oct | Hosting: Neon (Postgres) + Render (API); install APK via EAS | Free/cheap for one person; no Play Store needed |
| 9 Oct | Kubernetes/Helm in `deploy/` not used | Far more than needed |
| 9 Oct | Web app (`apps/web`) kept working but not the focus | Phone first |
| Plan | Phase 6 (SMS) before Phase 7 (AI) | Auto-capture fills data; the assistant needs months of data |
| Plan | AI = Claude via read-only tool use on the server; numbers come from the DB | Exact totals, API key never in the APK |

---

## 3. Repository, branches, environment

```
.
├── apps/
│   ├── api/        FastAPI + SQLAlchemy 2 (async) + Alembic + Postgres   ← backend
│   ├── mobile/     Expo SDK 57 / React Native 0.86 / React 19.2          ← the product
│   └── web/        React 18 + Vite (secondary; kept compiling)
├── docs/newplan/   ← the plan + this handoff
├── docs/           older architecture/dev docs (partly outdated, see §11)
├── deploy/helm/    Kubernetes chart (unused for this project)
├── docker-compose.yml, Makefile, scripts/ (PowerShell dev helpers)
└── package.json    npm workspaces: apps/web, apps/mobile
```

### Git
- `main` = state before this work. **`phase-1-onyx`** (pushed) adds:
  1. `4ef5c84` docs: the plan
  2. `9570947` api: households, categories, monthly plan, summary, CSV export
  3. `03ea7de` web: regenerate API types; pin web to React 18
  4. `6e26bdc` mobile: Onyx rebuild on Expo SDK 57
  (+ the commit adding this handoff and `CLAUDE.md`)
- Open a PR: <https://github.com/vidus-dev/sthira/pull/new/phase-1-onyx>
- Remote uses an SSH alias: `git@github.com-vidus:vidus-dev/sthira.git`.
- **Old remote branches** (`develop`, `feature/sms-ingest`, `feature/sms-ingest-model-b`,
  `feature/budget-rules-engine-model-a`, `feature/production-ready`,
  `chore/platform-p0-ci-mobile`, many `dependabot/*`) come from a **rewritten older
  history — they share no commit with `main`** (local branch `backup-old-history` holds
  that history). They use an older layout (`fin-front`, `fin-backend`). Use them only as
  reference. Notably **`feature/sms-ingest`** ("SMS ingest slice — backend
  table/service/routes, parser, Android consent flow") and
  **`feature/sms-ingest-model-b`** ("user-authorized SMS bank-alert ingest v1") contain an
  earlier SMS attempt worth mining for Phase 6. Not reviewed in detail.

### This laptop (owner's Windows machine)
- Repo path: `C:\Users\Vinay\OneDrive\Desktop\finance` (inside OneDrive — big
  `node_modules` deletes/installs are slow).
- Tools: Node 24, npm 11, Python 3.11 (system) / 3.13 (API venv `apps/api/.venv`),
  Poetry 2.2, Docker Desktop. CI uses Python 3.12 and Node 20.
- Local Postgres container **`sthira-pg`** (postgres:16-alpine, port 5432, volume
  `sthira_pg`, user/pass/db `finance`), migrated to `0005_households`. It contains test
  data plus the **demo login `vinay.demo@example.com` / `demo-pass-123`** (single mode).
- `apps/api/.env` exists (gitignored) with `DATABASE_URL` for that container and a dev
  `SECRET_KEY`.

---

## 4. Backend (`apps/api`)

### 4.1 Stack and layering
FastAPI · async SQLAlchemy 2 · asyncpg · Alembic (sync, psycopg3) · Pydantic v2 ·
bcrypt · cookie sessions (Starlette `SessionMiddleware`) + CSRF header · Prometheus/OTel
(opt-in) · ruff · pytest.

`HTTP → router (app/api/v1/*.py) → service (app/modules/<area>/service.py) →
repository (optional) → models (app/models)`. Services take an **`Actor`**.

### 4.2 Auth and scoping
- Session cookie `session`: `SESSION_MAX_AGE_DAYS` (default **180**), re-issued on every
  response, so it's "signed out after 180 days without opening the app"; `Secure` in
  staging/production. The phone app's lock (below) guards the long session. `POST
  /v1/auth/register|login` return `csrf_token`; every mutating `/v1` request with a
  session must send `X-CSRF-Token`. Login is throttled.
- **`app/auth/actor.py` → `require_actor`** loads `(user_id, household_id)` for the session
  user and then commits the implicit read transaction (services open their own
  `session.begin()`). **All data queries are scoped by `household_id`**; `user_id` on rows
  now means *who created it*.
- Registration (`auth_service.create_user`) creates a household ("Our home") with the
  default categories, then the user. `UserPublic` includes `display_name`, `household_id`.

### 4.3 Data model (after migration `0005_households`)
| Table | Notes |
|---|---|
| `households` | `id, name ('Our home'), invite_code UNIQUE ('XXXX-XXXX', no 0/O/1/I), currency 'INR', timezone 'Asia/Kolkata', created_at` |
| `users` | + `household_id` (NOT NULL, FK RESTRICT), + `display_name` |
| `financial_accounts` | + `household_id`, + `owner_user_id` (NULL = joint, FK SET NULL). `account_type`: `checking`(current) \| `savings` \| `credit` \| `cash` \| `wallet` \| `investment`. Credit cards: negative balance = owed |
| `ledger_transactions` | signed `amount` (negative = out). + `household_id`, `source` (`manual`\|`sms`\|`ai`), `source_ref` (unique per household when set, **including deleted rows**), `monthly_payment_id` (FK SET NULL), `period_month` (1st of the month a payment counts for). Existing: `transfer_id`, soft-delete `deleted_at`, `category_slug` |
| `categories` | `household_id, slug, name, kind expense|income, icon, sort_order, is_archived`; UNIQUE(household, slug). Rows reference categories **by slug** |
| `monthly_payments` | `name, category_slug, amount_type fixed|percent|variable, amount, percent, base_category_slug ('salary' for percent), default_account_id, due_day, is_active, sort_order, notes, created_by_user_id` |
| `budget_lines` | + `household_id`; uniqueness now (household, category, year, month) |
| `financial_goals` | + `household_id` |
| `idempotency_keys`, `audit_events` | unchanged (user-scoped) |

Migration `0005_households` creates a household per existing user, backfills every row,
seeds default categories **plus any slugs already used**, and is reversible (tested
up → down → up on real data).

Default categories (`app/modules/households/defaults.py`, frozen copy in the migration):
food-delivery, groceries, vegetables, non-veg, milk, dining-out, rent, maintenance,
electricity, internet, mobile, loan-emi, guru-dakshina, donations, fuel, transport,
shopping, medical, entertainment, personal-care, gifts, household, education, other;
income: salary, other-income, interest-refunds. Each has an icon key the app maps to its
icon set. Reserved slugs: `transfer`, `uncategorized`.

### 4.4 Domain rules (the important behaviour)
- **Households / sharing** (`modules/households/service.py`): join by code (normalised:
  case/spaces/dash ignored). Allowed only if the joiner's current household has **no
  other members and no accounts/transactions**; their empty household is then deleted.
  Errors: unknown code → 404, otherwise → 409. Invite code can be rotated.
- **Months** (`modules/periods.py`): month boundaries computed in the household timezone
  (`zoneinfo`, `tzdata` dependency). Naive datetimes are treated as UTC.
- **Monthly plan** (`modules/monthly_payments/`):
  - due = `amount` (fixed) · `percent × income in base category that month`, rounded
    half-up to paise (percent) · optional estimate (variable).
  - income for the base = positive, non-transfer entries in `base_category_slug` whose
    `occurred_at` falls in that calendar month.
  - paid = Σ(−amount) of active entries linked with that `period_month`.
  - status: `paid` (paid ≥ due, or any payment for variable), `partial`, `due`,
    `awaiting_income` (percent item, no salary recorded yet).
  - `planned_total` = Σ max(due, paid); `settled_count`; `base_income` per slug.
  - Status includes archived items that still have a payment that month.
  - **Pay** (`POST /{id}/pay`): amount defaults to what's left (required for variable
    without estimate); `occurred_at` defaults to now; `period_month` = the given
    year/month (so October rent paid on 2 Nov counts for October). With
    `dest_account_id` it records a **transfer** to a "bucket" account and links the
    outgoing leg.
  - Linking an existing entry: `PATCH /transactions/{id}` with `monthly_payment_id`
    (null unlinks); deleting the entry un-settles the item.
- **Transfers**: amount > 0, different accounts, same currency; two legs with
  `category_slug='transfer'`. **Editing either leg** applies amount (direction kept per
  leg), date and note to both and moves both balances; category can't change. **Deleting
  either leg deletes the whole transfer.** Transfers never count as spending.
- **Summary** (`modules/summary/`): expense/income exclude transfers; `by_day` uses the
  local date (Postgres `timezone()`); `as_of_day` = today for the current month, last
  day for past, 0 for future; `previous.expense_to_same_day` compares like-for-like.
- **Import de-duplication**: `source_ref` accepted once per household, deleted rows
  included (409 otherwise) — ready for SMS hashes in Phase 6.
- **Accounts**: `owner_user_id` must be a household member. Editing `balance` sets it
  directly (no correcting entry).
- **Export**: CSV of all active entries, oldest first, local date/time, signed amounts,
  one row per transfer leg, UTF-8 BOM. Columns: Date, Time, Type (Expense/Income/
  Transfer out/Transfer in), Amount, Account, Category, Note, Added by, Monthly plan
  item, Plan month, Source.
- Audit events are written for transaction/transfer create/update/delete.
- `POST /transactions` honours `Idempotency-Key` (the app sends one per save).

### 4.5 API (all under `/v1`; OpenAPI at `/docs`)
| Area | Endpoints |
|---|---|
| Health | `GET /health/live`, `GET /health/ready` |
| Auth | `POST /auth/register {email,password,display_name?}`, `POST /auth/login`, `GET /auth/session`, `PATCH /auth/me {display_name}`, `POST /auth/logout` |
| Household | `GET /household`, `PATCH /household {name}`, `POST /household/join {invite_code}`, `POST /household/invite-code` (rotate) |
| Accounts | `GET/POST /accounts`, `GET/PATCH/DELETE /accounts/{id}` |
| Categories | `GET /categories?include_archived=`, `POST /categories {name,kind,icon}`, `PATCH /categories/{id}`, `DELETE /categories/{id}` (archives) |
| Transactions | `GET /transactions?start=&end=&category_slug=&account_id=&monthly_payment_id=&limit=` (newest first, limit ≤ 2000), `POST`, `GET/PATCH/DELETE /transactions/{id}` |
| Transfers | `POST /transfers {source_account_id,dest_account_id,amount,description?,occurred_at?,monthly_payment_id?,period_month?}` → includes both leg ids |
| Monthly plan | `GET/POST /monthly-payments`, `PATCH/DELETE /monthly-payments/{id}` (DELETE archives), `GET /monthly-payments/status?year=&month=`, `POST /monthly-payments/{id}/pay` |
| Summary | `GET /summary/month?year=&month=` |
| Export | `GET /export/transactions.csv` |
| Budgets / Goals | unchanged shapes, now household-scoped (no mobile UI) |
| Admin | `GET /admin/users`, `GET /admin/audit-events` (role `admin`) |

Errors are `application/problem+json`: `ValueError`→400, `LookupError`/`NotFoundError`→404,
`ConflictError`→409, validation→422 (`app/api/exception_handlers.py`,
`app/modules/errors.py`).

### 4.6 Tests and lint
- `cd apps/api && poetry run pytest` (coverage floor 65%, currently **88.4%**, **165
  tests**). Integration tests need a migrated Postgres at `DATABASE_URL` and are skipped
  otherwise. `poetry run ruff check app tests`.
- New tests: `tests/integration/test_households.py` (HTTP flow incl. invite/join),
  `test_categories.py`, `test_monthly_plan.py`, `test_summary_and_filters.py`,
  `test_transfer_edits_and_export.py`; `tests/unit/test_monthly_plan_rules.py`. Helpers in
  `tests/integration/conftest.py`: `create_actor`, `create_account`,
  `create_user_and_account`.
- Keep the committed OpenAPI in sync (CI checks it):
  `poetry run python scripts/export_openapi.py` then `npm run gen:api-types -w finance-tracking-app`.

### 4.7 Running and deploying
- Env vars: `DATABASE_URL` (asyncpg URL; `?ssl=require` for hosted Postgres — converted to
  `sslmode=require` for Alembic automatically), `SECRET_KEY` (≥ 32 chars outside dev),
  `ENVIRONMENT` (development|staging|production), `CORS_ORIGINS` (browsers only — native
  app doesn't need it), `RUN_MIGRATIONS_ON_START` (container), `PORT` (container),
  `LOG_LEVEL`, `METRICS_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `REDIS_URL`.
- Container: `Dockerfile` → `CMD sh scripts/start.sh` (runs `alembic upgrade head` when
  `RUN_MIGRATIONS_ON_START=true`, then uvicorn on `$PORT` with proxy headers). Verified:
  image builds, migrates and serves `/v1/health/live` in production mode.
  `.gitattributes` forces LF for `*.sh`.
- Demo data: `poetry run python scripts/seed_demo.py [--with-partner] [base_url]`
  (local only; single-person by default).

---

## 5. Mobile app (`apps/mobile`)

### 5.1 Stack
Expo SDK 57 · React Native 0.86.3 (New Architecture) · React 19.2.3 · TypeScript 6 ·
React Navigation 7 (native stack + bottom tabs with a custom tab bar) · Reanimated 4.5 +
worklets · Gesture Handler 2.32 · react-native-svg 15 · FlashList 2 · TanStack Query 5 ·
AsyncStorage · Geist + Geist Mono fonts · expo-linear-gradient, haptics,
local-authentication, file-system, sharing, splash-screen, system-ui, constants ·
react-native-web/react-dom (browser preview) · dev: `@expo/ngrok` (tunnels).
Always add native packages with `npx expo install` (keeps SDK-compatible versions).

### 5.2 File map (`src/`)
| Path | Purpose |
|---|---|
| `api/client.ts` | One HTTP client (cookie + CSRF), typed `api.*` functions for every endpoint, `newRequestId()` for Idempotency-Key, `setUnauthorizedHandler`, CSV `getText` |
| `api/types.ts` | DTOs mirroring the API |
| `api/hooks.ts` | React Query client + hooks (`useAccounts` sorted oldest-first, `useCategories`, `useCategoryMap` incl. archived, `usePlanStatus`, `useMonthSummary`, `useMonthTransactions`, `useRecentTransactions`, …) and mutations. Ledger mutations invalidate accounts/transactions/summary/plan; create/delete are **optimistic** (instant UI, rollback on error); deleting a transfer removes both legs locally |
| `auth/AuthContext.tsx` + `auth/sessionCache.ts` | session hydrate, sign in/up/out, `updateName`; sign-up sets the onboarding flag. **Offline-first start:** the last user + CSRF token are remembered (AsyncStorage `sthira.session`), so launch opens Home at once and confirms with `/auth/session` in the background. Only a 401/403 or `authenticated:false` signs out (clears session, query cache, persisted cache); offline/timeouts/5xx keep you signed in |
| `api/persist.ts` | React Query cache persisted to AsyncStorage `sthira.queryCache` (7 days, `buster` to invalidate shapes) via `PersistQueryClientProvider` in `App.tsx`; splash waits for the restore so Home shows last known numbers |
| `core/config.ts` | `EXPO_PUBLIC_API_BASE_URL`, timeout |
| `core/http/*` | fetch wrapper (timeouts, problem+json errors, 401 hook), CSRF store |
| `core/format/money.ts` | Indian grouping by hand, `formatINR`, `splitMoney`, `compactINR`, keypad parsing |
| `core/format/dates.ts` | month math, day headers ("Today", "Fri, 9 Oct"), mono tags ("FRI · 09 OCT"), relative due tags |
| `theme/tokens.ts`, `theme/ThemeProvider.tsx` | Onyx palettes (dark default, light "Porcelain"), fonts, radii; theme preference (auto/dark/light) persisted in AsyncStorage `sthira.theme` |
| `ui/*` | Design-system components: `Txt`, `Money`, `Odometer`, `EdgeCard`, `PressableScale` (+`tapHaptic`), `Icon` (one line-icon set incl. category icons), `controls` (Button, Pill, Chip, Segmented, TextField, Toggle), `layout` (Screen with top glow, `Rise` entrance, SectionLabel, EmptyState, Skeleton), `ListRow`/`IconCircle`/`Avatar`, `Sheet` (spring bottom sheet, drag-to-close), `Calendar` (+`withTimeOf`), `StackHeader`, `charts` (PaceChart, BezelDial, GrowBar, Segments, MiniRing) |
| `navigation/*` | Root stack (auth → onboarding (once) → main tabs + Accounts/Categories/PlanItems/Settings), custom floating `TabBar` with centre "+" |
| `features/add/*` | Quick-add sheet + context (`useQuickAdd().open({kind?, edit?})`) |
| `features/home/HomeScreen.tsx` | see §5.4 |
| `features/activity/ActivityScreen.tsx` | + `MonthSwitcher` (reused) |
| `features/plan/*` | Plan screen, `PaySheet`, `PlanItemsScreen` (+ editor, templates) |
| `features/insights/InsightsScreen.tsx` | |
| `features/accounts/AccountsScreen.tsx` | + editor sheet |
| `features/categories/CategoriesScreen.tsx` | + editor sheet with icon grid |
| `features/settings/*` | Settings, `SharingSheet` (invite/join), `exportEntries.ts` |
| `features/onboarding/*` | first-run screen + AsyncStorage flag `sthira.onboardingFor` |
| `features/lock/AppLock.tsx` | App lock: fingerprint/face **or phone PIN/pattern** (`getEnrolledLevelAsync`, device fallback). **On by default** when the phone has any screen lock (`sthira.appLock` = "0" turns it off). Locks at launch only for a remembered sign-in (not right after typing the password), relocks after 60 s in background |
| `features/shared.ts` | account/category labels & icons, `txTitle`, `memberName`, `firstName` |

### 5.3 Screens and behaviour
- **Sign in / Sign up** (name, email, password ≥ 8). After sign-up → **first-run setup**:
  two steps (add accounts, set up monthly plan) + a small "Have an invite code? Join
  instead" link.
- **Home**: header (your avatar + name; household name and member avatars only when
  shared) · balance **odometer** = Σ all account balances (credit cards negative) · "₹X
  saved so far in <month>" = month net · strip **Spent / Income / Safe today** ·
  **Spending pace** card (cumulative this month solid, last month dashed, forecast dotted
  with a cone, today marker + tag) · **Up next** (unpaid plan items by due date; champagne
  when due within 7 days) · **Recent** (last 6, tap to edit).
  - Safe today = `max(0, (income − spent − remaining plan dues) / days left incl. today)`,
    shown only once income exists this month.
  - Forecast = `spent + remaining plan dues + (everyday spend so far / days elapsed) × days
    remaining`, where everyday = spent − plan paid. Compared with last month's total.
- **Quick add** (centre +): Expense/Income/Transfer, keypad (long-press ⌫ clears), note,
  date tag → **calendar for any past date** (future disabled), recent categories (by use
  this month) or ALL, "Paid from" account (default: last used → default → mine → first),
  transfer "To". Save is optimistic + success haptic. Edit mode (tap any row): change
  amount/category/date/note, delete; **transfers editable** (amount/date/note; shows From
  and To).
- **Activity**: month switcher, total matching the filter (Spent / Money in / Moved), search
  (note, category, account), filters All/Spent/Income/Transfers, sticky day headers with day
  totals, FlashList; a transfer shows once (its outgoing leg); plan-linked entries show a
  plan icon; "added by" avatar only when shared.
- **Monthly plan**: month switcher, **bezel dial** (settled of planned, "N DUE THIS WEEK"),
  salary card (base for % items; tap to add salary when missing), sections **Due** (Pay /
  Enter bill pills), **In progress** (progress bar), **Settled** (collapsed). Tapping any
  item opens the **Pay sheet**: amount (prefilled with what's left), Paid out vs **Move to
  my account** (transfer to a bucket), paid-from account, **Paid on** date (calendar),
  this month's payments. "Manage plan items" → list + editor (name, Fixed / % of salary /
  Varies, amount or percent, category, usual account, due day; archive) + one-tap
  **templates** for the notebook items.
- **Insights**: month switcher, total vs same point last month, category bars (top 5,
  expandable), Who spent (only when shared), Income card, "Sthira noticed" (computed
  observation: biggest change vs last month for past months, else top-category share and
  daily average) — not AI.
- **Accounts**: net balance card, groups (Banks / Credit cards / Cash & wallets /
  Investments), editor (type chips, name, bank, last 4, balance — for cards "amount owed",
  saved negative; "Whose account" only when shared), delete.
- **Categories**: Spending/Income tabs, add/rename/change icon (icon grid)/archive.
- **Settings**: profile name · Manage (Accounts, Categories, Monthly plan items, **Share
  with family** (sheet: invite code with Share/New code, members & household name when
  shared, "Have an invite code?" join when single), **Export entries** (CSV → Android share
  sheet)) · Appearance Auto/Dark/Light · App lock · Sign out · version.

### 5.4 Design implementation notes
- Tokens in `theme/tokens.ts` match `02-design-system-onyx.md`. Fonts:
  `Geist_300Light/400Regular/500Medium/600SemiBold`, `GeistMono_400Regular/500Medium`.
- Motion: `Rise` (fade + 14 px rise, staggered, ease-out-expo), odometer digits, chart
  line draw, bezel turn-in, bar grow, sheet spring, press scale + haptics. Honors reduce
  motion. **`Rise` is disabled on web** (headless Chrome mis-renders Reanimated entering
  keyframes) — phones get it.
- App identity (`app.json`): name **Sthira**, slug `sthira`, Android package /
  iOS bundle **`app.sthira.household`**, black splash, adaptive icon on black. Icons in
  `assets/` were rendered from SVG with Chrome (an open dial with one champagne dot).

### 5.5 Running the app
- **Phone on the same Wi-Fi (Expo Go):** API with `--host 0.0.0.0`; `apps/mobile/.env`
  `EXPO_PUBLIC_API_BASE_URL=http://<laptop-ip>:8000`; `npm run mobile`; scan QR.
- **Browser preview:** API with `CORS_ORIGINS=http://localhost:8081`; `.env` →
  `http://localhost:8000` (same host so the cookie is sent); `npx expo start --web --port
  8081`. Demo login above.
- **Phone anywhere (what we used for the owner's test):** cloudflared quick tunnel to the
  API (`cloudflared tunnel --url http://127.0.0.1:8000`) + `EXPO_PUBLIC_API_BASE_URL=<that
  https URL> npx expo start --tunnel --go` (needs `@expo/ngrok`, now a devDependency). The
  `exp://….exp.direct` URL opens in Expo Go (a tappable form:
  `https://expo.dev/--/to-exp/<url-encoded exp://…>`). Run the API with a strong random
  `SECRET_KEY` while exposed; **close tunnels afterwards** (they were closed).
- Gotchas: `CI=1 expo start` disables reloads; stopping a background `expo start` can
  leave a `node` process holding port 8081 (kill it); type-check with `npx tsc --noEmit`.

---

## 6. Web app (`apps/web`) — secondary
Unchanged features (React 18, Vite, Radix, Vitest, Playwright e2e). Changes this session:
regenerated `src/lib/api/openapi.json` + `schema.d.ts`; because npm hoists the mobile app's
React 19 to the root, the web app now forces its own React 18 via `resolve.dedupe` (vite +
vitest), Vitest `server.deps.inline` for Radix, and tsconfig `paths` for `@types/react*`.
Type-check, 33 unit tests, lint and build pass. It has no UI for households, categories,
the monthly plan, etc.

---

## 7. Design history (so nobody re-litigates it)
Mockups (Claude artifact, private to the owner):
<https://claude.ai/artifact/84FuvAF4zS6oX97U8gTugA> — currently shows the approved Onyx
screens (Home, Add expense, Monthly plan, Insights).
1. First round: Midnight Luxe / Soft Aurora / Clean Minimal (each dark + light) —
   **rejected: "overly colored cheap apps"**.
2. Second round: Onyx (black, typographic), Ledger (paper + serif numerals), Graphite
   (dark grey cards + periwinkle) — **Onyx chosen**, with "make it more advanced and
   premium".
3. Onyx refined (odometer, forecast, safe-to-spend, up next, bezel dial, mono tags, AI
   entry point) — **approved: "this ui is perfect"**. The implemented app follows it; the
   AI "Ask" entry and SMS inbox button from the mockup are intentionally **not shown** until
   Phases 6–7 exist.

---

## 8. Infrastructure and CI
- `docker-compose.yml`: Postgres + API + nginx-served web on :8080.
- `.github/workflows/ci.yml` is **manual-only** (`workflow_dispatch`): web lint/test/build,
  mobile type-check, API ruff + migrations + pytest + OpenAPI drift check, docker compose
  build, Playwright e2e. **Not run on this branch yet.**
- `deploy/helm/finance-tracker` (Kubernetes) — not used.
- Hosting is set up — see §12 Phase 3/4 for the exact configuration.

---

## 9. What was done — timeline (9 Oct 2026, one long session)
1. Explored the repo; ran the baseline (88 unit tests pass; Postgres started in Docker so the
   integration tests also ran: 115 pass).
2. Agreed scope; owner clarified 10% → guru, 5% → donations, both of salary.
3. Owner asked for the plan to be saved first and for a premium UI → visual style rounds
   (see §7) → Onyx approved.
4. Wrote `docs/newplan/` (README, 01–05).
5. Backend: models, migration 0005 (tested up/down/up on live data), Actor + household
   scoping refactor of accounts/transactions/transfers/budgets/goals, households,
   categories, monthly plan, summary; tests → 157 passing.
6. Mobile: upgraded SDK 54 → 57; clean reinstall of all workspaces (stale RN 0.81 copies
   at the root); built the whole Onyx app.
7. Verified in a browser preview with Playwright screenshots against seeded demo data;
   fixed issues found (spacing glitch from web entering animations, 401s from a
   pre-mounted sheet, default account, plan card styling).
8. App name/icon/splash, `eas.json`, container start script, Docker image built and run.
9. Owner tested on their phone via Expo Go over tunnels → asked for **single by default** →
   reworked onboarding/Home/Insights/Settings + demo data; 401 → sign-in handling.
10. Fixes: calendar date picker (quick add + pay), CSV export, transfer edit/delete moves
    both legs, nested-button cleanup, Activity totals per filter.
11. Committed in 4 commits on `phase-1-onyx`, pushed; tunnels closed; local servers stopped.

---

## 10. Verification performed
| What | How | Result |
|---|---|---|
| API | pytest (unit + Postgres integration) | 165 passed, 88.4% coverage |
| Offline-first start | Web preview + Playwright with the API stopped | Home in ~0.2 s with cached data, still Home after 32 s; cookie cleared → sign-in and cache wiped |
| Migration 0005 | upgrade → downgrade → upgrade on a DB with existing users/data | clean; 24 users → 24 households, 0 orphan rows |
| Container | `docker build` + run with `RUN_MIGRATIONS_ON_START=true ENVIRONMENT=production PORT=8100` | migrated, `/v1/health/live` OK |
| Mobile | `tsc --noEmit` (strict) | 0 errors |
| Mobile UI | Expo web preview + Playwright (390×844, dark & light): every screen, save an expense, pay a plan item, edit a transfer, calendar, onboarding, settings | worked; numbers match the API |
| Android bundle | Metro Android bundle build | compiles |
| Real device | Owner used the app in Expo Go on their Android phone | approved ("this is great") |
| Web | tsc, vitest (33), eslint, vite build | pass |
| **Not verified** | an installed release APK; haptics/fingerprint/share sheet/CSV share on a real device after the latest fixes; CI workflow; web Playwright e2e; light mode on device | — |

---

## 11. Known issues, limitations, tech debt
- **Branch not merged**; no PR. CI never run on it.
- Pre-existing: `README.md`, `docs/development.md`, `docs/deployment.md`, the `Makefile`
  and the CI e2e job run `docker compose run --rm api poetry run alembic upgrade head`, but
  the API image's runtime stage has **no poetry** (only the copied `.venv`). Use
  `docker compose run --rm api alembic upgrade head` or `RUN_MIGRATIONS_ON_START=true`.
  Not fixed.
- Pre-existing: `apps/api/scripts/check_postgres.py` fails ruff (E402/I001); outside the
  linted paths.
- Top-level `README.md` and `docs/architecture.md` still describe the older generic
  platform (no households/plan/export modules).
- Python versions differ: pyproject `^3.11`, Docker/CI 3.12, local venv 3.13 (all work).
- Web app has no UI for the new features; its Playwright e2e may need updates.
- Mobile: no Budgets/Goals screens (API still has them); Insights has month view only (no
  week/year); "Sthira noticed" is rule-based; no AI "Ask" or SMS inbox yet.
- Joining a household is only possible from an **empty** account (by design; no merge).
  No "leave household" / remove member yet.
- ~~Percent items use salary received in the same calendar month~~ — month plans use
  salary from the last day of the previous month (or a hand-set amount).
- Positive non-transfer entries (refunds) count as income in summaries.
- ~~Editing an account balance overwrites it~~ — 1.1.0 records an adjustment entry.
- Web preview only: Rise entrance animations off; a button-inside-row warning was fixed by
  using visual `Pill`s.
- Render free tier sleeps after ~15 min idle (first request ~1 min). Mitigated by a
  cron-job.org ping to `/v1/health/live` every 10 min (owner's account) and the app's
  offline-first start.

---

## 12. What's left — next steps in order

### Phase 3 — host the backend — **DONE 9 Oct 2026**
Live: <https://sthira-api-oes4.onrender.com> (`/v1/health/ready` checks the DB).
- Neon: project `sthira`, AWS Asia Pacific 1 (Singapore), branch `production`, database
  `neondb`, role `neondb_owner`, **direct (unpooled)** connection.
- Render: web service `sthira-api`, Docker, branch **`phase-1-onyx`** (switch to `main`
  after merging), root `apps/api`, region Singapore, Free, health check
  `/v1/health/live`, auto-deploy on commit. Env: `DATABASE_URL`
  (`postgresql+asyncpg://…/neondb?ssl=require` — drop `sslmode` and `channel_binding`,
  asyncpg rejects them), `SECRET_KEY` (generated), `ENVIRONMENT=production`,
  `RUN_MIGRATIONS_ON_START=true`. Secrets live only in Render/Neon.

Steps used (for redoing it elsewhere):
1. Owner creates **neon.tech** (project "sthira", region Singapore/Mumbai) and
   **render.com** (sign in with GitHub) accounts.
2. Neon connection string → change scheme to `postgresql+asyncpg://` and
   `sslmode=require` → `ssl=require`.
3. Render → New Web Service → repo `vidus-dev/sthira`, branch `phase-1-onyx` (or `main`
   after merging), root `apps/api`, runtime Docker. Env: `ENVIRONMENT=production`,
   `DATABASE_URL=…`, `SECRET_KEY=<64 random chars>`, `RUN_MIGRATIONS_ON_START=true`.
4. Check `https://<name>.onrender.com/v1/health/live`; register the owner's real account.
5. Decide free vs Starter (~$7/mo, no sleep).

### Phase 4 — build and install the APK — **DONE 10 Oct 2026**
Done so far:
- Expo account `vidus-dev` (Google sign-in → log in with `npx eas-cli@latest login`,
  browser flow; the old CLI's password prompt can't work). Project **@vidus-ai/sthira**
  (owner `vidus-ai`, projectId `87e83b13-8d7d-47ee-936f-49efb3eeeb7b` in `app.json`).
- `eas.json` `preview` → `EXPO_PUBLIC_API_BASE_URL=https://sthira-api-oes4.onrender.com`,
  channel `preview`. `expo-updates` added; `runtimeVersion` policy `appVersion`;
  `updates.url` set. Android keystore generated and stored by EAS (keep using EAS
  credentials — a different key can't install over the existing app).
- Build: `npx eas-cli@latest build -p android --profile preview`.

Releasing changes afterwards:
- API: push to the branch Render deploys → auto-deploy (migrations run on start).
- App, JS-only: `cd apps/mobile && npx eas-cli@latest update --channel preview --platform android --environment preview -m "<what changed>"`.
  `EXPO_PUBLIC_API_BASE_URL` is stored as a plain-text EAS variable in the `preview`
  environment (EXPO_PUBLIC_* values are inlined at update time; check
  `dist/_expo/static/js/android/*.hbc` contains the Render URL). First update published
  10 Oct 2026 (group `ecb2dc9f-69f3-46e1-84db-16ff45147fe0`).
- App, native changes (new native module, SDK upgrade, permissions, icon/name) or a
  `version` bump in `app.json`: new `eas build` and reinstall. Bumping `version` changes
  the runtime version, so older APKs stop receiving updates.

Status:
- First APK built (build `58060c3d-230e-4c15-9bab-e0437c5a87de`) and **installed** on the
  owner's phone; the owner signed up on the hosted server.
- First over-the-air update published 10 Oct (offline-first start, 180-day session,
  app lock on by default with fingerprint or phone PIN).
- Render keep-awake: the owner set up a cron-job.org job hitting `/v1/health/live` every
  10 minutes (free; Render's 750 free hours cover one service all month).
- How updates reach the phone (explained to the owner): on each launch the app checks
  the `preview` channel for an update matching runtime `1.0.0`, downloads it in the
  background, and runs it on the **next** cold start (so: open, close fully, reopen).
  A crash on a new update rolls back to the previous one automatically.

Still to verify on the device: the fingerprint **and** phone-PIN unlock (can't be tested
in the browser preview), haptics, CSV share sheet, light mode, drag-to-close.

### Catch-up release (1.1.0) — **released 11 Oct 2026**
Committed on `phase-2-catchup` (4 commits) and fast-forwarded `phase-1-onyx`, so Render
deployed it (migrations 0006 + 0007 ran; new endpoints verified live). APK 1.1.0 built:
EAS build `d46d2a63-8796-44b9-8672-b5428f8b8337` (the Kotlin SMS module compiled).
Still to verify on the phone: SMS reading, notifications, privacy screen, keyboard fix.

Why: the owner fell 3 days behind and won't enter things one by one. Branch
`phase-2-catchup` (from `phase-1-onyx`), uncommitted at the time of writing.

What's in it:
- **Bank SMS → review inbox** (Home inbox button, champagne dot when SMS wait; Settings →
  Catch up). Native module `apps/mobile/modules/sms-inbox` (Kotlin, Expo Modules API,
  autolinked from `modules/`) reads the inbox since a timestamp; **people's numbers and
  OTPs are filtered out in native code**. `src/features/sms/parser.ts` parses HDFC / SBI /
  ICICI / Axis / Kotak style alerts and ignores dues, collect requests, autopay notices,
  offers, declined payments and statements. `drafts.ts` matches accounts by last digits
  (then bank name), suggests categories from past notes then keywords, pairs a debit and
  a same-amount credit between own accounts within 45 min into one transfer, flags likely
  duplicates of hand-entered rows, and drops SMS from before an account was added (its
  opening balance already includes them). Confirmed drafts go through the outbox with
  `source='sms'` + `source_ref` (FNV hash of sender|date|body); transfers carry both
  legs' refs (`source_ref`, `dest_source_ref`). Skips are remembered per user in
  AsyncStorage. Raw SMS text never leaves the phone; drafts aren't persisted in the
  query cache.
- **Check balances** (`ReconcileScreen`): type what each bank shows; `POST
  /v1/accounts/{id}/reconcile` records the gap as `unaccounted` spending (new default
  category, seeded by migration 0006) or as an `adjustment` (reserved slug, excluded from
  summaries/Activity totals). Shows the last SMS "Avl bal" as a hint. Blocked while the
  outbox has unsynced entries. Editing an account's balance now also records an
  adjustment instead of overwriting silently.
- **Type several** (`BatchSheet`, `batch.ts`): "swiggy 450 hdfc, milk 60 cash, +85000
  salary", one day for all, default account chips.
- **Outbox** (`src/api/outbox.ts`): every quick-add / batch / SMS entry is saved on the
  phone, sent in order with a stable Idempotency-Key, retried with backoff on
  network/5xx/401, and shown as "Waiting to sync" (balances include it). Survives restarts
  and sign-outs (sent when the same user signs in).
- **Password recovery without email:** `POST /v1/auth/recovery-key` (shown once, bcrypt
  hash stored), `POST /v1/auth/reset-password` (email + key + new password, throttled,
  key used up, signs in), `POST /v1/auth/change-password`. Sign-in → "Forgot password?";
  Settings → Sign-in → Recovery key / Change password. `UserPublic.has_recovery_key`.
- **Crash reports:** `src/core/crash.tsx` (global handler + ErrorBoundary with a calm
  restart screen) stores reports on the phone and posts them to `POST
  /v1/client-errors` (table `client_errors`, 30/user/hour); admins read `GET
  /v1/admin/client-errors`, or query the table in Neon.
- **Privacy screen** (expo-screen-capture, on by default): blank in Recent apps, no
  screenshots. Settings toggle — turn it off to take screenshots.
- **Reminders** (expo-notifications, local only): plan items 2 days before and on the due
  day at 9 AM; evening nudge (8/9/10 PM) on days with nothing added. Re-planned whenever
  the plan or entries change; tapping opens Plan / quick add.
- **Update banner:** "Update ready · Restart" once an OTA update has downloaded; also
  checks on resume (every 15 min at most).
- **Bottom sheets fit above the keyboard** (owner's bug report: the plan-item sheet slid
  under the status bar). `Sheet` measures the keyboard's top edge and limits its height.
- **Nightly backup** `.github/workflows/backup.yml`: pg_dump → gpg (AES256) → 30-day
  private artifact. Needs secrets `BACKUP_DATABASE_URL` (libpq form, `sslmode=require`)
  and `BACKUP_PASSPHRASE`. Scheduled workflows only run from the default branch, so it
  starts once merged to `main` (can be run by hand before that).
- `app.json` version **1.1.0** (new runtime → old APKs stop getting OTA updates, which is
  right: they lack the native modules), permissions `READ_SMS` + `POST_NOTIFICATIONS`,
  notification icon `assets/notification-icon.png`; `eas.json` preview `autoIncrement`.

Verified: API 174 tests pass (88%), ruff clean, migration 0006 up/down/up; mobile
`tsc` clean, `npm run test:sms -w mobile` (23 SMS samples) and `npm run test:catchup -w
mobile` (drafts, pairing, duplicates, batch parsing) pass; Android JS bundle exports;
throwaway `expo prebuild` showed the permissions in the manifest; browser preview
screenshots of Home, Catch up, Type several, Check balances, Settings, Recovery key and
Forgot password, and a batch entry synced through the outbox into Postgres. **Not
verified:** the Kotlin module compiling (no Android SDK on the laptop — EAS compiles
it), reading real SMS, notifications, privacy screen, keyboard fix on a device.

Release steps:
1. Owner says go → commit; get the API live first: merge `phase-2-catchup` into the
   branch Render deploys (or point Render at it). Migration 0006 runs on start. The new
   API is backward compatible with the 1.0.0 APK.
2. `cd apps/mobile && npx eas-cli@latest build -p android --profile preview`, install
   over the old app (same EAS keystore; data is on the server).
3. On the phone: Catch up → Allow SMS access (Android 13+: App info → ⋮ → Allow
   restricted settings first), allow notifications, create a recovery key.
4. Add the two backup secrets in GitHub.
5. Collect real bank SMS formats the parser misses and add them to
   `scripts/test-sms-parser.mjs`.

### Month-by-month plan — **released 11 Oct 2026** (same branch and APK)
Why: the owner's notebook (photos, 11 Oct) has a separate plan list per month, written
around the 5th, with ticks; items are copied month to month, some amounts change, 10%/5%
follow the salary that lands on the last day of the previous month or the 1st, and
money goes to own bucket accounts (5% → account 1234, groceries + non-veg → ICICI,
medicines → 9796). Misc is fixed for the owner but the rule is per item.

Model (migration `0007_month_plans`):
- `month_plans` (household, month, `salary_override`, `reviewed_at`) and
  `month_plan_items` (a copy per month: name, category, `kind` bill|allowance,
  `amount_type` fixed|percent|variable, amount/percent, `covers_rest`,
  `dest_account_id` = bucket, `default_account_id`, due day, `closed`, `carried_over`,
  `carried_from_id`, `template_id`). `monthly_payments` are now the **repeating rules**
  (+ `kind`, `dest_account_id`, `covers_rest`); `template_id` NULL = only this month.
- `ledger_transactions.plan_item_id` links a payment (or a transfer's outgoing leg) to
  a month line; `monthly_payment_id` + `period_month` are kept in step, so the old
  `/v1/monthly-payments/status` (used by app 1.0.0) keeps working.

Rules (`app/modules/month_plans/`):
- A month's plan is created the first time it is opened (`GET /v1/plans/{y}/{m}`, up to
  next month; months before the household existed are shown empty and not stored).
  Active rules are copied: fixed keeps its amount, variable starts blank (hint = last
  month's amount, else the rule's old estimate), percent is computed from the month's
  salary. Payments already made that month are linked: first by rule + period, then
  unlinked expenses by category to unpaid bills (rent paid on the 1st, plan on the 5th).
- Salary for month M = salary entries from the last day of M-1 up to (not incl.) the
  last day of M, or `salary_override`.
- Bills: due / partial / paid / awaiting_income / needs_amount. Allowances with a bucket:
  "paid" = moved in (linked transfers, plus unlinked transfers into that account that
  month, allocated in order); allowances without a bucket are `tracking`. Allowance
  `spent` = that category's spending (bill payments excluded); `covers_rest` = spending
  in categories no other line uses. Buckets: per account, set aside but unspent vs the
  balance → `short`.
- New expenses auto-link to the month's unpaid bill in the same category
  (`linking.auto_link_bill`, in `TransactionService.create`; covers quick add, batch,
  SMS); the app shows "Counted as October Rent · Undo" (PATCH `plan_item_id: null`).
- Edits: `scope: "month"` or `"future"` (updates the rule and later months' unpaid
  copies); `repeat: false` stops it coming back; add with `repeat`; delete with
  `also_future`; `close` = mark done; `carry` moves last month's unpaid bill into this
  month (as a one-off line) or marks it done.

App: Plan tab rebuilt (`features/plan/`: `PlanScreen`, `LineSheet` pay/move/fill amount,
`LineEditor` with the "Only October / October and later" question, `SalarySheet`,
`planText` suggestions from the notebook). Sections: ready card (Done), left from last
month, dial, salary card, To fill, Bills, Allowances (spent/left bars), Buckets (short →
Top up opens a prefilled transfer), Settled, Suggested. Home: "October plan ready · N
amounts to fill" card; Up next / Safe today / forecast read the month plan. Reminders
use it too (next month's plan is only opened from the 25th). Old `PlanItemsScreen` and
`PaySheet` removed; Settings → Monthly plan opens the Plan tab.

Verified: 4 integration scenarios in `tests/integration/test_month_plans.py` (a month
like the notebook incl. bucket shortfall, month-vs-future edits and rollover, salary
window/override/limits/scoping, HTTP + undo auto-link); full API suite 178 passed (89%);
mobile tsc clean; browser preview walkthrough with the demo account (plan ready card,
fill an amount, edit sheet, Done, add Groceries as an allowance → move ₹5,000 to the
bucket → "₹3,760 left", bucket "covered"). Ships with the server update; as an OTA on
the 1.1.0 runtime (no extra APK).

### Over-the-air update, 24 Oct 2026 (same 1.1.0 runtime, no new APK)
Why: the owner saw bank SMS in Catch up but balances didn't move. They hadn't found
the "Add N entries" button because it sat below the whole list. They then picked four
parked/new ideas to ship over the air.
- **Catch up / Check balances:** the main button is pinned at the bottom (fades over
  the list like the tab bar). Catch up adds Tick all / Untick all and "N ticked need an
  account".
- **Bank vs Sthira** (`features/sms/bankCheck.ts`): the newest SMS "Avl bal" per account
  is now **kept between scans** (AsyncStorage `sthira.sms.balances.<user>`), compared
  with Sthira's balance *at the SMS time* (today's balance − entries after it). Accounts
  shows "Matches the bank SMS" or "Bank SMS …: ₹X more/less than Sthira" with **Fix**
  (opens Check balances prefilled via route param `fill`) or "N SMS waiting". Hidden
  while the outbox has unsynced entries. Check balances' "use" hint uses the same value.
- **Balance line on Home:** `GET /v1/summary/balance-history?days=90` (one point per
  local day, rebuilt backwards from current balances; accounts count from their
  `created_at` day; deleted entries excluded; corrections included). Thin sparkline
  under the total + "↗ ₹X since <day>" ("No change" when flat); the last point is replaced
  by the Home total so they always agree. Tap → Accounts.
- **Savings in Insights:** `GET /v1/summary/savings?months=12`: per month income
  (salary by the plan's window, so salary on the 30th counts for the next month, plus
  other income in the calendar month), expense, net; leading empty months dropped.
  This differs from the Income card (calendar month), and the card says so.
- **Card bills from SMS:** `parseCardBill` (statements and "is due" reminders: total, min,
  due date, last digits). The scan reads 45 days back the first time
  (`sthira.sms.billsSince.<user>`) and keeps bills until 60 days past due
  (`sthira.sms.cardBills.<user>`). Plan shows "CARD BILLS FROM SMS" for bills due in that
  month whose card isn't already a line's destination. **Add** creates a one-off bill
  (`category_slug: "transfer"`, `dest_account_id` = the card), so paying it is a transfer
  to the card, and card payments confirmed from SMS settle it through the bucket pool.
  **Skip** is remembered per user. The pay sheet for a card line offers only "Pay"
  (no "Paid out").

Verified: API 182 tests pass (89%), ruff clean; `tests/integration/test_balance_history_and_savings.py`
(day-by-day totals incl. transfer/deleted/opened-later, salary window, HTTP);
mobile tsc clean; `test:sms` 33 cases (10 new card-bill cases); browser preview
screenshots of Home (line with test entries), Insights savings, Accounts, Check
balances bar. **Not verified on a device:** the SMS-based parts (bank line, card bills).

Released: API deployed via `phase-1-onyx` (fast-forwarded to `phase-2-catchup`, both at
`a7ad257`); OTA on channel `preview`, runtime 1.1.0, update group
`580e56d4-3ef7-4598-95f4-5b37ecd1c16f` (bundle checked to use the Render URL).

### Pay plan items with UPI, 24 Oct 2026 (OTA + migration 0008)
- Migration `0008_plan_payee`: `payee_upi` (≤100) and `payee_name` (≤80) on
  `monthly_payments` and `month_plan_items`; copied rule → month line, on carry, and with
  "from now on" edits (`_SHARED`). `LineFields` validates the UPI ID (lower-cased,
  `handle@provider`; empty clears it).
- App: the line editor has "Pay to UPI ID" + name (only when the money isn't moved to a
  bucket). The pay sheet then shows **Pay ₹X with UPI**: it opens a `upi://pay?pa=…&pn=…&am=…&cu=INR&tn=<item - month>`
  link with `Linking.openURL`. Android shows the installed UPI apps, or opens the one set as
  default. Back in Sthira: "Did ₹X to <name> go through?" → **Yes, record it** (the normal
  plan pay call) or No. "Already paid · just record it" stays available.
- Limits: no payment result comes back (that would need a native module and a new APK),
  and some UPI apps (notably GPay) may refuse person-to-person payments started from
  another app. The later bank SMS is flagged "Already added?" by Catch up's duplicate check.
- Next APK idea: an in-app picker (PhonePe / GPay / Paytm / BHIM…) opening the chosen app
  directly and reading its result (`startActivityForResult`), so no "did it go through?".

### Phase 5 — real use
Owner adds real accounts with today's balances, salary, monthly plan (templates), and
runs it next to the notebook for a few weeks. Collect feedback.

### Phase 6 — SMS auto-detection (see 04-sms-auto-detection.md)
Custom Expo module (Kotlin) reading the SMS inbox since last scan (`READ_SMS`; needs a
custom/dev build, not Expo Go), per-bank parsers, "To review" inbox, match accounts by last
4 digits, pair self-transfers, `source='sms'` + `source_ref` hash (already supported
server-side). Mine `origin/feature/sms-ingest*` for prior work.

### Phase 7 — AI assistant (see 05-ai-assistant.md)
`POST /v1/assistant/ask` using the Anthropic Python SDK tool runner, model
`claude-opus-5-5` by default, read-only tools over the existing services, API key only on
the server, then the "Ask" entry on Home/Insights.

### Parked — discussed, not started (10 Oct 2026)
The owner asked about these and said to note them and wait. **Don't build them until the
owner says so** — the 3–4 day trial may change what they want.

1. **Total balance history on Home** (owner asked "would you show the total balance
   history of all the banks in home page?"). Proposed answer, not yet approved:
   - *Home:* a thin sparkline under the big total-balance number showing the last 3
     months, plus one line like "↗ ₹12,400 since July" (green if up). Glanceable only:
     Home already has the Spending pace chart, Up next and Recent, so no second big chart.
   - *Tap it:* a full view (or an Insights section) with 1M / 3M / 6M / 1Y ranges, drag to
     read the total on any date, and the split by bank.
   - *Same definition as the big number:* the sum of all accounts (credit cards
     negative), so the last point equals the Home total.
   - *Server (planned):* `GET /v1/summary/balance-history?days=N` in
     `app/modules/summary`, returning one point per local day (household timezone).
     Rebuild backwards from current balances: end-of-day(D) = current balance − Σ active
     entries with local date > D. Transfers net to zero; deleted entries are excluded. An
     account contributes 0 before its `created_at` day, so history starts the day
     accounts were added. Limits: direct balance edits on an account aren't recorded, so
     they show as if the balance had always been that way; entries backdated before an
     account was created are ignored.
2. **Savings section** (owner asked "is there anything specific that shows my savings
   across all banks?"). Today's answer:
   - The Home total covers all accounts; Accounts shows per-account balances grouped by
     type; "saved so far in <month>" = income − spending, with transfers excluded.
   - Missing: a monthly savings trend (6–12 months), a savings rate (% of salary), and a
     per-bank split chart. The trend and rate can use `GET /summary/month` per month (or a
     small multi-month endpoint); the split uses accounts.
3. ~~**Apply updates on the first open**~~ — done in 1.1.0 as the "Update ready ·
   Restart" banner. Original note: Options offered: a small
   "Update ready — Restart" prompt (recommended) or a silent restart once the download
   finishes (`expo-updates` `checkForUpdateAsync`/`fetchUpdateAsync`/`reloadAsync`). No
   answer yet; the current behaviour stays.

### Backlog / nice to have
Merge `phase-1-onyx` (+ run CI) · fix the poetry-in-container docs/CI issue · refresh
top-level README/architecture docs · budgets/goals screens · Week/Year insights · leave
household / remove member · "salary from last month" option for % items · account
balance adjustment entries · recurring reminders/notifications · web UI for the new
features.

---

## 13. Rules for whoever continues
- Read §2 preferences. Single-user first; gate shared UI on `members.length > 1`.
- Keep Onyx restraint; colour only with semantic meaning.
- Backend: scope every query by `actor.household_id`; put rules in services, add
  integration tests against Postgres; keep `ruff` clean; regenerate OpenAPI + web types
  when the API changes.
- Mobile: add native deps via `npx expo install`; type-check; reuse `ui/` components and
  tokens; numbers come from the API, never invent them client-side beyond the documented
  Home formulas.
- Never put secrets/API keys in the app; store only last-4 digits of accounts.
- Commit/push only when the owner asks; work on a branch, not `main`.

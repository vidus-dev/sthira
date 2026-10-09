# Sthira — handoff: everything built, done, and still to do

**State as of 9 Oct 2026.** Read this first if you are a developer or a Claude session
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
  in the approved "Onyx" design. 164 backend tests pass (88% coverage); mobile and web
  type-check; the owner tried it on their phone via Expo Go and approved it.
- **Where:** branch **`phase-1-onyx`** on GitHub (`vidus-dev/sthira`), 4 commits on top of
  `main`. **Not merged, no PR opened yet.**
- **Hosted (9 Oct 2026):** API live at <https://sthira-api-oes4.onrender.com> (Render free,
  Singapore, deploys `phase-1-onyx` on every push) on Neon Postgres (Singapore, free).
  Expo project **@vidus-ai/sthira**; first APK build started (see §12, Phase 4).
- **Next:** owner installs the APK and uses it for 3–4 days (Phase 5), *then* merge
  `phase-1-onyx` into `main` and switch Render to `main`. Later Phase 6 (SMS), Phase 7 (AI).

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
- Session cookie `session` (14 days; `Secure` in staging/production). `POST
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
- `cd apps/api && poetry run pytest` (coverage floor 65%, currently **88.4%**, **164
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
| `auth/AuthContext.tsx` | session hydrate, sign in/up/out, `updateName`; on any 401 → back to sign-in; sign-up sets the onboarding flag |
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
| `features/lock/AppLock.tsx` | fingerprint/face lock (AsyncStorage `sthira.appLock`, relock after 60 s in background) |
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
| API | pytest (unit + Postgres integration) | 164 passed, 88.4% coverage |
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
- Percent items use salary received in the **same calendar month**; if salary lands on
  the 30th/31st the user picks the month when paying (no "use last month's salary"
  option).
- Positive non-transfer entries (refunds) count as income in summaries.
- Editing an account balance overwrites it (no adjusting entry/audit).
- Web preview only: Rise entrance animations off; a button-inside-row warning was fixed by
  using visual `Pill`s.
- Render free tier sleeps after ~15 min idle (first request ~1 min).

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

### Phase 4 — build and install the APK — **build started 9 Oct 2026**
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
- App, JS-only: `cd apps/mobile && EXPO_PUBLIC_API_BASE_URL=https://sthira-api-oes4.onrender.com npx eas-cli@latest update --channel preview -m "<what changed>"`
  (EXPO_PUBLIC_* vars are inlined at update time, so set it).
- App, native changes (new native module, SDK upgrade, permissions, icon/name) or a
  `version` bump in `app.json`: new `eas build` and reinstall. Bumping `version` changes
  the runtime version, so older APKs stop receiving updates.

Still to do:
1. Install the APK on the owner's phone; sign up with the real email (hosted DB starts
   empty; the demo account exists only locally).
2. Test on device: fingerprint lock, haptics, CSV share sheet, light mode, drag-to-close.

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

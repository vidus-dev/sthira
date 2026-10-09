# Sthira — household money app: the plan

This folder is the single source of truth for turning this repo into my money app,
replacing the expense notebook. It's personal by default; I can optionally share it
with family (e.g. my wife) so we both see and add to the same accounts.

| Doc | What's in it |
|---|---|
| [01-phase-1-core-app.md](01-phase-1-core-app.md) | Phase 1 features, data model, API, migration, screens, done-criteria |
| [02-design-system-onyx.md](02-design-system-onyx.md) | The approved "Onyx" look: colours, type, components, motion, screen specs |
| [03-run-host-install.md](03-run-host-install.md) | Phases 2–5: run on the laptop, put it online, install on both phones, daily use |
| [04-sms-auto-detection.md](04-sms-auto-detection.md) | Phase 6: detect bank transactions from SMS into a review inbox |
| [05-ai-assistant.md](05-ai-assistant.md) | Phase 7: ask questions about our money in plain language |

Approved UI mockups (Home, Add expense, Monthly plan, Insights):
<https://claude.ai/artifact/84FuvAF4zS6oX97U8gTugA>

## What we're replacing

Today every expense goes into a notebook, date-wise:

- the amount, what it was for (Swiggy, rent, vegetables, …) and how it was paid
  (which bank, which credit card, or cash);
- money moved between our own banks so each bank holds one "bucket" of money;
- a set of compulsory monthly payments that must be made every month.

The monthly compulsory payments:

| Item | Amount |
|---|---|
| Guru dakshina | **10% of salary** |
| Donations (to different people, often in parts) | **5% of salary** |
| Rent, maintenance, loan EMI, internet | fixed amounts |
| Vegetables, non-veg | fixed monthly amounts |
| Electricity ("current bill") | varies every month |

## Decisions so far

| Decision | Choice | Why |
|---|---|---|
| Start over or reuse? | **Reuse this repo** | API, auth, accounts, transactions, transfers, budgets already exist and are tested |
| Who uses it | **One person by default**; sharing is optional | Settings → Share with family gives an invite code; whoever joins sees the same accounts, and each entry records who added it |
| Platform | **Android app**, installed as an APK (no Play Store) | Faster, free, and allows reading bank SMS later |
| Backend hosting | Neon (Postgres, free) + Render (API) | Cheap/free for two users; see 03 |
| Percent items | Computed from the **salary recorded that month** | 10% / 5% update automatically when salary changes |
| Look & feel | **Onyx** — restrained black/white, one champagne accent | Approved after comparing six directions; colourful options read as cheap |
| Web app (`apps/web`) | Kept working, not the focus | Phones first |
| Kubernetes/Helm (`deploy/`) | Not used | Far more than two users need |

## Roadmap

| Phase | What | Status |
|---|---|---|
| 1 | Core app: household, cash accounts, own categories, monthly plan, quick add, premium Onyx UI | **Built** (Oct 2026) — see below |
| 2 | Run everything on the laptop; try it on the phone over home Wi-Fi | **Next** |
| 3 | Put the backend online (Neon + Render) | |
| 4 | Build the APK and install on both phones | |
| 5 | Daily use: set up accounts, categories, monthly plan; use alongside the notebook for a few weeks | |
| 6 | Auto-detect transactions from bank SMS (review inbox) | Future |
| 7 | AI assistant: ask anything about our money | Future |

Phase 6 comes before 7 on purpose: auto-detection fills in data with the least effort,
and the assistant is only as useful as the months of data behind it.

## Phase 1 — what was built

- **API** (`apps/api`): households with invite codes, household-scoped accounts /
  entries / budgets / goals, editable categories (seeded from the notebook), monthly
  plan with fixed / % of salary / variable items, pay-by-expense or pay-by-transfer,
  month summary for Home and Insights, SMS-ready de-duplication. Migration
  `0005_households` moves existing data into households. 160 tests, 88% coverage.
- **Mobile** (`apps/mobile`): upgraded to Expo SDK 57; rebuilt in the Onyx design —
  Home (rolling balance, spending pace + forecast, up next), Activity, Quick add,
  Monthly plan (bezel dial, pay sheet), Insights, Accounts, Categories, Plan items,
  Settings (optional sharing via invite code, theme, fingerprint lock, CSV export),
  sign-up onboarding. A calendar for entering any past date (to copy the notebook),
  editable transfers (both sides move together). Light and dark themes. New app name,
  icon and splash.
- **Ready for hosting:** the API container can apply migrations on start
  (`RUN_MIGRATIONS_ON_START=true`) and listens on `$PORT`; `apps/mobile/eas.json` has
  the APK build profile.

### Try it on the laptop (browser preview)

The phone app also runs in a browser, which is the quickest way to look around:

```bash
# 1. database + API (from the repo root)
docker start sthira-pg            # or the docker run line in 03-run-host-install.md
cd apps/api && poetry run alembic upgrade head
CORS_ORIGINS=http://localhost:8081 poetry run uvicorn app.main:app --port 8000
# 2. (optional, new terminal) demo data: two logins sharing one household
cd apps/api && poetry run python scripts/seed_demo.py
# 3. the app (new terminal)
cd apps/mobile && npx expo start --web --port 8081
```

Open <http://localhost:8081> and sign in as `vinay.demo@example.com` / `demo-pass-123`.
The browser preview skips the entrance animations; the phone shows them.

## Ground rules that keep later phases cheap

- Every transaction records **who added it** and **how** (`manual`, `sms`, `ai`), plus a
  reference for SMS so the same message is never imported twice.
- Totals (spend by category, monthly plan status, balances) are computed **once, on the
  server**. The app screens and the future AI assistant use the same numbers.
- The app stores only account nicknames, bank names, balances and the **last 4 digits**.
  Never full account/card numbers, net-banking passwords, OTPs, CVVs or UPI PINs.

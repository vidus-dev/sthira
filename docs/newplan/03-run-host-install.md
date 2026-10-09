# Phases 2–5 — from laptop to both phones

Commands are for this Windows laptop (PowerShell or Git Bash), run from the repo root
`C:\Users\Vinay\OneDrive\Desktop\finance` unless noted.

## Phase 2 — run it on the laptop, try it on the phone

**One-time installs** (already present on this laptop as of Oct 2026): Node.js ≥ 20,
Python 3.11+ with Poetry, Docker Desktop. On the phone: **Expo Go** from the Play Store.

1. Start a local database (Docker):
   ```bash
   docker run -d --name sthira-pg -e POSTGRES_USER=finance -e POSTGRES_PASSWORD=finance \
     -e POSTGRES_DB=finance -p 5432:5432 -v sthira_pg:/var/lib/postgresql/data postgres:16-alpine
   ```
   Next time just `docker start sthira-pg`.
2. Set up and start the API:
   ```bash
   cd apps/api
   poetry install --with dev
   poetry run alembic upgrade head
   poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   `--host 0.0.0.0` lets the phone reach the laptop. Allow Python through Windows
   Firewall on **private** networks when asked.
3. Find the laptop's Wi-Fi address: `ipconfig` → "IPv4 Address", e.g. `192.168.1.23`.
4. Point the app at it — `apps/mobile/.env`:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.23:8000
   ```
5. Start the app:
   ```bash
   npm install
   npm run mobile
   ```
   Scan the QR code with Expo Go (phone and laptop on the same Wi-Fi).

Use it next to the notebook for a few days. Anything confusing → note it, we fix it.

## Phase 3 — put the backend online

Two free services. Data lives in the database service, not on the laptop.

### 3a. Database: Neon (free Postgres)
1. Sign up at <https://neon.tech>, create a project "sthira", region **Singapore** or
   **Mumbai** if offered (closest to India).
2. Copy the connection string. It looks like
   `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
3. Our API wants the async driver form: change `postgresql://` to
   `postgresql+asyncpg://` and `sslmode=require` to `ssl=require`. The API converts it
   back for migrations automatically.

### 3b. API: Render
1. Push this repo to GitHub (private repo is fine).
2. Sign up at <https://render.com> → **New → Web Service** → pick the repo.
3. Settings: Root directory `apps/api`, Runtime **Docker**, Instance type **Free**
   (or Starter ≈ $7/month to avoid sleep — see below).
4. Environment variables:

   | Key | Value |
   |---|---|
   | `ENVIRONMENT` | `production` |
   | `DATABASE_URL` | the `postgresql+asyncpg://…?ssl=require` string |
   | `SECRET_KEY` | 64 random characters (`python -c "import secrets;print(secrets.token_urlsafe(48))"`) |
   | `RUN_MIGRATIONS_ON_START` | `true` (applies database updates on every deploy) |
5. Deploy. Check `https://<name>.onrender.com/v1/health/live` returns OK.

**Free tier caveat:** the free API sleeps after ~15 minutes idle; the first request
afterwards takes up to a minute. Fine for trying it out; switch to Starter if it annoys us.

**Costs:** Neon free ₹0 · Render free ₹0 (or ~₹600/month always-on) · EAS builds ₹0.

### Backups
Neon keeps a short restore history on the free plan. Also take a CSV export at month
end (Settings → Export entries → save to Google Drive).

## Phase 4 — build the APK and install on both phones

1. Install the build tool and log in (free Expo account):
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. In `apps/mobile/eas.json` the `preview` profile builds an installable **APK** and
   bakes in the server address (`EXPO_PUBLIC_API_BASE_URL=https://<name>.onrender.com`).
3. Build in Expo's cloud (~10–20 min):
   ```bash
   cd apps/mobile
   eas build -p android --profile preview
   ```
4. Open the download link on each phone → install. Android asks to allow installing
   from this source (Chrome / Files) once.
5. **Updates:** screen/logic changes ship instantly with `eas update --branch preview`
   (the app picks them up on next launch). Only new native features (like SMS reading
   in Phase 6) need a new APK.

Keep the Expo account safe: it holds the app's signing key; Android only installs
updates signed with the same key.

## Phase 5 — daily use

First-time setup (≈ 15 minutes, do it together):
1. Sign up. (Optional: to share with family, send them the code from Settings → Share
   with family; they sign up and enter it before adding anything.)
2. Add every account with **today's balance**: each bank, each credit card (amount
   owed), cash in hand, wallets.
3. Check categories; add anything the notebook uses that's missing.
4. Monthly plan: add rent, maintenance, EMI, internet, veg, non-veg (fixed), electricity
   (variable), guru dakshina 10% and donations 5% (percent of salary), each with its
   usual pay-from account and due day.
5. When salary arrives, add it as Income → Salary. The 10% / 5% amounts appear.

Habit: add expenses as they happen (`+` → amount → category → save). Tick off plan items
with **Pay**. Keep the notebook in parallel for the first month, then compare.

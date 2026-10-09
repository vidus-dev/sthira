# Sthira — notes for Claude sessions

Read [docs/newplan/HANDOFF.md](docs/newplan/HANDOFF.md) first. It has the full context:
product, the owner's preferences, architecture, what's built, how it was verified, known
issues and the next steps. The rest of `docs/newplan/` holds the plan per topic.

Key rules (details in the handoff):
- The product is `apps/mobile` (Expo SDK 57) + `apps/api` (FastAPI). `apps/web` is
  secondary; keep it compiling.
- Single-person by default. Sharing with family is opt-in. Show shared-only UI only when
  the household has more than one member, and never put "wife"/"partner" in default flows.
- Onyx design: black/white restraint. The only accents are champagne (due) and soft green
  (positive). Reuse `apps/mobile/src/ui` components and `theme/tokens.ts`.
- API: router → service → model. Every query is scoped by `actor.household_id`. Add
  integration tests against Postgres. After API changes, regenerate the OpenAPI file and
  the web types.
- Mobile: add native packages with `npx expo install`. Type-check with
  `npx tsc --noEmit` in `apps/mobile`.
- Checks: `cd apps/api && poetry run ruff check app tests && poetry run pytest`.
- No secrets or API keys in the app. Store only the last 4 digits of account numbers.
  `apps/api/.env` is local and must not be committed or printed.
- Work on a branch. Commit or push only when the owner asks.

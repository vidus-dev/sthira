# Phase 7 — AI assistant

A chat box (on Insights, and the **Ask** button on Home) where we ask things like:

- "How much did we spend on Swiggy this month vs last month?"
- "Which monthly payments are still pending?"
- "How much is left in my SBI account?"
- "What did my wife spend on groceries in September?"

## How it works

1. The question goes to **our server**, which asks Claude (Anthropic's model) to answer it.
2. Claude can only call **read-only lookups we write**, all scoped to our household by
   the server (the model never chooses whose data it sees):

   | Tool | Returns |
   |---|---|
   | `spending_by_category(start, end, member?)` | totals per category |
   | `list_transactions(start, end, category?, account?, search?, limit)` | matching entries |
   | `account_balances()` | each account's balance |
   | `monthly_plan_status(year, month)` | due / paid / remaining per plan item |
   | `compare_periods(a, b, category?)` | totals side by side |

3. **The numbers come from the database, not the AI.** The model picks the lookup and
   explains the result, so totals are exact.
4. Later: natural-language entry ("rent 15000 from SBI", "swiggy 450 hdfc cc") creates a
   **draft** we confirm, and the AI helps categorize SMS from unfamiliar merchants.

## Implementation notes

- FastAPI endpoint `POST /v1/assistant/ask`, using the official `anthropic` Python SDK's
  tool runner over the functions above. Tools reuse the same services as the app
  screens (`summary`, `monthly_payments`, `transactions`), so answers match the screens.
- Model: **Claude Opus 5.5** (`claude-opus-5-5`) by default; switching models is one
  setting. Answers stream into the chat.
- The API key lives only in the server's environment (`ANTHROPIC_API_KEY` on Render),
  never in the APK.
- SMS text and transaction notes are treated as data, never as instructions.

## Privacy

- The app never stores full account/card numbers, passwords, OTPs, CVVs or UPI PINs, so
  the AI can't see them either.
- The AI sees only the results of the lookups needed for each question.
- Anthropic doesn't use API data to train its models by default; re-check their current
  privacy terms when we sign up.

## Cost (rough, ~200 questions/month between us)

| Model | Per question | Per month |
|---|---|---|
| Claude Opus 5.5 | ~$0.08 | ~$16 (≈ ₹1,400) |
| Claude Sonnet 5.5 | ~$0.04 | ~$8 (≈ ₹700) |
| Claude Haiku 5.5 | < $0.01 | < $1 |

Needs an Anthropic API account (billed separately from any Claude.ai subscription,
prepaid credits, with a monthly spend cap).

## Done when

- [ ] Questions above answered correctly against our real data.
- [ ] Every number in an answer traces back to a tool result.
- [ ] Monthly spend stays under the cap we set.

# Phase 6 — detect transactions from bank SMS

Indian banks send an SMS for every debit and credit, with the amount, date, last 4 digits
of the account or card, and the merchant or UPI ID. Reading those SMS is the practical way
to capture transactions automatically. (Direct bank connections through RBI's Account
Aggregator system are only open to regulated financial companies.)

## How it works

1. When the app opens, it reads **new SMS from bank senders** since the last check
   (sender IDs like `AX-HDFCBK`, `VM-SBIINB`). Personal messages are never read past the
   sender check; **OTP messages are skipped entirely**.
2. Each bank SMS is parsed **on the phone** into a draft:
   `₹450 · debit · card ••4821 · SWIGGY · 9 Oct 20:42`.
3. The draft is matched to an account by the last 4 digits (accounts already store them).
4. The category is suggested from history: if SWIGGY went under *Food delivery* before,
   it's suggested again.
5. Drafts land in a **To review** inbox (the inbox button on Home). One tap confirms; or fix
   the category/account first. **Nothing is added without a tap.**
6. A debit from one of our accounts and a matching credit into another (same amount,
   minutes apart) become **one transfer**, not an expense plus income. Credit-card bill
   payments likewise.
7. Many SMS include "Avl Bal"; the app warns when its balance drifts from the bank's.

## Data

- Confirmed drafts become normal transactions with `source = 'sms'` and
  `source_ref = hash(sender + body + received_at)`. The database refuses the same
  `source_ref` twice in a household, so re-scans never duplicate.
- Raw SMS text stays on the phone. Only the parsed fields go to the server.

## Building blocks

- A small custom Android module (Kotlin, Expo Modules API) that queries the SMS inbox
  since a timestamp. The app moves from Expo Go to a **custom build** (EAS Build already
  does this in Phase 4) and needs the `READ_SMS` permission.
- Because we install the APK directly (not via Play Store), Google's SMS-permission policy
  doesn't block us. On newer Android versions, enable **App info → ⋮ → Allow restricted
  settings** once before granting SMS access.
- Parser: per-bank rules (regex) for HDFC, SBI, ICICI, Axis, Kotak and our card issuers,
  with tests built from real (anonymised) samples. Unknown formats fall back to the AI
  parser in Phase 7.
- "Scan when the app opens" is the reliable version. A live "₹450 spent — tap to
  categorize" notification can come later; phone makers (Xiaomi, Vivo, Oppo, Samsung)
  often kill background apps, so it's less dependable.

## Limits

- Cash spends can't be detected — still added by hand.
- Each phone only receives SMS for its own number's accounts, so the app scans on both
  phones and both feed the shared household.
- Android only; iPhones don't allow apps to read SMS.

## Done when

- [ ] Opening the app shows new bank SMS as drafts within a second.
- [ ] ≥ 95% of our real bank SMS parse correctly (amount, direction, account).
- [ ] No duplicates after repeated scans; OTPs never shown.
- [ ] Self-transfers pair up automatically.

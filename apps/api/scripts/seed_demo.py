"""Seed demo data through the public API, for previewing the app locally.

By default creates one personal demo login (the app's default, single-person mode):

    vinay.demo@example.com / demo-pass-123

With ``--with-partner`` a second login joins the same household, to try sharing:

    wife.demo@example.com  / demo-pass-123

    poetry run python scripts/seed_demo.py [--with-partner] [http://127.0.0.1:8000]

Only run this against a local database — never the real one.
"""

import argparse

import httpx

parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
parser.add_argument("base", nargs="?", default="http://127.0.0.1:8000")
parser.add_argument("--with-partner", action="store_true", help="add a second member who shares the household")
args = parser.parse_args()
BASE = args.base
PW = "demo-pass-123"


def session(email: str, name: str) -> httpx.Client:
    c = httpx.Client(base_url=BASE, timeout=20)
    r = c.post("/v1/auth/register", json={"email": email, "password": PW, "display_name": name})
    if r.status_code == 409:
        r = c.post("/v1/auth/login", json={"email": email, "password": PW})
    r.raise_for_status()
    c.headers["X-CSRF-Token"] = r.json()["csrf_token"]
    return c


def ok(r: httpx.Response) -> dict:
    if r.status_code >= 400:
        raise SystemExit(f"{r.request.method} {r.request.url} -> {r.status_code} {r.text}")
    return r.json() if r.content else {}


me = session("vinay.demo@example.com", "Vinay")
if ok(me.get("/v1/accounts")):
    print("demo already seeded")
    raise SystemExit(0)

if args.with_partner:
    wife = session("wife.demo@example.com", "Priya")
    code = ok(me.get("/v1/household"))["invite_code"]
    ok(wife.post("/v1/household/join", json={"invite_code": code}))
    ok(me.patch("/v1/household", json={"name": "Our home"}))
else:
    wife = me  # single-person mode: every entry is mine

members = {m["display_name"]: m["id"] for m in ok(me.get("/v1/household"))["members"]}


def account(name, kind, balance, bank=None, last4=None, owner="Vinay"):
    return ok(
        me.post(
            "/v1/accounts",
            json={
                "display_name": name,
                "account_type": kind,
                "balance": str(balance),
                "institution": bank,
                "mask_last4": last4,
                "owner_user_id": members.get(owner),
            },
        )
    )["id"]


sbi = account("SBI Salary", "savings", 18200, "SBI", "0937")
hdfc = account("HDFC Savings", "savings", 41500, "HDFC", "4821", owner=None)
icici = account("ICICI Card", "credit", -3200, "ICICI", "7702")
cash = account("Cash", "cash", 4000, owner=None)
priya = (
    account("Priya's Axis", "savings", 22000, "Axis", "1180", owner="Priya")
    if args.with_partner
    else account("Axis Savings", "savings", 22000, "Axis", "1180")
)


def tx(client, acc, amount, slug, when, note=""):
    ok(client.post("/v1/transactions", json={"account_id": acc, "amount": str(amount), "category_slug": slug, "occurred_at": when, "description": note}))


def item(**body):
    return ok(me.post("/v1/monthly-payments", json=body))["id"]


guru = item(name="Guru dakshina", category_slug="guru-dakshina", amount_type="percent", percent="10", due_day=15, default_account_id=sbi)
don = item(name="Donations", category_slug="donations", amount_type="percent", percent="5", default_account_id=cash)
rent = item(name="Rent", category_slug="rent", amount_type="fixed", amount="18000", due_day=5, default_account_id=hdfc)
maint = item(name="Maintenance", category_slug="maintenance", amount_type="fixed", amount="3500", due_day=10, default_account_id=hdfc)
veg = item(name="Vegetables", category_slug="vegetables", amount_type="fixed", amount="3000", default_account_id=cash)
nonveg = item(name="Non-veg", category_slug="non-veg", amount_type="fixed", amount="2000", default_account_id=cash)
emi = item(name="Loan EMI", category_slug="loan-emi", amount_type="fixed", amount="12400", due_day=7, default_account_id=hdfc)
net = item(name="Internet", category_slug="internet", amount_type="fixed", amount="999", due_day=18, default_account_id=hdfc)
power = item(name="Electricity", category_slug="electricity", amount_type="variable", amount="1400", due_day=12, default_account_id=hdfc)


def pay(item_id, year, month, acc, when, amount=None, dest=None):
    body = {"year": year, "month": month, "account_id": acc, "occurred_at": when}
    if amount:
        body["amount"] = str(amount)
    if dest:
        body["dest_account_id"] = dest
    ok(me.post(f"/v1/monthly-payments/{item_id}/pay", json=body))


# --- September (for last month's pace) -------------------------------------------------------
SEP = "2026-09-{:02d}T{}:00+05:30"
tx(me, sbi, 85000, "salary", SEP.format(1, "10:00"), "Salary")
for item_id, day, acc, amount in [
    (rent, 2, hdfc, None), (veg, 1, cash, None), (maint, 3, hdfc, None), (nonveg, 4, cash, None),
    (emi, 7, hdfc, None), (power, 12, hdfc, 1380), (guru, 15, sbi, None), (net, 18, hdfc, None),
    (don, 20, cash, None),
]:
    pay(item_id, 2026, 9, acc, SEP.format(day, "11:00"), amount)
for day, slug, amount, who, acc, note in [
    (3, "food-delivery", -520, me, icici, "Swiggy"), (5, "groceries", -2100, wife, priya, "BigBasket"),
    (6, "fuel", -1500, me, icici, ""), (9, "dining-out", -2400, me, icici, "Dinner out"),
    (11, "milk", -640, wife, cash, ""), (13, "food-delivery", -610, me, icici, "Zomato"),
    (16, "shopping", -3200, wife, priya, "Myntra"), (19, "groceries", -1800, wife, priya, ""),
    (22, "fuel", -1500, me, icici, ""), (24, "medical", -950, wife, cash, "Pharmacy"),
    (26, "food-delivery", -480, me, icici, "Swiggy"), (28, "entertainment", -800, me, icici, "Movie"),
]:
    tx(who, acc, amount, slug, SEP.format(day, "19:30"), note)

# --- October (this month, up to the 9th) ------------------------------------------------------
OCT = "2026-10-{:02d}T{}:00+05:30"
tx(me, sbi, 85000, "salary", OCT.format(1, "10:05"), "Salary")
ok(me.post("/v1/transfers", json={"source_account_id": sbi, "dest_account_id": hdfc, "amount": "40000", "occurred_at": OCT.format(1, "10:30"), "description": "Move to HDFC for bills"}))
pay(veg, 2026, 10, cash, OCT.format(1, "08:30"))
pay(rent, 2026, 10, hdfc, OCT.format(2, "09:00"))
pay(maint, 2026, 10, hdfc, OCT.format(3, "09:10"))
pay(nonveg, 2026, 10, cash, OCT.format(4, "12:00"))
pay(don, 2026, 10, cash, OCT.format(5, "18:00"), amount=2000)
pay(emi, 2026, 10, hdfc, OCT.format(7, "08:00"))
for day, time, slug, amount, who, acc, note in [
    (3, "21:10", "food-delivery", -380, me, icici, "Swiggy"),
    (4, "17:40", "fuel", -1500, me, icici, ""),
    (5, "20:45", "dining-out", -1850, me, icici, "Dinner at Meghana's"),
    (6, "11:20", "groceries", -1240, wife, priya, "DMart"),
    (8, "07:50", "milk", -620, wife, cash, ""),
    (9, "13:15", "vegetables", -220, wife, cash, "Market"),
    (9, "20:42", "food-delivery", -450, me, icici, "Swiggy"),
]:
    tx(who, acc, amount, slug, OCT.format(day, time), note)

print("seeded demo household")

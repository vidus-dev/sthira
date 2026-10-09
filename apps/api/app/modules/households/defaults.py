"""Defaults seeded into every new household, and invite-code generation."""

import secrets

# (slug, name, kind, icon). Icons are keys the mobile app maps to its line-icon set.
DEFAULT_CATEGORIES: tuple[tuple[str, str, str, str], ...] = (
    ("food-delivery", "Food delivery", "expense", "bowl"),
    ("groceries", "Groceries", "expense", "basket"),
    ("vegetables", "Vegetables", "expense", "leaf"),
    ("non-veg", "Non-veg", "expense", "fish"),
    ("milk", "Milk", "expense", "milk"),
    ("dining-out", "Dining out", "expense", "utensils"),
    ("rent", "Rent", "expense", "home"),
    ("maintenance", "Maintenance", "expense", "wrench"),
    ("electricity", "Electricity", "expense", "bolt"),
    ("internet", "Internet", "expense", "wifi"),
    ("mobile", "Mobile recharge", "expense", "phone"),
    ("loan-emi", "Loan EMI", "expense", "bank"),
    ("guru-dakshina", "Guru dakshina", "expense", "sparkle"),
    ("donations", "Donations", "expense", "heart"),
    ("fuel", "Fuel", "expense", "fuel"),
    ("transport", "Transport", "expense", "car"),
    ("shopping", "Shopping", "expense", "bag"),
    ("medical", "Medical", "expense", "medical"),
    ("entertainment", "Entertainment", "expense", "film"),
    ("personal-care", "Personal care", "expense", "scissors"),
    ("gifts", "Gifts", "expense", "gift"),
    ("household", "Household items", "expense", "sofa"),
    ("education", "Education", "expense", "book"),
    ("other", "Other", "expense", "dots"),
    ("salary", "Salary", "income", "salary"),
    ("other-income", "Other income", "income", "coins"),
    ("interest-refunds", "Interest & refunds", "income", "percent"),
)

# No 0/O/1/I so codes read cleanly over the phone.
_INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_invite_code() -> str:
    """Return a code like ``K7QM-4ZTX`` (40 bits of randomness)."""
    chars = "".join(secrets.choice(_INVITE_ALPHABET) for _ in range(8))
    return f"{chars[:4]}-{chars[4:]}"


def normalize_invite_code(raw: str) -> str:
    """Accept codes typed with spaces, lowercase or without the dash."""
    cleaned = "".join(ch for ch in raw.upper() if ch.isalnum())
    return f"{cleaned[:4]}-{cleaned[4:]}" if len(cleaned) == 8 else cleaned

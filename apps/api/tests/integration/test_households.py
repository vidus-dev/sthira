"""Households: sign-up seeds one, a partner joins with the invite code, data is shared
within a household and invisible outside it."""

from __future__ import annotations

import uuid

import pytest
from app.config import get_settings
from app.factory import create_app
from app.modules.accounts.schemas import AccountCreate
from app.modules.accounts.service import AccountService
from app.modules.households.defaults import DEFAULT_CATEGORIES
from app.modules.households.service import HouseholdConflictError, HouseholdService
from starlette.testclient import TestClient

from tests.integration.conftest import create_account, create_actor, make_sessionmaker, run


class _Login:
    """One person's cookies + CSRF token, swapped onto a shared TestClient."""

    def __init__(self, client: TestClient, email: str, password: str, name: str | None) -> None:
        client.cookies.clear()
        resp = client.post(
            "/v1/auth/register",
            json={"email": email, "password": password, "display_name": name},
        )
        assert resp.status_code == 201, resp.text
        self.user = resp.json()["user"]
        self.csrf = resp.json()["csrf_token"]
        self.cookies = dict(client.cookies)

    def use(self, client: TestClient) -> TestClient:
        client.cookies.clear()
        client.cookies.update(self.cookies)
        client.headers["X-CSRF-Token"] = self.csrf
        return client


def test_partner_joins_and_both_see_the_same_accounts() -> None:
    get_settings.cache_clear()
    with TestClient(create_app(enable_auth=True)) as client:
        me = _Login(client, f"me-{uuid.uuid4()}@example.com", "pw-123456", "  Vinay  ")
        wife = _Login(client, f"wife-{uuid.uuid4()}@example.com", "pw-123456", "Priya")
        assert me.user["display_name"] == "Vinay"
        assert me.user["household_id"] != wife.user["household_id"]

        household = me.use(client).get("/v1/household").json()
        assert [m["display_name"] for m in household["members"]] == ["Vinay"]
        created = client.post(
            "/v1/accounts",
            json={"display_name": "Cash", "account_type": "cash", "balance": "3000"},
        )
        assert created.status_code == 201, created.text

        # Codes are accepted lowercase and without the dash.
        joined = wife.use(client).post(
            "/v1/household/join",
            json={"invite_code": household["invite_code"].replace("-", "").lower()},
        )
        assert joined.status_code == 200, joined.text
        assert {m["display_name"] for m in joined.json()["members"]} == {"Vinay", "Priya"}

        accounts = client.get("/v1/accounts").json()
        assert [a["display_name"] for a in accounts] == ["Cash"]
        assert accounts[0]["account_type"] == "cash"

        session = client.get("/v1/auth/session").json()
        assert session["user"]["household_id"] == household["id"]


def test_join_with_unknown_code_is_404_and_profile_name_updates() -> None:
    get_settings.cache_clear()
    with TestClient(create_app(enable_auth=True)) as client:
        me = _Login(client, f"me-{uuid.uuid4()}@example.com", "pw-123456", None)
        me.use(client)
        assert client.post("/v1/household/join", json={"invite_code": "ZZZZ-ZZZZ"}).status_code == 404

        renamed = client.patch("/v1/auth/me", json={"display_name": "Vinay"})
        assert renamed.status_code == 200
        assert renamed.json()["display_name"] == "Vinay"

        before = client.get("/v1/household").json()["invite_code"]
        after = client.post("/v1/household/invite-code").json()["invite_code"]
        assert after != before


def test_new_household_is_seeded_with_default_categories() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        actor = await create_actor(sm)
        from app.modules.categories.service import CategoryService

        async with sm() as s:
            cats = await CategoryService(s).list_categories(actor)
        slugs = {c.slug for c in cats}
        assert slugs == {slug for slug, *_ in DEFAULT_CATEGORIES}
        assert {"guru-dakshina", "donations", "salary", "vegetables", "non-veg"} <= slugs

    run(scenario())


def test_join_is_refused_when_current_household_has_data() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        host = await create_actor(sm)
        joiner = await create_actor(sm)
        await create_account(sm, joiner, name="My own account")
        async with sm() as s:
            code = (await HouseholdService(s).get(host)).invite_code
        with pytest.raises(HouseholdConflictError, match="already has accounts"):
            async with sm() as s:
                await HouseholdService(s).join(joiner, code)

    run(scenario())


def test_join_is_refused_when_others_share_current_household() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        host = await create_actor(sm)
        joiner = await create_actor(sm)
        await create_actor(sm, household_id=joiner.household_id)  # joiner's partner
        async with sm() as s:
            code = (await HouseholdService(s).get(host)).invite_code
        with pytest.raises(HouseholdConflictError, match="Others share"):
            async with sm() as s:
                await HouseholdService(s).join(joiner, code)

    run(scenario())


def test_other_households_cannot_see_or_touch_accounts() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        owner = await create_actor(sm)
        stranger = await create_actor(sm)
        async with sm() as s:
            acc = await AccountService(s).create(owner, AccountCreate(display_name="HDFC"))
        async with sm() as s:
            assert await AccountService(s).get(stranger, acc.id) is None
            assert await AccountService(s).list_accounts(stranger) == []
            assert await AccountService(s).delete(stranger, acc.id) is False

    run(scenario())


def test_account_owner_must_be_a_household_member() -> None:
    async def scenario() -> None:
        sm = make_sessionmaker()
        me = await create_actor(sm)
        partner = await create_actor(sm, household_id=me.household_id)
        stranger = await create_actor(sm)
        async with sm() as s:
            acc = await AccountService(s).create(
                me, AccountCreate(display_name="Wife's SBI", owner_user_id=partner.user_id)
            )
        assert acc.owner_user_id == partner.user_id
        with pytest.raises(ValueError, match="member"):
            async with sm() as s:
                await AccountService(s).create(
                    me, AccountCreate(display_name="X", owner_user_id=stranger.user_id)
                )

    run(scenario())

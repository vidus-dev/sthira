import type { JsonHttpClient } from "../core/http/jsonHttpClient";

export type AccountRow = {
  id: string;
  user_id: string;
  display_name: string;
  institution: string | null;
  account_type: string;
  currency: string;
  balance: string;
  mask_last4: string | null;
  color_token: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type AccountCreateBody = {
  display_name: string;
  institution?: string | null;
  account_type?: "checking" | "savings" | "credit" | "investment";
  currency?: string;
  balance?: string;
  mask_last4?: string | null;
  color_token?: string | null;
  is_default?: boolean;
};

export type AccountPatchBody = {
  display_name?: string;
  institution?: string | null;
  account_type?: "checking" | "savings" | "credit" | "investment";
  currency?: string;
  balance?: string;
  mask_last4?: string | null;
  color_token?: string | null;
  is_default?: boolean;
};

export function createAccountsApi(http: JsonHttpClient) {
  return {
    list(): Promise<AccountRow[]> {
      return http.requestJson<AccountRow[]>({ path: "/v1/accounts", method: "GET" });
    },
    create(body: AccountCreateBody): Promise<AccountRow> {
      return http.requestJson<AccountRow>({ path: "/v1/accounts", method: "POST", body });
    },
    patch(id: string, body: AccountPatchBody): Promise<AccountRow> {
      return http.requestJson<AccountRow>({
        path: `/v1/accounts/${id}`,
        method: "PATCH",
        body,
      });
    },
    remove(id: string): Promise<void> {
      return http.requestJson<void>({ path: `/v1/accounts/${id}`, method: "DELETE" });
    },
  };
}

export type AccountsApi = ReturnType<typeof createAccountsApi>;

import { ApiError } from "../core/api/ApiError";
import { getApiBaseUrl, getDefaultTimeoutMs } from "../core/config";
import { getExtraHeadersForApi } from "../core/http/csrfStore";
import { createJsonHttpClient } from "../core/http/jsonHttpClient";
import type {
  Account,
  AccountInput,
  Category,
  CategoryKind,
  Household,
  MonthSummary,
  MonthlyPlanStatus,
  PayInput,
  PlanItem,
  PlanItemInput,
  PlanItemStatus,
  SessionResponse,
  SessionUser,
  Transaction,
  TransactionInput,
  TransactionPatch,
  TransferInput,
} from "./types";

let unauthorizedHandler: (() => void) | null = null;

/** The auth layer registers what to do when the session has expired. */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

/** One HTTP client for the whole app (cookie session + CSRF header). */
export const http = createJsonHttpClient({
  getBaseUrl: getApiBaseUrl,
  defaultTimeoutMs: getDefaultTimeoutMs(),
  getExtraHeaders: getExtraHeadersForApi,
  onUnauthorized: () => unauthorizedHandler?.(),
});

function query(params: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

/** RFC-4122-ish v4 id for Idempotency-Key (not security sensitive). */
export function newRequestId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** GET a non-JSON body (e.g. the CSV export) with the same session cookie. */
async function getText(path: string): Promise<string> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: "include",
    headers: { Accept: "text/csv, text/plain", ...getExtraHeadersForApi() },
  });
  if (res.status === 401) unauthorizedHandler?.();
  if (!res.ok) throw new ApiError(res.status, "Couldn't export right now. Try again.");
  return res.text();
}

export const api = {
  auth: {
    session: () => http.requestJson<SessionResponse>({ path: "/v1/auth/session" }),
    login: (email: string, password: string) =>
      http.requestJson<SessionResponse>({
        path: "/v1/auth/login",
        method: "POST",
        body: { email, password },
      }),
    register: (email: string, password: string, display_name: string) =>
      http.requestJson<SessionResponse>({
        path: "/v1/auth/register",
        method: "POST",
        body: { email, password, display_name },
      }),
    logout: () => http.requestJson<void>({ path: "/v1/auth/logout", method: "POST" }),
    updateProfile: (display_name: string | null) =>
      http.requestJson<SessionUser>({ path: "/v1/auth/me", method: "PATCH", body: { display_name } }),
  },
  household: {
    get: () => http.requestJson<Household>({ path: "/v1/household" }),
    rename: (name: string) =>
      http.requestJson<Household>({ path: "/v1/household", method: "PATCH", body: { name } }),
    join: (invite_code: string) =>
      http.requestJson<Household>({
        path: "/v1/household/join",
        method: "POST",
        body: { invite_code },
      }),
    rotateInviteCode: () =>
      http.requestJson<Household>({ path: "/v1/household/invite-code", method: "POST" }),
  },
  accounts: {
    list: () => http.requestJson<Account[]>({ path: "/v1/accounts" }),
    create: (body: AccountInput) =>
      http.requestJson<Account>({ path: "/v1/accounts", method: "POST", body }),
    update: (id: string, body: Partial<AccountInput>) =>
      http.requestJson<Account>({ path: `/v1/accounts/${id}`, method: "PATCH", body }),
    remove: (id: string) => http.requestJson<void>({ path: `/v1/accounts/${id}`, method: "DELETE" }),
  },
  categories: {
    list: (includeArchived = false) =>
      http.requestJson<Category[]>({
        path: `/v1/categories${query({ include_archived: includeArchived ? "true" : undefined })}`,
      }),
    create: (body: { name: string; kind: CategoryKind; icon: string }) =>
      http.requestJson<Category>({ path: "/v1/categories", method: "POST", body }),
    update: (id: string, body: Partial<Pick<Category, "name" | "icon" | "sort_order" | "is_archived">>) =>
      http.requestJson<Category>({ path: `/v1/categories/${id}`, method: "PATCH", body }),
    archive: (id: string) =>
      http.requestJson<void>({ path: `/v1/categories/${id}`, method: "DELETE" }),
  },
  transactions: {
    list: (params: { start?: string; end?: string; account_id?: string; limit?: number } = {}) =>
      http.requestJson<Transaction[]>({ path: `/v1/transactions${query(params)}` }),
    create: (body: TransactionInput) =>
      http.requestJson<Transaction>({
        path: "/v1/transactions",
        method: "POST",
        body,
        headers: { "Idempotency-Key": newRequestId() },
      }),
    update: (id: string, body: TransactionPatch) =>
      http.requestJson<Transaction>({ path: `/v1/transactions/${id}`, method: "PATCH", body }),
    remove: (id: string) =>
      http.requestJson<void>({ path: `/v1/transactions/${id}`, method: "DELETE" }),
  },
  transfers: {
    create: (body: TransferInput) =>
      http.requestJson<unknown>({ path: "/v1/transfers", method: "POST", body }),
  },
  plan: {
    items: (includeInactive = false) =>
      http.requestJson<PlanItem[]>({
        path: `/v1/monthly-payments${query({ include_inactive: includeInactive ? "true" : undefined })}`,
      }),
    create: (body: PlanItemInput) =>
      http.requestJson<PlanItem>({ path: "/v1/monthly-payments", method: "POST", body }),
    update: (id: string, body: Partial<PlanItemInput> & { is_active?: boolean }) =>
      http.requestJson<PlanItem>({ path: `/v1/monthly-payments/${id}`, method: "PATCH", body }),
    archive: (id: string) =>
      http.requestJson<void>({ path: `/v1/monthly-payments/${id}`, method: "DELETE" }),
    status: (year: number, month: number) =>
      http.requestJson<MonthlyPlanStatus>({
        path: `/v1/monthly-payments/status${query({ year, month })}`,
      }),
    pay: (id: string, body: PayInput) =>
      http.requestJson<PlanItemStatus>({
        path: `/v1/monthly-payments/${id}/pay`,
        method: "POST",
        body,
      }),
  },
  export: {
    transactionsCsv: () => getText("/v1/export/transactions.csv"),
  },
  summary: {
    month: (year: number, month: number) =>
      http.requestJson<MonthSummary>({ path: `/v1/summary/month${query({ year, month })}` }),
  },
};

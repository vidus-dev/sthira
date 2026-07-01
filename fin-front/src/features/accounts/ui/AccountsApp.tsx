import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@lib/api/ApiError";
import { isApiConfigured } from "@lib/env";
import { getHttpClient } from "@lib/http/configureHttpClient";
import { formatInr } from "@lib/money/formatCurrency";
import { createAccountsApi } from "../data/accountsApi";
import type { AccountRow } from "../data/accountsApi";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";

export function AccountsApp() {
  const hasApi = isApiConfigured();
  const api = useMemo(() => createAccountsApi(getHttpClient()), []);

  const [rows, setRows] = useState<AccountRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("Main account");
  const [institution, setInstitution] = useState("");
  const [type, setType] = useState<"checking" | "savings" | "credit" | "investment">("checking");
  const [balance, setBalance] = useState("0");

  const refresh = useCallback(async () => {
    if (!hasApi) return;
    setLoading(true);
    setErr(null);
    try {
      setRows(await api.list());
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to load accounts");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, hasApi]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!hasApi) return;
    setErr(null);
    try {
      await api.create({
        display_name: name,
        institution: institution || null,
        account_type: type,
        currency: "INR",
        balance,
        is_default: rows.length === 0,
      });
      setName("Main account");
      setInstitution("");
      setType("checking");
      setBalance("0");
      await refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Create failed");
    }
  }

  async function onDelete(id: string) {
    if (!hasApi) return;
    try {
      await api.remove(id);
      await refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  if (!hasApi) {
    return (
      <div className="p-6 max-w-xl text-sm text-muted-foreground">
        Set <code className="text-xs bg-muted px-1 rounded">VITE_API_BASE_URL</code> in{" "}
        <code className="text-xs">.env</code> for local Vite, or use the Docker compose stack (same-origin{" "}
        <code className="text-xs">/v1</code>).
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <p className="text-muted-foreground text-sm mt-1">Balances in INR; amounts sync with posted transactions.</p>
      </div>
      {err ? <p className="text-sm text-destructive border border-destructive/30 rounded-md p-3">{err}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Add account</CardTitle>
          <CardDescription>Bank / card / wallet label for your books.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onCreate}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="a-name">Display name</Label>
              <Input id="a-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-inst">Institution (optional)</Label>
              <Input id="a-inst" value={institution} onChange={(e) => setInstitution(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-bal">Opening balance (INR)</Label>
              <Input
                id="a-bal"
                inputMode="decimal"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={loading}>
                Create
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Your accounts</h2>
        {loading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts yet.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((a) => (
              <li key={a.id}>
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">{a.display_name}</CardTitle>
                      <CardDescription>
                        {a.institution ?? "—"} · {a.account_type}
                        {a.is_default ? " · default" : ""}
                      </CardDescription>
                    </div>
                    <div className="text-right font-semibold tabular-nums">
                      {formatInr(a.balance, a.currency)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button type="button" variant="outline" size="sm" onClick={() => void onDelete(a.id)}>
                      Delete
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

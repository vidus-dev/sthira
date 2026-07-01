import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@lib/api/ApiError";
import { isApiConfigured } from "@lib/env";
import { getHttpClient } from "@lib/http/configureHttpClient";
import { formatInr } from "@lib/money/formatCurrency";
import { createAccountsApi } from "@features/accounts/data/accountsApi";
import { createTransactionsApi } from "../data/transactionsApi";
import type { TxRow } from "../data/transactionsApi";
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

export function TransactionsApp() {
  const hasApi = isApiConfigured();
  const http = useMemo(() => getHttpClient(), []);
  const accountsApi = useMemo(() => createAccountsApi(http), [http]);
  const txApi = useMemo(() => createTransactionsApi(http), [http]);

  const [accountIds, setAccountIds] = useState<{ id: string; name: string }[]>([]);
  const [accountId, setAccountId] = useState("");
  const [rows, setRows] = useState<TxRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [amount, setAmount] = useState("-500");
  const [desc, setDesc] = useState("Groceries");
  const [cat, setCat] = useState("food");
  const [when, setWhen] = useState(() => new Date().toISOString().slice(0, 16));

  const refresh = useCallback(async () => {
    if (!hasApi) return;
    setLoading(true);
    setErr(null);
    try {
      const list = await accountsApi.list();
      const ids = list.map((a) => ({ id: a.id, name: a.display_name }));
      setAccountIds(ids);
      const selected =
        accountId && ids.some((x) => x.id === accountId) ? accountId : ids[0]?.id ?? "";
      if (selected !== accountId) setAccountId(selected);
      setRows(await txApi.list(selected || undefined));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [hasApi, accountsApi, txApi, accountId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setErr(null);
    try {
      const iso = new Date(when).toISOString();
      await txApi.create({
        account_id: accountId,
        amount,
        description: desc,
        category_slug: cat,
        occurred_at: iso,
      });
      await refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Create failed");
    }
  }

  async function onDelete(id: string) {
    try {
      await txApi.remove(id);
      await refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  if (!hasApi) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Configure <code className="text-xs bg-muted px-1 rounded">VITE_API_BASE_URL</code>.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Positive amounts credit the account; negative amounts debit it.
        </p>
      </div>
      {err ? <p className="text-sm text-destructive border rounded-md p-3">{err}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Post transaction</CardTitle>
          <CardDescription>Linked to one of your accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onCreate}>
            <div className="space-y-2 md:col-span-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accountIds.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-amt">Amount (INR, signed)</Label>
              <Input id="tx-amt" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-cat">Category slug</Label>
              <Input id="tx-cat" value={cat} onChange={(e) => setCat(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tx-desc">Description</Label>
              <Input id="tx-desc" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tx-when">When</Label>
              <Input id="tx-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={loading || !accountId}>
                Post
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Recent</h2>
        {loading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((t) => (
              <li key={t.id} className="flex items-center justify-between border rounded-lg p-3 gap-4">
                <div>
                  <p className="font-medium">{t.description || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.category_slug} · {new Date(t.occurred_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      Number(t.amount) >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"
                    }
                  >
                    {formatInr(t.amount, "INR")}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void onDelete(t.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@lib/api/ApiError";
import { isApiConfigured } from "@lib/env";
import { getHttpClient } from "@lib/http/configureHttpClient";
import { formatInr } from "@lib/money/formatCurrency";
import { createBudgetsApi } from "../data/budgetsApi";
import type { BudgetRow } from "../data/budgetsApi";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";

function currentYm() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

export function BudgetsApp() {
  const hasApi = isApiConfigured();
  const api = useMemo(() => createBudgetsApi(getHttpClient()), []);
  const start = currentYm();
  const [year, setYear] = useState(start.y);
  const [month, setMonth] = useState(start.m);
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slug, setSlug] = useState("food");
  const [limit, setLimit] = useState("15000");

  const refresh = useCallback(async () => {
    if (!hasApi) return;
    setLoading(true);
    setErr(null);
    try {
      setRows(await api.list(year, month));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, hasApi, year, month]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.upsert({
        category_slug: slug,
        year,
        month,
        limit_amount: limit,
        currency: "INR",
      });
      await refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  async function onDelete(id: string) {
    try {
      await api.remove(id);
      await refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  if (!hasApi) {
    return <div className="p-6 text-sm text-muted-foreground">Set VITE_API_BASE_URL.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Budgets</h1>
        <p className="text-muted-foreground text-sm mt-1">Monthly envelopes by category (INR).</p>
      </div>
      {err ? <p className="text-sm text-destructive border rounded-md p-3">{err}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Period</CardTitle>
          <CardDescription>Year and calendar month.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label>Year</Label>
            <Input
              type="number"
              className="w-28"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Month (1–12)</Label>
            <Input
              type="number"
              min={1}
              max={12}
              className="w-24"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Set / update envelope</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSave}>
            <div className="space-y-2">
              <Label>Category slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Limit (INR)</Label>
              <Input value={limit} onChange={(e) => setLimit(e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={loading}>
                Save envelope
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">This month</h2>
        {loading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No budgets for this month.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((b) => (
              <li key={b.id} className="flex justify-between items-center border rounded-lg p-3">
                <div>
                  <p className="font-medium">{b.category_slug}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.year}-{String(b.month).padStart(2, "0")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{formatInr(b.limit_amount, b.currency)}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void onDelete(b.id)}>
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

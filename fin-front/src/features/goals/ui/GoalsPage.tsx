import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@lib/api/ApiError";
import { isApiConfigured } from "@lib/env";
import { getHttpClient } from "@lib/http/configureHttpClient";
import { formatInr } from "@lib/money/formatCurrency";
import { createGoalsApi } from "../data/goalsApi";
import type { FinancialGoalCreate, FinancialGoalRead } from "../domain/goalTypes";
import { Button } from "@components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { Progress } from "@components/ui/progress";
import type { GoalKind } from "../domain/goalTypes";

export function GoalsPage() {
  const hasApi = isApiConfigured();
  const api = useMemo(() => createGoalsApi(getHttpClient()), []);

  const [goals, setGoals] = useState<FinancialGoalRead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("Wedding fund");
  const [kind, setKind] = useState<GoalKind>("wedding");
  const [target, setTarget] = useState("500000");
  const [saved, setSaved] = useState("50000");
  const [targetDate, setTargetDate] = useState("");

  const refresh = useCallback(async () => {
    if (!hasApi) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await api.list();
      setGoals(rows);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("Not signed in. Use Register / Login against the API (run backend with app.main:app).");
      } else if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError("Could not load goals.");
      }
      setGoals([]);
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
    setError(null);
    const body: FinancialGoalCreate = {
      name,
      goal_kind: kind,
      currency: "INR",
      target_amount: target,
      saved_amount: saved,
      target_date: targetDate || null,
    };
    try {
      await api.create(body);
      setName("Wedding fund");
      setKind("wedding");
      setTarget("500000");
      setSaved("50000");
      setTargetDate("");
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Create failed.");
    }
  }

  async function onDelete(id: string) {
    if (!hasApi) return;
    try {
      await api.remove(id);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }

  if (!hasApi) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Goals &amp; life events</h1>
        <p className="text-muted-foreground text-sm">
          Set <code className="text-xs bg-muted px-1 py-0.5 rounded">VITE_API_BASE_URL</code> in{" "}
          <code className="text-xs">.env</code> for local Vite (e.g.{" "}
          <code className="text-xs">http://127.0.0.1:8000</code>), or run the Docker compose stack so{" "}
          <code className="text-xs">/v1</code> is same-origin. Use{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">app.main:app</code> for sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Goals &amp; life events</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sinking funds in INR — e.g. wedding, emergency, vacation. Monthly suggestion divides the
          remainder by whole months until your target date.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive border border-destructive/30 rounded-md p-3">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>New goal</CardTitle>
          <CardDescription>Amounts in rupees (numbers only in the fields below).</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onCreate}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="g-name">Name</Label>
              <Input
                id="g-name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as GoalKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wedding">Wedding</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-date">Target date (optional)</Label>
              <Input
                id="g-date"
                type="date"
                value={targetDate}
                onChange={(ev) => setTargetDate(ev.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-target">Target amount (INR)</Label>
              <Input
                id="g-target"
                inputMode="decimal"
                value={target}
                onChange={(ev) => setTarget(ev.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-saved">Already saved (INR)</Label>
              <Input
                id="g-saved"
                inputMode="decimal"
                value={saved}
                onChange={(ev) => setSaved(ev.target.value)}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={loading}>
                Create goal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Your goals</h2>
        {loading && goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No goals yet.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {goals.map((g) => {
              const pct = Math.min(100, Number(g.progress) * 100);
              return (
                <li key={g.id}>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{g.name}</CardTitle>
                      <CardDescription className="capitalize">
                        {g.goal_kind.replace("-", " ")} · {g.currency}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Target</span>
                        <span className="font-medium tabular-nums">
                          {formatInr(g.target_amount, g.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Saved</span>
                        <span className="font-medium tabular-nums">
                          {formatInr(g.saved_amount, g.currency)}
                        </span>
                      </div>
                      {g.suggested_monthly_contribution != null ? (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Suggested / month</span>
                          <span className="font-medium tabular-nums text-primary">
                            {formatInr(g.suggested_monthly_contribution, g.currency)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Set a target date to see a monthly savings suggestion.
                        </p>
                      )}
                      <Progress value={pct} className="h-2" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => void onDelete(g.id)}
                      >
                        Delete
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

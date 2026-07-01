import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "@lib/api/ApiError";
import { isApiConfigured } from "@lib/env";
import { useAuth } from "@lib/auth/AuthContext";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";

export function LoginPage() {
  const { signInWithApi, isAuthenticated, isHydrated } = useAuth();
  const nav = useNavigate();
  const hasApi = isApiConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (isHydrated && isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!hasApi) {
      setErr("Set VITE_API_BASE_URL in .env for local Vite, or run the production/Docker build (same-origin /v1).");
      return;
    }
    try {
      await signInWithApi(email, password);
      nav("/app/dashboard", { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Login failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use the same email and password as the API.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Password</Label>
              <Input
                id="pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              No account?{" "}
              <Link to="/auth/register" className="text-primary underline-offset-4 hover:underline">
                Register
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

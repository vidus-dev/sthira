import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "@lib/api/ApiError";
import { isApiConfigured } from "@lib/env";
import { useAuth } from "@lib/auth/AuthContext";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";

export function RegisterPage() {
  const { registerWithApi, isAuthenticated, isHydrated } = useAuth();
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
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    try {
      await registerWithApi(email, password);
      nav("/app/dashboard", { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Registration failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Registers against the modular monolith API.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            <div className="space-y-2">
              <Label htmlFor="remail">Email</Label>
              <Input
                id="remail"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rpw">Password (min 8)</Label>
              <Input
                id="rpw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full">
              Register
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/auth/login" className="text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

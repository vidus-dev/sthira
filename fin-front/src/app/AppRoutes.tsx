import { lazy, Suspense } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { useAuth } from "@lib/auth/AuthContext";
import { AppLayout } from "@components/layout/AppLayout";
import { LandingPage } from "./routes/landing";

const Dashboard = lazy(() =>
  import("./routes/dashboard").then((m) => ({ default: m.Dashboard }))
);
const BankAccounts = lazy(() =>
  import("./routes/accounts").then((m) => ({ default: m.BankAccounts }))
);
const Transactions = lazy(() =>
  import("./routes/transactions").then((m) => ({ default: m.Transactions }))
);
const Budgets = lazy(() =>
  import("./routes/budgets").then((m) => ({ default: m.Budgets }))
);
const MutualFunds = lazy(() =>
  import("./routes/investments").then((m) => ({ default: m.MutualFunds }))
);
const Analytics = lazy(() =>
  import("./routes/analytics").then((m) => ({ default: m.Analytics }))
);
const SettingsPage = lazy(() =>
  import("./routes/settings/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  }))
);
const GoalsPage = lazy(() =>
  import("@features/goals").then((m) => ({ default: m.GoalsPage }))
);
const LoginPage = lazy(() =>
  import("@features/auth").then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import("@features/auth").then((m) => ({ default: m.RegisterPage }))
);

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

function LandingRoute() {
  const { isAuthenticated, isHydrated } = useAuth();
  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/app/dashboard" replace />;
  return <LandingPage />;
}

function ProtectedLayout() {
  const { isAuthenticated, isHydrated } = useAuth();
  if (!isHydrated) return <PageFallback />;
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  return (
    <AppLayout>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </AppLayout>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route
        path="/auth/login"
        element={
          <Suspense fallback={<PageFallback />}>
            <LoginPage />
          </Suspense>
        }
      />
      <Route
        path="/auth/register"
        element={
          <Suspense fallback={<PageFallback />}>
            <RegisterPage />
          </Suspense>
        }
      />
      <Route element={<ProtectedLayout />}>
        <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/app/dashboard" element={<Dashboard />} />
        <Route path="/app/accounts" element={<BankAccounts />} />
        <Route path="/app/transactions" element={<Transactions />} />
        <Route path="/app/budgets" element={<Budgets />} />
        <Route path="/app/goals" element={<GoalsPage />} />
        <Route path="/app/mutual-funds" element={<MutualFunds />} />
        <Route path="/app/analytics" element={<Analytics />} />
        <Route path="/app/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@components/common/ThemeProvider";
import { AuthProvider } from "@lib/auth/AuthContext";
import { ErrorBoundary } from "@components/common/ErrorBoundary";
import { configureHttpClient, createFetchHttpClient } from "@lib/http";
import { getExtraHeadersForApi } from "@lib/http/csrfStore";
import { getApiBaseUrl, getApiDefaultTimeoutMs } from "@lib/env";
import App from "./app/App.tsx";
import "./styles/globals.css";

configureHttpClient(
  createFetchHttpClient({
    getBaseUrl: getApiBaseUrl,
    defaultTimeoutMs: getApiDefaultTimeoutMs(),
    getExtraHeaders: getExtraHeadersForApi,
  })
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider defaultTheme="system" storageKey="finance-tracker-theme">
            <AuthProvider>
              <App />
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

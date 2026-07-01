import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { createJsonHttpClient } from "../core/http/jsonHttpClient";
import { getExtraHeadersForApi } from "../core/http/csrfStore";
import { getApiBaseUrl, getDefaultTimeoutMs, isApiConfigured } from "../core/config";
import { createAccountsApi } from "../api/accountsApi";
import { formatMoney } from "../core/format/currency";
import { ApiError } from "../core/api/ApiError";

export function HomeScreen() {
  const http = useMemo(
    () =>
      createJsonHttpClient({
        getBaseUrl: getApiBaseUrl,
        defaultTimeoutMs: getDefaultTimeoutMs(),
        getExtraHeaders: getExtraHeadersForApi,
      }),
    []
  );
  const api = useMemo(() => createAccountsApi(http), [http]);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.list>>>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isApiConfigured()) return;
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
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    let sum = 0;
    let ccy = "INR";
    for (const a of rows) {
      const n = Number(a.balance);
      if (Number.isFinite(n)) sum += n;
      if (a.currency) ccy = a.currency;
    }
    return { sum, ccy };
  }, [rows]);

  if (!isApiConfigured()) {
    return (
      <View style={styles.pad}>
        <Text style={styles.title}>Home</Text>
        <Text style={styles.muted}>Set EXPO_PUBLIC_API_BASE_URL in .env.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.pad}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <Text style={styles.title}>Overview</Text>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Total balance (sum of accounts)</Text>
        <Text style={styles.heroVal}>{formatMoney(totals.sum, totals.ccy)}</Text>
      </View>
      <Text style={styles.section}>Accounts ({rows.length})</Text>
      {loading && rows.length === 0 ? (
        <ActivityIndicator />
      ) : (
        rows.map((a) => (
          <View key={a.id} style={styles.row}>
            <Text style={styles.rowTitle}>{a.display_name}</Text>
            <Text style={styles.rowSub}>{formatMoney(a.balance, a.currency)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fff" },
  pad: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 12 },
  muted: { color: "#64748b", fontSize: 14 },
  err: { color: "#b91c1c", marginBottom: 8 },
  hero: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  heroLabel: { fontSize: 13, color: "#64748b", marginBottom: 4 },
  heroVal: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  section: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  rowTitle: { fontSize: 15, fontWeight: "500" },
  rowSub: { fontSize: 15, color: "#334155" },
});

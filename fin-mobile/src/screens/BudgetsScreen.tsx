import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { createJsonHttpClient } from "../core/http/jsonHttpClient";
import { getExtraHeadersForApi } from "../core/http/csrfStore";
import { getApiBaseUrl, getDefaultTimeoutMs, isApiConfigured } from "../core/config";
import { createBudgetsApi, type BudgetRow } from "../api/budgetsApi";
import { formatMoney } from "../core/format/currency";
import { ApiError } from "../core/api/ApiError";

export function BudgetsScreen() {
  const http = useMemo(
    () =>
      createJsonHttpClient({
        getBaseUrl: getApiBaseUrl,
        defaultTimeoutMs: getDefaultTimeoutMs(),
        getExtraHeaders: getExtraHeadersForApi,
      }),
    []
  );
  const api = useMemo(() => createBudgetsApi(http), [http]);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<BudgetRow | null>(null);
  const [slug, setSlug] = useState("groceries");
  const [limit, setLimit] = useState("5000");

  const load = useCallback(async () => {
    if (!isApiConfigured()) return;
    setLoading(true);
    setErr(null);
    try {
      setRows(await api.list(year, month));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  function openCreate() {
    setEditRow(null);
    setSlug("groceries");
    setLimit("5000");
    setModalOpen(true);
  }

  function openEdit(b: BudgetRow) {
    setEditRow(b);
    setSlug(b.category_slug);
    setLimit(String(b.limit_amount));
    setModalOpen(true);
  }

  async function save() {
    setErr(null);
    try {
      if (editRow) {
        await api.patch(editRow.id, { limit_amount: limit });
      } else {
        await api.upsert({
          category_slug: slug.trim(),
          year,
          month,
          limit_amount: limit,
          currency: "INR",
        });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  function confirmDelete(b: BudgetRow) {
    Alert.alert("Delete budget", `Remove ${b.category_slug}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void remove(b.id) },
    ]);
  }

  async function remove(id: string) {
    try {
      await api.remove(id);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  if (!isApiConfigured()) {
    return (
      <View style={styles.pad}>
        <Text style={styles.muted}>Set EXPO_PUBLIC_API_BASE_URL.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pad}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <Text style={styles.title}>Budgets</Text>
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <View style={styles.monthRow}>
          <Pressable style={styles.monthBtn} onPress={() => shiftMonth(-1)}>
            <Text style={styles.monthBtnText}>◀</Text>
          </Pressable>
          <Text style={styles.monthLabel}>
            {year}-{String(month).padStart(2, "0")}
          </Text>
          <Pressable style={styles.monthBtn} onPress={() => shiftMonth(1)}>
            <Text style={styles.monthBtnText}>▶</Text>
          </Pressable>
        </View>
        <Pressable style={styles.btn} onPress={openCreate}>
          <Text style={styles.btnText}>Add / update line</Text>
        </Pressable>
        {loading && rows.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : (
          rows.map((b) => (
            <View key={b.id} style={styles.card}>
              <Pressable onPress={() => openEdit(b)}>
                <Text style={styles.cardTitle}>{b.category_slug}</Text>
                <Text style={styles.muted}>{formatMoney(b.limit_amount, b.currency)}</Text>
              </Pressable>
              <Pressable style={styles.btnDanger} onPress={() => confirmDelete(b)}>
                <Text style={styles.btnDangerText}>Delete</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editRow ? "Edit limit" : "New budget line"}</Text>
            {!editRow ? (
              <>
                <Text style={styles.label}>Category slug</Text>
                <TextInput style={styles.input} value={slug} onChangeText={setSlug} autoCapitalize="none" />
              </>
            ) : null}
            <Text style={styles.label}>Monthly limit</Text>
            <TextInput style={styles.input} value={limit} onChangeText={setLimit} keyboardType="decimal-pad" />
            <View style={styles.rowBtns}>
              <Pressable style={styles.btnOutline} onPress={() => setModalOpen(false)}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => void save()}>
                <Text style={styles.btnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  scroll: { flex: 1 },
  pad: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
  muted: { color: "#64748b", fontSize: 14 },
  err: { color: "#b91c1c", marginBottom: 8 },
  monthRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  monthBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
  },
  monthBtnText: { fontSize: 16, color: "#0f172a" },
  monthLabel: { fontSize: 18, fontWeight: "600", flex: 1, textAlign: "center" },
  btn: {
    backgroundColor: "#0f172a",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  btnText: { color: "#fff", fontWeight: "600" },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  btnDanger: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#fef2f2",
  },
  btnDangerText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  label: { fontSize: 13, color: "#64748b", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  rowBtns: { flexDirection: "row", gap: 8, marginTop: 8 },
  btnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnOutlineText: { color: "#334155", fontWeight: "500" },
});

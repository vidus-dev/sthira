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
import { createGoalsApi, type FinancialGoalRead, type GoalKind } from "../api/goalsApi";
import { formatMoney } from "../core/format/currency";
import { ApiError } from "../core/api/ApiError";

const KINDS: GoalKind[] = ["custom", "wedding", "emergency", "vacation"];

export function GoalsScreen() {
  const http = useMemo(
    () =>
      createJsonHttpClient({
        getBaseUrl: getApiBaseUrl,
        defaultTimeoutMs: getDefaultTimeoutMs(),
        getExtraHeaders: getExtraHeadersForApi,
      }),
    []
  );
  const api = useMemo(() => createGoalsApi(http), [http]);
  const [rows, setRows] = useState<FinancialGoalRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<FinancialGoalRead | null>(null);
  const [name, setName] = useState("Trip");
  const [kind, setKind] = useState<GoalKind>("custom");
  const [target, setTarget] = useState("100000");
  const [saved, setSaved] = useState("0");

  const load = useCallback(async () => {
    if (!isApiConfigured()) return;
    setLoading(true);
    setErr(null);
    try {
      setRows(await api.list());
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditRow(null);
    setName("Trip");
    setKind("custom");
    setTarget("100000");
    setSaved("0");
    setModalOpen(true);
  }

  function openEdit(g: FinancialGoalRead) {
    setEditRow(g);
    setName(g.name);
    setKind((g.goal_kind as GoalKind) || "custom");
    setTarget(String(g.target_amount));
    setSaved(String(g.saved_amount));
    setModalOpen(true);
  }

  async function save() {
    setErr(null);
    try {
      if (editRow) {
        await api.patch(editRow.id, {
          name,
          goal_kind: kind,
          target_amount: target,
          saved_amount: saved,
        });
      } else {
        await api.create({
          name,
          goal_kind: kind,
          currency: "INR",
          target_amount: target,
          saved_amount: saved,
        });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  function confirmDelete(g: FinancialGoalRead) {
    Alert.alert("Delete goal", `Remove "${g.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void remove(g.id) },
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
        <Text style={styles.title}>Goals</Text>
        <Text style={styles.muted}>Set EXPO_PUBLIC_API_BASE_URL in .env.</Text>
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
        <Text style={styles.title}>Goals</Text>
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Pressable style={styles.btn} onPress={openCreate}>
          <Text style={styles.btnText}>New goal</Text>
        </Pressable>
        {loading && rows.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : (
          rows.map((g) => (
            <View key={g.id} style={styles.card}>
              <Pressable onPress={() => openEdit(g)}>
                <Text style={styles.cardTitle}>{g.name}</Text>
                <Text style={styles.muted}>
                  Target {formatMoney(g.target_amount, g.currency)} · Saved {formatMoney(g.saved_amount, g.currency)}
                </Text>
                {g.suggested_monthly_contribution != null ? (
                  <Text style={styles.hi}>
                    Suggested / month: {formatMoney(g.suggested_monthly_contribution, g.currency)}
                  </Text>
                ) : null}
              </Pressable>
              <Pressable style={styles.btnDanger} onPress={() => confirmDelete(g)}>
                <Text style={styles.btnDangerText}>Delete</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{editRow ? "Edit goal" : "New goal"}</Text>
              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} />
              <Text style={styles.label}>Kind</Text>
              <View style={styles.kindRow}>
                {KINDS.map((k) => (
                  <Pressable
                    key={k}
                    style={[styles.kindChip, kind === k && styles.kindChipOn]}
                    onPress={() => setKind(k)}
                  >
                    <Text style={[styles.kindChipText, kind === k && styles.kindChipTextOn]}>{k}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Target amount</Text>
              <TextInput style={styles.input} value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
              <Text style={styles.label}>Saved amount</Text>
              <TextInput style={styles.input} value={saved} onChangeText={setSaved} keyboardType="decimal-pad" />
              <View style={styles.rowBtns}>
                <Pressable style={styles.btnOutline} onPress={() => setModalOpen(false)}>
                  <Text style={styles.btnOutlineText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.btn} onPress={() => void save()}>
                  <Text style={styles.btnText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
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
  muted: { color: "#64748b", fontSize: 13 },
  hi: { color: "#0f172a", fontWeight: "500", marginTop: 6 },
  err: { color: "#b91c1c", marginBottom: 8 },
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
    padding: 16,
  },
  modalScroll: { flexGrow: 1, justifyContent: "center" },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  label: { fontSize: 13, color: "#64748b", marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  kindRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  kindChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  kindChipOn: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  kindChipText: { fontSize: 12, color: "#334155", textTransform: "capitalize" },
  kindChipTextOn: { color: "#fff" },
  rowBtns: { flexDirection: "row", gap: 8, marginTop: 16 },
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

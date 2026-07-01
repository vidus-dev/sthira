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
import { createAccountsApi, type AccountRow } from "../api/accountsApi";
import { formatMoney } from "../core/format/currency";
import { ApiError } from "../core/api/ApiError";

export function AccountsScreen() {
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
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("Checking");
  const [balance, setBalance] = useState("0");

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
    setEditId(null);
    setName("Checking");
    setBalance("0");
    setModalOpen(true);
  }

  function openEdit(a: AccountRow) {
    setEditId(a.id);
    setName(a.display_name);
    setBalance(String(a.balance));
    setModalOpen(true);
  }

  async function save() {
    setErr(null);
    try {
      if (editId) {
        await api.patch(editId, { display_name: name, balance });
      } else {
        await api.create({ display_name: name, balance, currency: "INR", account_type: "checking" });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  function confirmDelete(a: AccountRow) {
    Alert.alert("Delete account", `Remove "${a.display_name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteAccount(a.id),
      },
    ]);
  }

  async function deleteAccount(id: string) {
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
        <Text style={styles.title}>Accounts</Text>
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Pressable style={styles.btn} onPress={openCreate}>
          <Text style={styles.btnText}>New account</Text>
        </Pressable>
        {loading && rows.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : (
          rows.map((a) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.cardTitle}>{a.display_name}</Text>
              <Text style={styles.muted}>{formatMoney(a.balance, a.currency)} · {a.account_type}</Text>
              <View style={styles.rowBtns}>
                <Pressable style={styles.btnOutline} onPress={() => openEdit(a)}>
                  <Text style={styles.btnOutlineText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.btnDanger} onPress={() => confirmDelete(a)}>
                  <Text style={styles.btnDangerText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editId ? "Edit account" : "New account"}</Text>
            <Text style={styles.label}>Display name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
            <Text style={styles.label}>Balance</Text>
            <TextInput style={styles.input} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />
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
  btn: {
    backgroundColor: "#0f172a",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
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
  rowBtns: { flexDirection: "row", gap: 8, marginTop: 10 },
  btnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnOutlineText: { color: "#334155", fontWeight: "500" },
  btnDanger: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnDangerText: { color: "#b91c1c", fontWeight: "600" },
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
});

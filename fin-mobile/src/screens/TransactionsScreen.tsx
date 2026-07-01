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
import { createTransactionsApi, type TransactionRow } from "../api/transactionsApi";
import { formatMoney } from "../core/format/currency";
import { ApiError } from "../core/api/ApiError";

function toIsoOccurredAt(input: string): string {
  const t = Date.parse(input);
  if (Number.isFinite(t)) return new Date(t).toISOString();
  return new Date().toISOString();
}

export function TransactionsScreen() {
  const http = useMemo(
    () =>
      createJsonHttpClient({
        getBaseUrl: getApiBaseUrl,
        defaultTimeoutMs: getDefaultTimeoutMs(),
        getExtraHeaders: getExtraHeadersForApi,
      }),
    []
  );
  const accountsApi = useMemo(() => createAccountsApi(http), [http]);
  const txApi = useMemo(() => createTransactionsApi(http), [http]);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [txns, setTxns] = useState<TransactionRow[]>([]);
  const [filterAccountId, setFilterAccountId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [filterPickerOpen, setFilterPickerOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [editRow, setEditRow] = useState<TransactionRow | null>(null);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("uncategorized");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 19));

  const loadAccounts = useCallback(async () => {
    const list = await accountsApi.list();
    setAccounts(list);
    setAccountId((prev) => (prev && list.some((a) => a.id === prev) ? prev : list[0]?.id ?? ""));
  }, [accountsApi]);

  const loadTx = useCallback(async () => {
    if (!isApiConfigured()) return;
    setLoading(true);
    setErr(null);
    try {
      await loadAccounts();
      setTxns(await txApi.list(filterAccountId));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to load");
      setTxns([]);
    } finally {
      setLoading(false);
    }
  }, [txApi, filterAccountId, loadAccounts]);

  useEffect(() => {
    void loadTx();
  }, [loadTx]);

  function openCreate() {
    setEditRow(null);
    setAmount("");
    setDescription("");
    setCategory("uncategorized");
    setOccurredAt(new Date().toISOString().slice(0, 19));
    setModalOpen(true);
  }

  function openEdit(t: TransactionRow) {
    setEditRow(t);
    setAccountId(t.account_id);
    setAmount(String(t.amount));
    setDescription(t.description);
    setCategory(t.category_slug);
    setOccurredAt(t.occurred_at.slice(0, 19));
    setModalOpen(true);
  }

  async function save() {
    setErr(null);
    try {
      const occurred = toIsoOccurredAt(occurredAt);
      if (editRow) {
        await txApi.patch(editRow.id, {
          amount,
          description,
          category_slug: category,
          occurred_at: occurred,
        });
      } else {
        if (!accountId) {
          setErr("Create an account first, then add a transaction.");
          return;
        }
        await txApi.create({
          account_id: accountId,
          amount,
          description,
          category_slug: category,
          occurred_at: occurred,
        });
      }
      setModalOpen(false);
      await loadTx();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  function confirmDelete(t: TransactionRow) {
    Alert.alert("Delete transaction", "Remove this row?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteTxn(t.id) },
    ]);
  }

  async function deleteTxn(id: string) {
    try {
      await txApi.remove(id);
      await loadTx();
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

  const accountLabel = (id: string) => accounts.find((a) => a.id === id)?.display_name ?? id.slice(0, 8);

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pad}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadTx()} />}
      >
        <Text style={styles.title}>Transactions</Text>
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <Text style={styles.label}>Filter by account</Text>
        <Pressable style={styles.select} onPress={() => setFilterPickerOpen(true)}>
          <Text>{filterAccountId ? accountLabel(filterAccountId) : "All accounts"}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={openCreate}>
          <Text style={styles.btnText}>Add transaction</Text>
        </Pressable>
        {loading && txns.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : (
          txns.map((t) => (
            <View key={t.id} style={styles.card}>
              <Pressable onPress={() => openEdit(t)}>
                <Text style={styles.cardTitle}>{t.description || "(no description)"}</Text>
                <Text style={styles.muted}>
                  {formatMoney(t.amount, "INR")} · {t.category_slug}
                </Text>
                <Text style={styles.small}>
                  {accountLabel(t.account_id)} · {t.occurred_at.slice(0, 10)}
                </Text>
              </Pressable>
              <Pressable style={styles.btnDanger} onPress={() => confirmDelete(t)}>
                <Text style={styles.btnDangerText}>Delete</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={filterPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setFilterPickerOpen(false)}>
          <View style={styles.pickerCard}>
            <Pressable
              style={styles.pickerRow}
              onPress={() => {
                setFilterAccountId(undefined);
                setFilterPickerOpen(false);
              }}
            >
              <Text>All accounts</Text>
            </Pressable>
            {accounts.map((a) => (
              <Pressable
                key={a.id}
                style={styles.pickerRow}
                onPress={() => {
                  setFilterAccountId(a.id);
                  setFilterPickerOpen(false);
                }}
              >
                <Text>{a.display_name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={accountPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setAccountPickerOpen(false)}>
          <View style={styles.pickerCard}>
            {accounts.map((a) => (
              <Pressable
                key={a.id}
                style={styles.pickerRow}
                onPress={() => {
                  setAccountId(a.id);
                  setAccountPickerOpen(false);
                }}
              >
                <Text>{a.display_name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{editRow ? "Edit transaction" : "New transaction"}</Text>
              {!editRow ? (
                <>
                  <Text style={styles.label}>Account</Text>
                  <Pressable style={styles.select} onPress={() => setAccountPickerOpen(true)}>
                    <Text>{accountId ? accountLabel(accountId) : "Choose account"}</Text>
                  </Pressable>
                </>
              ) : null}
              <Text style={styles.label}>Amount (negative = expense)</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} value={description} onChangeText={setDescription} />
              <Text style={styles.label}>Category slug</Text>
              <TextInput style={styles.input} value={category} onChangeText={setCategory} autoCapitalize="none" />
              <Text style={styles.label}>Occurred at (e.g. 2026-05-30T14:30:00)</Text>
              <TextInput style={styles.input} value={occurredAt} onChangeText={setOccurredAt} />
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
  small: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  err: { color: "#b91c1c", marginBottom: 8 },
  label: { fontSize: 13, color: "#64748b", marginBottom: 4, marginTop: 8 },
  select: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
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
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
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
  pickerCard: {
    backgroundColor: "#fff",
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 8,
    maxHeight: "70%",
  },
  pickerRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
});

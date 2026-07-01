import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { getApiBaseUrl, isApiConfigured } from "../core/config";

export function SettingsScreen() {
  const { user, signOut, refreshSession } = useAuth();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.val}>{user?.email ?? user?.id ?? "—"}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>API base URL</Text>
        <Text style={styles.mono}>{isApiConfigured() ? getApiBaseUrl() : "(not set)"}</Text>
        <Text style={styles.hint}>
          Set EXPO_PUBLIC_API_BASE_URL. Use the same host style as the backend CORS list (localhost vs
          127.0.0.1) so session cookies work.
        </Text>
      </View>
      <Pressable style={styles.btnSecondary} onPress={() => void refreshSession()}>
        <Text style={styles.btnSecondaryText}>Refresh session</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={() => void signOut()}>
        <Text style={styles.btnText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fff" },
  pad: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 16 },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  label: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  val: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  mono: { fontSize: 13, color: "#334155" },
  hint: { fontSize: 12, color: "#94a3b8", marginTop: 8, lineHeight: 18 },
  btnSecondary: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  btnSecondaryText: { color: "#334155", fontWeight: "600" },
  btn: { backgroundColor: "#b91c1c", padding: 14, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
});

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useAuth } from "../auth/AuthContext";
import { isApiConfigured } from "../core/config";
import { ApiError } from "../core/api/ApiError";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setErr(null);
    if (!isApiConfigured()) {
      setErr("Set EXPO_PUBLIC_API_BASE_URL in .env (see .env.example).");
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.sub}>Use the same email and password as the API.</Text>
        {err ? <Text style={styles.err}>{err}</Text> : null}
        {!isApiConfigured() ? (
          <Text style={styles.warn}>Configure EXPO_PUBLIC_API_BASE_URL to reach fin-backend.</Text>
        ) : null}
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
        />
        <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={() => void onSubmit()} disabled={busy}>
          <Text style={styles.btnText}>{busy ? "…" : "Sign in"}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Register")} style={styles.linkWrap}>
          <Text style={styles.link}>No account? Register</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#0f172a" },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  title: { fontSize: 22, fontWeight: "600", color: "#fff", marginBottom: 6 },
  sub: { fontSize: 13, color: "#94a3b8", marginBottom: 16 },
  label: { fontSize: 13, color: "#cbd5e1", marginBottom: 4 },
  input: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    marginBottom: 12,
    fontSize: 16,
  },
  btn: { backgroundColor: "#fff", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#0f172a", fontWeight: "600", fontSize: 16 },
  err: { color: "#fca5a5", marginBottom: 12, fontSize: 13 },
  warn: { color: "#fde047", marginBottom: 12, fontSize: 13 },
  linkWrap: { marginTop: 16, alignItems: "center" },
  link: { color: "#93c5fd", fontSize: 14 },
});

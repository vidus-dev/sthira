import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../core/api/ApiError";
import { isApiConfigured } from "../../core/config";
import { usePalette } from "../../theme/ThemeProvider";
import { fonts, GUTTER } from "../../theme/tokens";
import { Button, TextField } from "../../ui/controls";
import { Rise } from "../../ui/layout";
import { PressableScale } from "../../ui/PressableScale";
import { Txt } from "../../ui/Txt";

function AuthLayout({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 72, paddingBottom: insets.bottom + 24, paddingHorizontal: GUTTER }}
        keyboardShouldPersistTaps="handled"
      >
        <Rise>
          <Txt allowFontScaling={false} style={{ fontFamily: fonts.light, fontSize: 52, letterSpacing: -2.2 }}>
            Sthira
          </Txt>
          <Txt variant="tag" style={{ letterSpacing: 2.2, marginTop: 6 }}>
            OUR MONEY, STEADY
          </Txt>
        </Rise>
        <Rise delay={120} style={{ marginTop: 56 }}>
          <Txt variant="section" style={{ fontSize: 20 }}>
            {title}
          </Txt>
          <View style={{ gap: 14, marginTop: 18 }}>{children}</View>
        </Rise>
        <View style={{ flex: 1 }} />
        <Rise delay={220} style={{ marginTop: 32, alignItems: "center" }}>
          {footer}
        </Rise>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.status === 0 ? e.message : e.message || "Something went wrong.";
  return "Something went wrong. Try again.";
}

const NOT_CONFIGURED = "The app isn't connected to a server yet (EXPO_PUBLIC_API_BASE_URL).";

export function SignInScreen() {
  const nav = useNavigation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(isApiConfigured() ? null : NOT_CONFIGURED);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) return setError("Enter your email and password");
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      footer={
        <PressableScale onPress={() => nav.navigate("SignUp")} hitSlop={10}>
          <Txt variant="label">
            New here? <Txt variant="label" tone="text">Create an account</Txt>
          </Txt>
        </PressableScale>
      }
    >
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} returnKeyType="go" error={error} />
      <Button size="lg" label="Sign in" loading={busy} onPress={submit} style={{ marginTop: 6 }} />
      <PressableScale onPress={() => nav.navigate("ForgotPassword")} hitSlop={10} style={{ alignSelf: "center", marginTop: 4 }}>
        <Txt variant="label">Forgot password?</Txt>
      </PressableScale>
    </AuthLayout>
  );
}

export function SignUpScreen() {
  const nav = useNavigation();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(isApiConfigured() ? null : NOT_CONFIGURED);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return setError("Tell us your name — it's shown on entries you add");
    if (!email.trim()) return setError("Enter your email");
    if (password.length < 8) return setError("Use at least 8 characters for the password");
    setBusy(true);
    setError(null);
    try {
      await register(email, password, name);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      footer={
        <PressableScale onPress={() => nav.goBack()} hitSlop={10}>
          <Txt variant="label">
            Already have an account? <Txt variant="label" tone="text">Sign in</Txt>
          </Txt>
        </PressableScale>
      }
    >
      <TextField label="Your name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" maxLength={80} />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint="At least 8 characters" onSubmitEditing={submit} error={error} />
      <Button size="lg" label="Create account" loading={busy} onPress={submit} style={{ marginTop: 6 }} />
    </AuthLayout>
  );
}

/** Reset a forgotten password with the recovery key saved from Settings. */
export function ForgotPasswordScreen() {
  const nav = useNavigation();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim()) return setError("Enter your email");
    if (key.replace(/[^a-z0-9]/gi, "").length < 16) return setError("The recovery key has 16 letters and numbers");
    if (password.length < 8) return setError("Use at least 8 characters for the new password");
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email, key, password);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      footer={
        <PressableScale onPress={() => nav.goBack()} hitSlop={10}>
          <Txt variant="label">
            Remembered it? <Txt variant="label" tone="text">Sign in</Txt>
          </Txt>
        </PressableScale>
      }
    >
      <Txt variant="label" style={{ lineHeight: 20 }}>
        Use the recovery key you saved from Settings → Recovery key. It works once; make a new one after.
      </Txt>
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
      <TextField label="Recovery key" value={key} onChangeText={setKey} autoCapitalize="characters" autoCorrect={false} placeholder="XXXX-XXXX-XXXX-XXXX" />
      <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint="At least 8 characters" onSubmitEditing={submit} error={error} />
      <Button size="lg" label="Reset and sign in" loading={busy} onPress={submit} style={{ marginTop: 6 }} />
    </AuthLayout>
  );
}

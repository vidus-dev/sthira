import { useEffect, useState } from "react";
import { Alert, ScrollView, Share, View } from "react-native";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../core/api/ApiError";
import { GUTTER } from "../../theme/tokens";
import { Button, TextField } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { tapHaptic } from "../../ui/PressableScale";
import { Sheet } from "../../ui/Sheet";
import { Txt } from "../../ui/Txt";

/** Create a one-time recovery key for resetting a forgotten password (no email needed). */
export function RecoveryKeySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, setUserFields } = useAuth();
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setKey(null);
  }, [visible]);

  async function create() {
    setBusy(true);
    try {
      const r = await api.auth.createRecoveryKey();
      setKey(r.recovery_key);
      setUserFields({ has_recovery_key: true });
      tapHaptic("success");
    } catch (e) {
      Alert.alert("Couldn't create a key", e instanceof ApiError ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  function confirmCreate() {
    if (!user?.has_recovery_key) return void create();
    Alert.alert("Replace your recovery key?", "The old key stops working.", [
      { text: "Cancel", style: "cancel" },
      { text: "Replace", style: "destructive", onPress: () => void create() },
    ]);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Recovery key">
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 16, paddingBottom: 8 }}>
        {key ? (
          <>
            <EdgeCard radius={18} padding={18}>
              <Txt variant="tag" style={{ letterSpacing: 1.2 }}>
                YOUR RECOVERY KEY
              </Txt>
              <Txt variant="mono" tone="text" selectable style={{ fontSize: 22, letterSpacing: 1.5, marginTop: 10 }}>
                {key}
              </Txt>
            </EdgeCard>
            <Txt variant="label" style={{ lineHeight: 20 }}>
              Write it down or keep it somewhere safe outside this phone. It's shown only now. With it you can set a new
              password from the sign-in screen (Forgot password?). It works once.
            </Txt>
            <Button
              variant="outline"
              icon="share"
              label="Save it somewhere"
              onPress={() => void Share.share({ message: `Sthira recovery key for ${user?.email}: ${key}` })}
            />
            <Button size="lg" icon="check" label="I've saved it" onPress={onClose} />
          </>
        ) : (
          <>
            <Txt variant="label" style={{ lineHeight: 20 }}>
              If you ever forget your password, this key lets you set a new one. Sthira doesn't use email for this, so
              keep the key safe.
            </Txt>
            <Txt variant="caption" tone={user?.has_recovery_key ? "positive" : "due"}>
              {user?.has_recovery_key ? "You have a recovery key." : "You don't have a recovery key yet."}
            </Txt>
            <Button size="lg" icon="key" label={user?.has_recovery_key ? "Make a new key" : "Create recovery key"} loading={busy} onPress={confirmCreate} />
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

export function ChangePasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCurrent("");
    setNext("");
    setError(null);
  }, [visible]);

  async function submit() {
    if (!current) return setError("Enter your current password");
    if (next.length < 8) return setError("Use at least 8 characters for the new password");
    setBusy(true);
    setError(null);
    try {
      await api.auth.changePassword(current, next);
      tapHaptic("success");
      onClose();
      Alert.alert("Password changed");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't change the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Change password">
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        <TextField label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="password" />
        <View>
          <TextField label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" hint="At least 8 characters" error={error} onSubmitEditing={submit} />
        </View>
        <Button size="lg" icon="check" label="Change password" loading={busy} onPress={submit} />
      </ScrollView>
    </Sheet>
  );
}

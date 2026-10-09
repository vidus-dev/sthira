import { useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import { useHousehold } from "../../api/hooks";
import { useAuth } from "../../auth/AuthContext";
import { useTheme, type ThemePreference } from "../../theme/ThemeProvider";
import { GUTTER } from "../../theme/tokens";
import { Button, Segmented, TextField, Toggle } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { Icon } from "../../ui/Icon";
import { Rise, Screen, SectionLabel } from "../../ui/layout";
import { Avatar, ListRow } from "../../ui/ListRow";
import { tapHaptic } from "../../ui/PressableScale";
import { StackHeader } from "../../ui/StackHeader";
import { Txt } from "../../ui/Txt";
import { useAppLock } from "../lock/AppLock";
import { firstName } from "../shared";
import { exportEntries } from "./exportEntries";
import { SharingSheet } from "./SharingSheet";

export function SettingsScreen() {
  const nav = useNavigation();
  const { palette, preference, setPreference } = useTheme();
  const { user, updateName, signOut } = useAuth();
  const { data: household } = useHousehold();
  const lock = useAppLock();
  const [name, setName] = useState(user?.display_name ?? "");
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const others = (household?.members ?? []).filter((m) => m.id !== user?.id);
  const chevron = <Icon name="chevronRight" size={15} color={palette.textMuted} strokeWidth={2} />;

  async function doExport() {
    setExporting(true);
    try {
      if (!(await exportEntries())) Alert.alert("Export isn't available here", "Try again from the phone app.");
    } catch (e) {
      Alert.alert("Couldn't export", e instanceof Error ? e.message : "");
    } finally {
      setExporting(false);
    }
  }

  async function saveName() {
    if ((user?.display_name ?? "") === name.trim()) return;
    try {
      await updateName(name);
      tapHaptic("success");
    } catch (e) {
      Alert.alert("Couldn't update your name", e instanceof Error ? e.message : "");
    }
  }

  return (
    <Screen>
      <StackHeader title="Settings" />

      <Rise delay={60} style={{ marginHorizontal: GUTTER, marginTop: 20 }}>
        <EdgeCard radius={20} padding={16}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Avatar name={user?.display_name} size={48} />
            <View style={{ flex: 1 }}>
              <Txt variant="section">{user?.display_name || "Your name"}</Txt>
              <Txt variant="mono" style={{ marginTop: 3 }} numberOfLines={1}>
                {user?.email}
              </Txt>
            </View>
          </View>
          <View style={{ marginTop: 16 }}>
            <TextField label="Your name" value={name} onChangeText={setName} onBlur={saveName} onSubmitEditing={saveName} returnKeyType="done" maxLength={80} />
          </View>
        </EdgeCard>
      </Rise>

      <Rise delay={120} style={{ marginTop: 26 }}>
        <SectionLabel label="MANAGE" />
        <View style={{ paddingHorizontal: GUTTER }}>
          {[
            { icon: "bank", title: "Accounts", sub: "Banks, cards, cash, wallets", to: "Accounts" as const },
            { icon: "dots", title: "Categories", sub: "Your own spending & income types", to: "Categories" as const },
            { icon: "plan", title: "Monthly plan items", sub: "Rent, EMI, 10% and 5% of salary…", to: "PlanItems" as const },
          ].map((r) => (
            <ListRow key={r.to} icon={r.icon} title={r.title} subtitle={r.sub} onPress={() => nav.navigate(r.to)} right={chevron} />
          ))}
          <ListRow
            icon="users"
            title="Share with family"
            subtitle={
              others.length
                ? `Shared with ${others.map((m) => firstName(m.display_name) || m.email.split("@")[0]).join(", ")}`
                : "Optional · let someone see and add to your accounts"
            }
            onPress={() => setSharing(true)}
            right={chevron}
          />
          <ListRow
            icon="share"
            title="Export entries"
            subtitle="CSV backup for Excel or Google Sheets"
            onPress={exporting ? undefined : doExport}
            right={exporting ? <ActivityIndicator size="small" color={palette.textMuted} /> : chevron}
          />
        </View>
      </Rise>

      <Rise delay={180} style={{ marginTop: 26, paddingHorizontal: GUTTER, gap: 14 }}>
        <Txt variant="tag" style={{ letterSpacing: 1.2 }}>
          APPEARANCE
        </Txt>
        <Segmented<ThemePreference>
          value={preference}
          onChange={setPreference}
          options={[
            { value: "system", label: "Auto" },
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
        />
        {lock.available ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 8 }}>
            <Icon name="fingerprint" size={20} color={palette.text} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyMedium">App lock</Txt>
              <Txt variant="caption">Ask for fingerprint when opening Sthira</Txt>
            </View>
            <Toggle value={lock.enabled} onChange={(v) => void lock.setEnabled(v)} />
          </View>
        ) : null}
      </Rise>

      <Rise delay={240} style={{ paddingHorizontal: GUTTER, marginTop: 28, gap: 14 }}>
        <Button
          variant="outline"
          icon="logout"
          label="Sign out"
          onPress={() =>
            Alert.alert("Sign out?", "Your data stays safe on the server.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => void signOut() },
            ])
          }
        />
        <Txt variant="tag" tone="faint" style={{ textAlign: "center" }}>
          STHIRA {Constants.expoConfig?.version ?? ""}
        </Txt>
      </Rise>

      <SharingSheet visible={sharing} onClose={() => setSharing(false)} />
    </Screen>
  );
}

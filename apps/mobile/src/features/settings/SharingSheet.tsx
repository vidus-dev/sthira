import { useEffect, useState } from "react";
import { Alert, ScrollView, Share, View } from "react-native";
import { useHousehold, useJoinHousehold, useRenameHousehold, useRotateInviteCode } from "../../api/hooks";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../core/api/ApiError";
import { fonts, GUTTER } from "../../theme/tokens";
import { Button, TextField } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { Hairline } from "../../ui/layout";
import { Avatar, ListRow } from "../../ui/ListRow";
import { tapHaptic } from "../../ui/PressableScale";
import { Sheet } from "../../ui/Sheet";
import { Txt } from "../../ui/Txt";

/**
 * Optional sharing: invite someone (spouse, parent, flatmate) to see and add to the same
 * accounts, or join someone else's. The app is single-person until this is used.
 */
export function SharingSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { data: household } = useHousehold();
  const rename = useRenameHousehold();
  const rotate = useRotateInviteCode();
  const join = useJoinHousehold();
  const [homeName, setHomeName] = useState("");
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && household) setHomeName(household.name);
  }, [visible, household?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const members = household?.members ?? [];
  const shared = members.length > 1;

  async function doJoin() {
    if (!code.trim()) return setJoinError("Enter the code from the other person's phone");
    setJoinError(null);
    try {
      const h = await join.mutateAsync(code.trim());
      tapHaptic("success");
      setCode("");
      onClose();
      Alert.alert(`You've joined ${h.name}`, "You now see the same accounts and entries.");
    } catch (e) {
      setJoinError(e instanceof ApiError ? e.message : "Couldn't join with that code.");
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={shared ? "Shared household" : "Share with family"}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        {shared ? (
          <>
            <TextField
              label="Household name"
              value={homeName}
              onChangeText={setHomeName}
              onBlur={() => homeName.trim() && homeName.trim() !== household?.name && rename.mutate(homeName.trim())}
              returnKeyType="done"
              maxLength={120}
            />
            <View>
              {members.map((m) => (
                <ListRow
                  key={m.id}
                  leading={<Avatar name={m.display_name} size={36} />}
                  title={m.display_name || m.email.split("@")[0]}
                  subtitle={m.id === user?.id ? "You" : m.email}
                  height={58}
                />
              ))}
            </View>
          </>
        ) : (
          <Txt variant="label" style={{ lineHeight: 20 }}>
            Sthira is just for you. If you'd like someone else — your spouse, a parent — to see and
            add to the same accounts, send them this code.
          </Txt>
        )}

        <EdgeCard radius={18} padding={16}>
          <Txt variant="caption">Invite code</Txt>
          <Txt allowFontScaling={false} style={{ fontFamily: fonts.mono, fontSize: 28, letterSpacing: 4, marginTop: 6 }}>
            {household?.invite_code ?? "····-····"}
          </Txt>
          <Txt variant="caption" style={{ marginTop: 8, lineHeight: 18 }}>
            On their phone: create an account, then Settings → Share with family → enter this code.
          </Txt>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <Button
              size="sm"
              icon="share"
              label="Share code"
              onPress={() => household && Share.share({ message: `Join my household on Sthira with this code: ${household.invite_code}` })}
            />
            <Button
              size="sm"
              variant="outline"
              label="New code"
              loading={rotate.isPending}
              onPress={() =>
                Alert.alert("Get a new code?", "The old code stops working.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "New code", onPress: () => rotate.mutate() },
                ])
              }
            />
          </View>
        </EdgeCard>

        {shared ? null : (
          <>
            <Hairline />
            <View style={{ gap: 10 }}>
              <Txt variant="bodyMedium" size={14}>
                Have an invite code?
              </Txt>
              <Txt variant="caption" style={{ lineHeight: 18 }}>
                Join someone else's household instead. Do this before adding accounts of your own.
              </Txt>
              <TextField value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="K7QM-4ZTX" autoCapitalize="characters" autoCorrect={false} error={joinError} />
              <Button label="Join" icon="users" variant="outline" loading={join.isPending} onPress={doJoin} />
            </View>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

import { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAccounts, useJoinHousehold, useMonthPlan } from "../../api/hooks";
import { currentMonth } from "../../core/format/dates";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../core/api/ApiError";
import { usePalette } from "../../theme/ThemeProvider";
import { GUTTER } from "../../theme/tokens";
import { Button, TextField } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { Icon } from "../../ui/Icon";
import { Rise, Screen } from "../../ui/layout";
import { PressableScale, tapHaptic } from "../../ui/PressableScale";
import { Txt } from "../../ui/Txt";
import { firstName } from "../shared";

/**
 * First run after sign-up. Sthira is personal by default: set up your accounts and
 * monthly plan. Joining someone else's household is a small, optional link.
 */
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const palette = usePalette();
  const nav = useNavigation();
  const { user } = useAuth();
  const { data: accounts = [] } = useAccounts();
  const planItems = useMonthPlan(currentMonth()).data?.items ?? [];
  const join = useJoinHousehold();
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function doJoin() {
    if (!code.trim()) return setError("Enter the invite code you were sent");
    setError(null);
    try {
      await join.mutateAsync(code.trim());
      tapHaptic("success");
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't join with that code.");
    }
  }

  const steps = [
    { done: accounts.length > 0, icon: "bank", title: "Add your accounts", body: "Each bank, credit card, cash and wallet with today's balance.", to: "Accounts", go: () => nav.navigate("Accounts") },
    { done: planItems.length > 0, icon: "plan", title: "Set up your monthly plan", body: "Rent, EMI, internet, 10% to guru and 5% donations.", to: "Plan", go: () => nav.navigate("Main", { screen: "Plan" }) },
  ];

  return (
    <Screen>
      <Rise style={{ paddingHorizontal: GUTTER, marginTop: 28 }}>
        <Txt variant="tag" style={{ letterSpacing: 1.8 }}>
          WELCOME{user?.display_name ? `, ${firstName(user.display_name).toUpperCase()}` : ""}
        </Txt>
        <Txt variant="title" style={{ fontSize: 30, marginTop: 10, lineHeight: 36 }}>
          Two steps and you're ready
        </Txt>
      </Rise>

      <Rise delay={120} style={{ paddingHorizontal: GUTTER, marginTop: 26, gap: 12 }}>
        {steps.map((s, i) => (
          <PressableScale key={s.to} onPress={s.go} scaleTo={0.985}>
            <EdgeCard radius={18} padding={16}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: s.done ? palette.inverseBg : "transparent",
                    borderWidth: s.done ? 0 : 1.5,
                    borderColor: palette.textFaint,
                  }}
                >
                  {s.done ? <Icon name="check" size={15} color={palette.inverseText} strokeWidth={2.6} /> : <Txt variant="tag">{i + 1}</Txt>}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyMedium">{s.title}</Txt>
                  <Txt variant="caption" style={{ marginTop: 3, lineHeight: 17 }}>
                    {s.body}
                  </Txt>
                </View>
                <Icon name="chevronRight" size={15} color={palette.textMuted} strokeWidth={2} />
              </View>
            </EdgeCard>
          </PressableScale>
        ))}
        <Button size="lg" label={steps.every((s) => s.done) ? "All set — open Sthira" : "Start using Sthira"} onPress={onDone} style={{ marginTop: 10 }} />
        <Txt variant="caption" tone="faint" style={{ textAlign: "center" }}>
          You can do these later from Settings.
        </Txt>
      </Rise>

      <Rise delay={200} style={{ paddingHorizontal: GUTTER, marginTop: 32 }}>
        {joining ? (
          <View style={{ gap: 12 }}>
            <Txt variant="label" style={{ lineHeight: 20 }}>
              Someone shared their Sthira with you? Enter their code to see and add to the same accounts.
            </Txt>
            <TextField label="Invite code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="K7QM-4ZTX" autoCapitalize="characters" autoCorrect={false} error={error} />
            <Button icon="users" variant="outline" label="Join" loading={join.isPending} onPress={doJoin} />
          </View>
        ) : (
          <PressableScale onPress={() => setJoining(true)} hitSlop={10} style={{ alignSelf: "center" }}>
            <Txt variant="label">
              Have an invite code? <Txt variant="label" tone="text">Join instead</Txt>
            </Txt>
          </PressableScale>
        )}
      </Rise>
    </Screen>
  );
}

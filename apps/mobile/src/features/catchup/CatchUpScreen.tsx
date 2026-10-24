import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, ScrollView, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { requestSmsPermission } from "../../../modules/sms-inbox";
import { useAccounts, useCategories, useCategoryMap } from "../../api/hooks";
import type { Account } from "../../api/types";
import { dayHeader, monoDay, timeLabel } from "../../core/format/dates";
import { formatINR } from "../../core/format/money";
import { usePalette } from "../../theme/ThemeProvider";
import { GUTTER } from "../../theme/tokens";
import { Button, Chip, Segmented, TextField } from "../../ui/controls";
import { EdgeCard } from "../../ui/EdgeCard";
import { Icon } from "../../ui/Icon";
import { EmptyState, Rise, Screen, SectionLabel, Skeleton } from "../../ui/layout";
import { IconCircle, ListRow } from "../../ui/ListRow";
import { Money } from "../../ui/Money";
import { PressableScale, tapHaptic } from "../../ui/PressableScale";
import { Sheet } from "../../ui/Sheet";
import { StackHeader } from "../../ui/StackHeader";
import { Txt } from "../../ui/Txt";
import { accountIcon, accountLabel, categoryIcon, categoryName } from "../shared";
import type { Draft, DraftKind } from "../sms/drafts";
import { useDraftActions, useSmsDrafts, useSmsPermission } from "../sms/useSmsDrafts";
import { BatchSheet } from "./BatchSheet";

/** Ticked by default: ready to add, and not something already entered by hand. */
const defaultTicked = (d: Draft) => Boolean(d.accountId) && (d.kind !== "transfer" || Boolean(d.destAccountId)) && !d.duplicateOf;

export function CatchUpScreen() {
  const nav = useNavigation();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [batch, setBatch] = useState(false);
  const sel = useDraftSelection();
  const showBar = sel.permission.granted && sel.drafts.length > 0;

  return (
    <View style={{ flex: 1 }}>
      <Screen contentStyle={showBar ? { paddingBottom: BAR_SPACE + insets.bottom } : undefined}>
        <StackHeader title="Catch up" subtitle="Bring Sthira up to date in one go" />
        <SmsSection sel={sel} />
        <Rise delay={200} style={{ marginTop: 30 }}>
          <SectionLabel label="OTHER WAYS" />
          <View style={{ paddingHorizontal: GUTTER }}>
            <ListRow
              icon="scale"
              title="Check balances"
              subtitle="Type what each bank shows; Sthira records the difference"
              onPress={() => nav.navigate("Reconcile")}
              right={<Icon name="chevronRight" size={15} color={palette.textMuted} strokeWidth={2} />}
            />
            <ListRow
              icon="type"
              title="Type several at once"
              subtitle="“swiggy 450 hdfc, milk 60 cash” — one line each"
              onPress={() => setBatch(true)}
              right={<Icon name="chevronRight" size={15} color={palette.textMuted} strokeWidth={2} />}
            />
          </View>
        </Rise>
        <BatchSheet visible={batch} onClose={() => setBatch(false)} />
      </Screen>
      {showBar ? <DraftBar sel={sel} /> : null}
    </View>
  );
}

/** Room left under the list so the last rows can scroll clear of the floating bar. */
const BAR_SPACE = 130;

type DraftSelection = ReturnType<typeof useDraftSelection>;

/** Which drafts are ticked. Lives above the list so the floating bar can act on it. */
function useDraftSelection() {
  const permission = useSmsPermission();
  const scan = useSmsDrafts();
  const actions = useDraftActions();
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  const drafts = useMemo(() => scan.data?.drafts ?? [], [scan.data]);
  // Tick new drafts as they arrive; keep the user's own choices for the rest.
  const [known, setKnown] = useState<Set<string>>(new Set());
  useEffect(() => {
    const fresh = drafts.filter((d) => !known.has(d.ref));
    if (!fresh.length) return;
    setKnown((k) => new Set([...k, ...fresh.map((d) => d.ref)]));
    setTicked((t) => new Set([...t, ...fresh.filter(defaultTicked).map((d) => d.ref)]));
  }, [drafts, known]);

  const tickedDrafts = drafts.filter((d) => ticked.has(d.ref));
  const chosen = tickedDrafts.filter((d) => defaultTicked({ ...d, duplicateOf: null }));

  return {
    permission,
    scan,
    actions,
    drafts,
    ticked,
    setTicked,
    chosen,
    /** Ticked, but no account matched yet — these can't be added until one is picked. */
    needAccount: tickedDrafts.length - chosen.length,
    unticked: drafts.filter((d) => !ticked.has(d.ref)),
    allTicked: drafts.length > 0 && tickedDrafts.length === drafts.length,
  };
}

/** Always-visible actions while bank SMS wait, floating over the list like the tab bar. */
function DraftBar({ sel }: { sel: DraftSelection }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { chosen, unticked, needAccount } = sel;
  const out = chosen.filter((d) => d.kind === "expense").reduce((s, d) => s + d.amount, 0);

  function addChosen() {
    const n = sel.actions.confirm(chosen);
    if (n) tapHaptic("success");
  }

  function skipUnticked() {
    Alert.alert(`Skip ${unticked.length} SMS?`, "They won't be suggested again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Skip", style: "destructive", onPress: () => void sel.actions.skip(unticked) },
    ]);
  }

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
      <LinearGradient
        pointerEvents="none"
        colors={[palette.scheme === "dark" ? "rgba(0,0,0,0)" : "rgba(250,250,249,0)", palette.bg]}
        locations={[0, 0.45]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: BAR_SPACE + 30 + insets.bottom }}
      />
      <View style={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 14, gap: 8 }}>
        {needAccount ? (
          <Txt variant="caption" tone="due" style={{ textAlign: "center" }}>
            {needAccount} ticked {needAccount === 1 ? "needs" : "need"} an account · tap {needAccount === 1 ? "it" : "them"} to choose
          </Txt>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {unticked.length ? (
            <Button variant="outline" size="lg" label={`Skip ${unticked.length}`} onPress={skipUnticked} accessibilityLabel={`Skip ${unticked.length} unticked`} />
          ) : null}
          <Button
            size="lg"
            icon="check"
            style={{ flex: 1 }}
            label={chosen.length ? `Add ${chosen.length} ${chosen.length === 1 ? "entry" : "entries"}` : "Tick the ones to add"}
            disabled={!chosen.length}
            onPress={addChosen}
            trailing={
              out ? (
                <Txt variant="mono" color={palette.scheme === "dark" ? "#4A4A4A" : "#B5B5B5"}>
                  {formatINR(out)} out
                </Txt>
              ) : undefined
            }
          />
        </View>
      </View>
    </View>
  );
}

function SmsSection({ sel }: { sel: DraftSelection }) {
  const palette = usePalette();
  const { permission, scan, actions, drafts, ticked, setTicked } = sel;
  const { data: accounts = [] } = useAccounts();
  const categoryMap = useCategoryMap();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [blocked, setBlocked] = useState(false);
  const byId = new Map(accounts.map((a) => [a.id, a]));

  async function allow() {
    const r = await requestSmsPermission();
    permission.recheck();
    if (r === "blocked") setBlocked(true);
  }

  if (!permission.supported) {
    return (
      <Rise delay={80} style={{ marginHorizontal: GUTTER, marginTop: 22 }}>
        <EdgeCard>
          <Txt variant="bodyMedium">Bank SMS</Txt>
          <Txt variant="label" style={{ marginTop: 6, lineHeight: 19 }}>
            Reading bank SMS works in the installed Android app. Use the other ways below here.
          </Txt>
        </EdgeCard>
      </Rise>
    );
  }

  if (!permission.granted) {
    return (
      <Rise delay={80} style={{ marginHorizontal: GUTTER, marginTop: 22 }}>
        <EdgeCard padding={18}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <IconCircle name="message" />
            <Txt variant="section" style={{ flex: 1 }}>
              Add entries from bank SMS
            </Txt>
          </View>
          <Txt variant="label" style={{ marginTop: 12, lineHeight: 20 }}>
            Your bank texts you for every payment. Sthira reads only those messages, on this phone, and turns them into
            entries you confirm. Personal messages and OTPs are never read, and the SMS text never leaves the phone.
          </Txt>
          {blocked ? (
            <>
              <Txt variant="caption" style={{ marginTop: 12, lineHeight: 18 }}>
                Android blocked the request. Open App info, tap ⋮ (top right) → Allow restricted settings, then
                Permissions → SMS → Allow.
              </Txt>
              <Button label="Open app settings" icon="sliders" style={{ marginTop: 14, alignSelf: "flex-start" }} onPress={() => void Linking.openSettings()} />
            </>
          ) : (
            <Button label="Allow SMS access" icon="message" style={{ marginTop: 16, alignSelf: "flex-start" }} onPress={() => void allow()} />
          )}
        </EdgeCard>
      </Rise>
    );
  }

  return (
    <Rise delay={80} style={{ marginTop: 24 }}>
      <SectionLabel
        label="FROM BANK SMS"
        right={
          <PressableScale onPress={() => void scan.refetch()} hitSlop={10} accessibilityLabel="Scan again">
            <Icon name="refresh" size={15} color={palette.textMuted} strokeWidth={1.8} />
          </PressableScale>
        }
      />
      {scan.isLoading ? (
        <View style={{ paddingHorizontal: GUTTER, gap: 10, marginTop: 14 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width="100%" height={56} radius={14} />
          ))}
        </View>
      ) : scan.isError ? (
        <Txt variant="label" style={{ paddingHorizontal: GUTTER, marginTop: 12 }}>
          Couldn't read your SMS right now. Tap ↻ to try again.
        </Txt>
      ) : drafts.length === 0 ? (
        <EmptyState
          icon="check"
          title="All caught up"
          body={scan.data ? `No new bank transactions since ${dayHeader(new Date(scan.data.scannedFrom))}.` : undefined}
        />
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: GUTTER, marginTop: 8 }}>
            <Txt variant="label">{drafts.length} found · tap one to change it</Txt>
            <PressableScale
              hitSlop={10}
              onPress={() => setTicked(sel.allTicked ? new Set() : new Set(drafts.map((d) => d.ref)))}
              accessibilityRole="button"
            >
              <Txt variant="label" tone="text">
                {sel.allTicked ? "Untick all" : "Tick all"}
              </Txt>
            </PressableScale>
          </View>
          <View style={{ paddingHorizontal: GUTTER, marginTop: 6 }}>
            {drafts.map((d) => {
              const on = ticked.has(d.ref);
              const account = d.accountId ? byId.get(d.accountId) : undefined;
              const dest = d.destAccountId ? byId.get(d.destAccountId) : undefined;
              const needsAccount = !account || (d.kind === "transfer" && !dest);
              const title =
                d.kind === "transfer"
                  ? dest?.account_type === "credit"
                    ? "Card bill payment"
                    : "Moved between accounts"
                  : d.note || categoryName(categoryMap, d.categorySlug ?? "uncategorized");
              const where =
                d.kind === "transfer" && account && dest
                  ? `${account.display_name} → ${dest.display_name}`
                  : account
                    ? accountLabel(account)
                    : `${d.parsed.bank ?? "Bank"}${d.parsed.last4 ? ` ••${d.parsed.last4}` : ""}`;
              return (
                <View key={d.ref} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 66, borderBottomWidth: 1, borderBottomColor: palette.hairline }}>
                  <PressableScale
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={on ? "Ticked" : "Not ticked"}
                    hitSlop={8}
                    onPress={() => setTicked((t) => {
                      const n = new Set(t);
                      if (n.has(d.ref)) n.delete(d.ref);
                      else n.add(d.ref);
                      return n;
                    })}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: on ? palette.text : palette.textFaint,
                      backgroundColor: on ? palette.text : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {on ? <Icon name="check" size={14} color={palette.bg} strokeWidth={2.6} /> : null}
                  </PressableScale>
                  <PressableScale onPress={() => setEditing(d)} scaleTo={0.985} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
                    <IconCircle name={d.kind === "transfer" ? "swap" : categoryIcon(categoryMap, d.categorySlug ?? "dots")} size={34} dim={!on} />
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Txt variant="bodyMedium" numberOfLines={1} tone={on ? "text" : "muted"}>
                        {title}
                      </Txt>
                      <Txt variant="caption" numberOfLines={1} tone={needsAccount ? "due" : "muted"}>
                        {needsAccount
                          ? `Choose account · ${where}`
                          : d.duplicateOf
                            ? `Already added? · ${where}`
                            : `${dayHeader(new Date(d.date))} ${timeLabel(new Date(d.date))} · ${where}`}
                      </Txt>
                    </View>
                    <Money
                      value={d.kind === "income" ? d.amount : d.kind === "expense" ? -d.amount : d.amount}
                      signed={d.kind !== "transfer"}
                      tone={d.kind === "income" ? "positive" : d.kind === "transfer" ? "muted" : "text"}
                    />
                  </PressableScale>
                </View>
              );
            })}
          </View>
        </>
      )}
      <DraftSheet
        draft={editing}
        accounts={accounts}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (!editing) return;
          actions.update(editing.ref, patch);
          setTicked((t) => new Set([...t, editing.ref]));
          setEditing(null);
        }}
        onSkip={() => {
          if (editing) void actions.skip([editing]);
          setEditing(null);
        }}
      />
    </Rise>
  );
}

function DraftSheet({
  draft,
  accounts,
  onClose,
  onSave,
  onSkip,
}: {
  draft: Draft | null;
  accounts: Account[];
  onClose: () => void;
  onSave: (patch: Partial<Draft>) => void;
  onSkip: () => void;
}) {
  const { data: categories = [] } = useCategories();
  const [kind, setKind] = useState<DraftKind>("expense");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [destId, setDestId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!draft) return;
    setKind(draft.kind);
    setAccountId(draft.accountId);
    setDestId(draft.destAccountId);
    setSlug(draft.categorySlug);
    setNote(draft.note);
  }, [draft]);

  const kindCategories = categories.filter((c) => c.kind === (kind === "income" ? "income" : "expense"));
  const canTransfer = draft?.parsed.direction === "debit" || draft?.kind === "transfer";

  function save() {
    if (!draft) return;
    const toIncome = kind === "income";
    onSave({
      kind,
      accountId,
      destAccountId: kind === "transfer" ? destId : null,
      destRef: kind === "transfer" ? draft.destRef : null,
      categorySlug: kind === "transfer" ? null : slug && kindCategories.some((c) => c.slug === slug) ? slug : toIncome ? "other-income" : "other",
      note: note.trim(),
      duplicateOf: null,
    });
  }

  return (
    <Sheet visible={Boolean(draft)} onClose={onClose} title={draft ? `${formatINR(draft.amount, { paise: draft.amount % 1 !== 0 })} · ${monoDay(new Date(draft.date))}` : ""}>
      {draft ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
          {draft.duplicateOf ? (
            <Txt variant="caption" tone="due" style={{ lineHeight: 18 }}>
              An entry with the same amount and account was added by hand around then. Skip this if it's the same one.
            </Txt>
          ) : null}
          <Segmented<DraftKind>
            value={kind}
            onChange={setKind}
            options={[
              { value: "expense", label: "Expense" },
              { value: "income", label: "Income" },
              ...(canTransfer ? [{ value: "transfer" as const, label: "Transfer" }] : []),
            ]}
          />
          <TextField label="What for" value={note} onChangeText={setNote} placeholder="e.g. Swiggy" maxLength={120} />
          {kind === "transfer" ? null : (
            <View style={{ gap: 10 }}>
              <Txt variant="caption">Category</Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {kindCategories.map((c) => (
                  <Chip key={c.slug} label={c.name} icon={c.icon} selected={c.slug === slug} onPress={() => setSlug(c.slug)} />
                ))}
              </View>
            </View>
          )}
          <AccountChips label={kind === "income" ? "Received in" : kind === "transfer" ? "From" : "Paid from"} accounts={accounts} value={accountId} onChange={setAccountId} />
          {kind === "transfer" ? (
            <AccountChips label="To" accounts={accounts.filter((a) => a.id !== accountId)} value={destId} onChange={setDestId} />
          ) : null}
          <Button size="lg" icon="check" label="Done" onPress={save} />
          <Button variant="ghost" label="Skip this SMS" onPress={onSkip} />
        </ScrollView>
      ) : null}
    </Sheet>
  );
}

function AccountChips({ label, accounts, value, onChange }: { label: string; accounts: Account[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <Txt variant="caption">{label}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {accounts.map((a) => (
          <Chip key={a.id} label={accountLabel(a)} icon={accountIcon(a.account_type)} selected={a.id === value} onPress={() => onChange(a.id)} />
        ))}
      </View>
    </View>
  );
}

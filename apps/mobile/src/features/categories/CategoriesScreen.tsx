import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useArchiveCategory, useCategories, useSaveCategory } from "../../api/hooks";
import type { Category, CategoryKind } from "../../api/types";
import { ApiError } from "../../core/api/ApiError";
import { usePalette } from "../../theme/ThemeProvider";
import { GUTTER } from "../../theme/tokens";
import { Button, Segmented, TextField } from "../../ui/controls";
import { CATEGORY_ICONS, Icon } from "../../ui/Icon";
import { Rise, Screen, SectionLabel } from "../../ui/layout";
import { ListRow } from "../../ui/ListRow";
import { PressableScale, tapHaptic } from "../../ui/PressableScale";
import { Sheet } from "../../ui/Sheet";
import { StackHeader } from "../../ui/StackHeader";
import { Txt } from "../../ui/Txt";

export function CategoriesScreen() {
  const palette = usePalette();
  const { data = [] } = useCategories();
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [editing, setEditing] = useState<{ category?: Category; kind: CategoryKind } | null>(null);
  const rows = data.filter((c) => c.kind === kind);

  return (
    <Screen>
      <StackHeader
        title="Categories"
        subtitle="Pick these when you add an entry"
        right={<Button size="sm" icon="plus" label="New" onPress={() => setEditing({ kind })} />}
      />
      <Rise delay={60} style={{ paddingHorizontal: GUTTER, marginTop: 18 }}>
        <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: "Spending" }, { value: "income", label: "Income" }]} />
      </Rise>
      <Rise delay={120} style={{ marginTop: 18 }}>
        <SectionLabel label={kind === "expense" ? "SPENDING" : "INCOME"} right={String(rows.length)} />
        <View style={{ paddingHorizontal: GUTTER }}>
          {rows.map((c) => (
            <ListRow
              key={c.id}
              icon={c.icon}
              title={c.name}
              height={58}
              onPress={() => setEditing({ category: c, kind: c.kind })}
              right={<Icon name="chevronRight" size={15} color={palette.textMuted} strokeWidth={2} />}
            />
          ))}
        </View>
      </Rise>
      <CategoryEditor editing={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function CategoryEditor({ editing, onClose }: { editing: { category?: Category; kind: CategoryKind } | null; onClose: () => void }) {
  const palette = usePalette();
  const save = useSaveCategory();
  const archive = useArchiveCategory();
  const [current, setCurrent] = useState(editing);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("dots");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setCurrent(editing);
    setName(editing.category?.name ?? "");
    setIcon(editing.category?.icon ?? "dots");
    setError(null);
  }, [editing]);

  async function submit() {
    if (!current) return;
    if (!name.trim()) return setError("Give it a name");
    try {
      await save.mutateAsync({ id: current.category?.id, name: name.trim(), kind: current.kind, icon });
      tapHaptic("success");
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save.");
    }
  }

  function confirmArchive() {
    const c = current?.category;
    if (!c) return;
    Alert.alert(`Archive ${c.name}?`, "It won't be offered for new entries. Old entries keep it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", style: "destructive", onPress: () => archive.mutate(c.id, { onSuccess: onClose }) },
    ]);
  }

  return (
    <Sheet
      visible={Boolean(editing)}
      onClose={onClose}
      title={current?.category ? "Edit category" : "New category"}
      headerRight={
        current?.category ? (
          <PressableScale accessibilityLabel="Archive" onPress={confirmArchive} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
            <Icon name="trash" size={18} color={palette.negative} />
          </PressableScale>
        ) : null
      }
    >
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Temple" maxLength={80} error={error} />
        <Txt variant="caption">Icon</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {CATEGORY_ICONS.map((key) => {
            const selected = key === icon;
            return (
              <PressableScale
                key={key}
                accessibilityLabel={key}
                accessibilityState={{ selected }}
                onPress={() => setIcon(key)}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected ? palette.inverseBg : palette.iconBg,
                  borderWidth: 1,
                  borderColor: selected ? palette.inverseBg : palette.iconBorder,
                }}
              >
                <Icon name={key} size={19} color={selected ? palette.inverseText : palette.text} />
              </PressableScale>
            );
          })}
        </View>
        <Button size="lg" icon="check" label="Save" loading={save.isPending} onPress={submit} />
      </ScrollView>
    </Sheet>
  );
}

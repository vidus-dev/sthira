import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "../../api/client";

/**
 * Download every entry as CSV and hand it to the share sheet (Drive, WhatsApp, email…).
 * Returns false when this device can't share files.
 */
export async function exportEntries(): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const csv = await api.export.transactionsCsv();
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `sthira-entries-${stamp}.csv`);
  if (file.exists) file.delete();
  file.write(csv);
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
    dialogTitle: "Save or send your entries",
  });
  return true;
}

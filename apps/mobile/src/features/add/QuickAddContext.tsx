import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Transaction } from "../../api/types";
import { QuickAddSheet, type EntryKind } from "./QuickAddSheet";

export type QuickAddOptions = {
  kind?: EntryKind;
  edit?: Transaction;
  /** Start filled in, e.g. a bucket top-up: transfer ₹5,600 into account 1234. */
  prefill?: { amount?: number; accountId?: string; destId?: string; note?: string };
};

type Ctx = { open: (opts?: QuickAddOptions) => void };

const QuickAddContext = createContext<Ctx | null>(null);

/** Hosts the one quick-add sheet; any screen can open it (new entry or edit). */
export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ visible: boolean; opts: QuickAddOptions; nonce: number }>({
    visible: false,
    opts: {},
    nonce: 0,
  });
  const open = useCallback(
    (opts: QuickAddOptions = {}) => setState((s) => ({ visible: true, opts, nonce: s.nonce + 1 })),
    []
  );
  const close = useCallback(() => setState((s) => ({ ...s, visible: false })), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <QuickAddContext.Provider value={value}>
      {children}
      {state.nonce > 0 ? (
        <QuickAddSheet key={state.nonce} visible={state.visible} options={state.opts} onClose={close} />
      ) : null}
    </QuickAddContext.Provider>
  );
}

export function useQuickAdd(): Ctx {
  const ctx = useContext(QuickAddContext);
  if (!ctx) throw new Error("useQuickAdd must be used within QuickAddProvider");
  return ctx;
}

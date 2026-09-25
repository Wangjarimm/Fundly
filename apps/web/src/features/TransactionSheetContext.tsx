import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { Transaction } from "../api/hooks";
import { TransactionForm } from "./TransactionForm";

const Ctx = createContext<(tx?: Transaction) => void>(() => {});

/** Membuka form transaksi dari mana saja (tombol tambah, baris transaksi). */
export const useOpenTransaction = () => useContext(Ctx);

export function TransactionSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; tx: Transaction | null }>({ open: false, tx: null });
  const open = useCallback((tx?: Transaction) => setState({ open: true, tx: tx ?? null }), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      <TransactionForm open={state.open} editing={state.tx} onClose={() => setState({ open: false, tx: null })} />
    </Ctx.Provider>
  );
}

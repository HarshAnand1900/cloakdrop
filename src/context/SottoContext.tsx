"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export type DarkMode = "light" | "dark";

interface AddressBookEntry {
  id: number;
  name: string;
  count: number;
  list: string;
}

interface BatchItem {
  id: number;
  name: string;
  count: number;
  token: string;
}

interface SottoState {
  mode: DarkMode;
  toggleMode: () => void;
  modeLabel: string;

  showSdk: boolean;
  toggleSdk: () => void;
  showNotif: boolean;
  toggleNotif: () => void;
  notifRead: boolean;
  markAllRead: () => void;
  showAddrBook: boolean;
  openAddrBook: () => void;
  closeAddrBook: () => void;
  showBatch: boolean;
  openBatch: () => void;
  closeBatch: () => void;
  showRevoke: boolean;
  openRevoke: () => void;
  closeRevoke: () => void;

  addressBook: AddressBookEntry[];
  saveToBook: (list: string) => void;
  loadFromBook: (list: string) => void;
  loadedList: string | null;
  clearLoadedList: () => void;

  batchQueue: BatchItem[];
  addToBatch: (item: Omit<BatchItem, "id">) => void;
  removeFromBatch: (id: number) => void;
  clearBatch: () => void;
}

const SottoContext = createContext<SottoState | null>(null);

export function SottoProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DarkMode>("light");
  const [showSdk, setShowSdk] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifRead, setNotifRead] = useState(false);
  const [showAddrBook, setShowAddrBook] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showRevoke, setShowRevoke] = useState(false);
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([
    { id: 1, name: "Q2 Investors", count: 6, list: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8, 12500\n0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, 8200\n0x90F79bf6EB2c4f870365E785982E1f101E93b906, 21000" },
    { id: 2, name: "Core Team", count: 4, list: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65, 8500\n0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc, 7200" },
  ]);
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [loadedList, setLoadedList] = useState<string | null>(null);

  // Persist mode to html element
  useEffect(() => {
    const saved = localStorage.getItem("sotto-mode") as DarkMode | null;
    if (saved) setMode(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", mode);
    localStorage.setItem("sotto-mode", mode);
  }, [mode]);

  const toggleMode = useCallback(() => setMode((m) => (m === "light" ? "dark" : "light")), []);

  const saveToBook = useCallback((list: string) => {
    const count = list.split("\n").filter((l) => /^0x[0-9a-fA-F]/.test(l.trim())).length;
    const name = "List " + new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    setAddressBook((prev) => [{ id: Date.now(), name, count, list }, ...prev].slice(0, 8));
  }, []);

  const loadFromBook = useCallback((list: string) => {
    setLoadedList(list);
    setShowAddrBook(false);
  }, []);

  const addToBatch = useCallback((item: Omit<BatchItem, "id">) => {
    setBatchQueue((prev) => [...prev, { ...item, id: Date.now() }]);
  }, []);

  const removeFromBatch = useCallback((id: number) => {
    setBatchQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  return (
    <SottoContext.Provider
      value={{
        mode, toggleMode,
        modeLabel: mode === "dark" ? "○ LIGHT" : "● DARK",
        showSdk, toggleSdk: () => setShowSdk((v) => !v),
        showNotif, toggleNotif: () => setShowNotif((v) => !v),
        notifRead, markAllRead: () => { setNotifRead(true); setShowNotif(false); },
        showAddrBook, openAddrBook: () => setShowAddrBook(true), closeAddrBook: () => setShowAddrBook(false),
        showBatch, openBatch: () => setShowBatch(true), closeBatch: () => setShowBatch(false),
        showRevoke, openRevoke: () => setShowRevoke(true), closeRevoke: () => setShowRevoke(false),
        addressBook, saveToBook, loadFromBook,
        loadedList, clearLoadedList: () => setLoadedList(null),
        batchQueue, addToBatch, removeFromBatch, clearBatch: () => setBatchQueue([]),
      }}
    >
      {children}
    </SottoContext.Provider>
  );
}

export function useSotto() {
  const ctx = useContext(SottoContext);
  if (!ctx) throw new Error("useSotto must be used inside SottoProvider");
  return ctx;
}

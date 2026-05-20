import { create } from "zustand";

interface PlayerConfigState {
  padding: number; // 0–64
  borderRadius: number; // 0–48
  setPadding: (v: number) => void;
  setBorderRadius: (v: number) => void;
}

export const usePlayerConfigStore = create<PlayerConfigState>((set) => ({
  padding: 16,
  borderRadius: 16,
  setPadding: (v) => set({ padding: v }),
  setBorderRadius: (v) => set({ borderRadius: v }),
}));

// src/store/useBusinessStore.ts
import { create } from "zustand";
import type { Business } from "../data/businesses";
import { businesses as MOCK, LOCATION_INFO } from "../data/businesses";

type Mode = "mock" | "session";

interface BusinessState {
  mode: Mode;
  businesses: Business[];
  mockBusinesses: Business[];
  loadMock: () => void;
  setFromImported: (data: Business[]) => void;
  fetchFromServer: () => Promise<void>;
  resetToMock: () => void;
}

export const useBusinessStore = create<BusinessState>((set, get) => ({
  mode: "mock",
  businesses: MOCK,              // start with your mock data by default
  mockBusinesses: MOCK,

  loadMock: () => set((state) => ({ mode: "mock", businesses: state.mockBusinesses })),

  setFromImported: (data) => set(() => ({ mode: "session", businesses: data })),

  fetchFromServer: async () => {
    const token = localStorage.getItem("access_token");
    const res = await fetch("http://127.0.0.1:8000/api/v1/businesses", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch businesses");
    const data: Business[] = await res.json();
    set(() => ({ mode: "session", businesses: data }));
  },

  resetToMock: () => set((state) => ({ mode: "mock", businesses: state.mockBusinesses })),
}));

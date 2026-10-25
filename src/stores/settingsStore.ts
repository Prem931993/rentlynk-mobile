import { create } from "zustand";

interface SettingsState {
  currency: string;
  symbol: string;
  companyName: string;
  supportEmail: string;
  supportPhone: string;
  tagline: string;
  country: string;
  set: (s: Partial<Omit<SettingsState, "set">>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  currency: "INR",
  symbol: "₹",
  companyName: "RentLynk",
  supportEmail: "support@rentlynk.com",
  supportPhone: "",
  tagline: "Renting, simplified.",
  country: "India",
  set: (s) => set(s),
}));

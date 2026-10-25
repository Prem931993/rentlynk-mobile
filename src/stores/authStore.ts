import { create } from "zustand";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";
import { authEvents, ensureFreshToken, tokens } from "../api/client";
import { Auth, Requirements, User } from "../api/endpoints";
import { KEYS, prefs, secureStorage } from "../api/secureStorage";

type Status = "booting" | "signedOut" | "locked" | "signedIn";

interface AuthState {
  status: Status;
  user: User | null;
  requirements: Requirements;
  onboardingSeen: boolean;
  /** True once this device has signed in before — Welcome is then skipped and Login opens first. */
  returningUser: boolean;
  biometricEnabled: boolean;
  signOutReason: string | null;
  bootstrap: () => Promise<void>;
  applySession: (data: { user: User; accessToken: string; refreshToken: string; requirements: Requirements }) => Promise<void>;
  signIn: (identifier: string, cred: { pin?: string; password?: string }) => Promise<void>;
  register: (body: object) => Promise<any>;
  refreshMe: () => Promise<void>;
  signOut: (reason?: string) => Promise<void>;
  setUser: (u: User) => void;
  setRequirements: (r: Partial<Requirements>) => void;
  setOnboardingSeen: () => void;
  setBiometric: (on: boolean) => Promise<boolean>;
  unlock: () => Promise<boolean>;
}

const EMPTY: Requirements = { must_change_password: false, must_set_pin: false, pending_consents: [] };

export const biometricAvailable = async () => {
  if (Platform.OS === "web") return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch { return false; }
};

export const useAuth = create<AuthState>((set, get) => ({
  status: "booting",
  user: null,
  requirements: EMPTY,
  onboardingSeen: false,
  returningUser: false,
  biometricEnabled: false,
  signOutReason: null,

  bootstrap: async () => {
    const [seen, bio, lastEmail] = await Promise.all([prefs.get<boolean>("onboardingSeen"), prefs.get<boolean>("biometric"), prefs.get<string>("lastEmail")]);
    set({ onboardingSeen: !!seen, biometricEnabled: !!bio, returningUser: !!lastEmail });
    const { refresh } = await tokens.load();
    if (!refresh) return set({ status: "signedOut" });
    try {
      let me;
      try {
        me = await Auth.me();
      } catch (e: any) {
        if (e?.response?.status === 401 || !tokens.access) {
          const fresh = await ensureFreshToken();
          if (!fresh) throw e;
          me = await Auth.me();
        } else throw e;
      }
      const lock = !!bio && (await biometricAvailable());
      set({ user: me.user, requirements: me.requirements, status: lock ? "locked" : "signedIn" });
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        await tokens.clear();
        set({ status: "signedOut", user: null });
      } else {
        // Server unreachable at launch: tokens are kept, so signing in again later is quick.
        set({ status: "signedOut", signOutReason: "We couldn't reach RentLynk. Check your connection and sign in again." });
      }
    }
  },

  applySession: async ({ user, accessToken, refreshToken, requirements }) => {
    await tokens.save(accessToken, refreshToken);
    await prefs.set("lastEmail", user.email);
    set({ user, requirements: requirements || EMPTY, status: "signedIn", signOutReason: null, returningUser: true, onboardingSeen: true });
    prefs.set("onboardingSeen", true);
  },

  signIn: async (identifier, cred) => {
    const id = identifier.trim();
    const data = await Auth.login(id.includes("@") ? id.toLowerCase() : id, cred);
    await prefs.set("lastIdentifier", id);
    await get().applySession(data);
  },

  register: async (body) => {
    const data = await Auth.register(body);
    await get().applySession(data);
    return data;
  },

  refreshMe: async () => {
    const me = await Auth.me();
    set({ user: me.user, requirements: me.requirements });
  },

  signOut: async (reason) => {
    const refresh = await secureStorage.get(KEYS.refresh);
    Auth.logout(refresh).catch(() => {});
    await tokens.clear();
    set({ status: "signedOut", user: null, requirements: EMPTY, signOutReason: reason || null });
  },

  setUser: (user) => set({ user }),
  setRequirements: (r) => set({ requirements: { ...get().requirements, ...r } }),
  setOnboardingSeen: () => { prefs.set("onboardingSeen", true); set({ onboardingSeen: true }); },

  setBiometric: async (on) => {
    if (on) {
      if (!(await biometricAvailable())) return false;
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: "Confirm to enable biometric unlock" });
      if (!r.success) return false;
    }
    await prefs.set("biometric", on);
    set({ biometricEnabled: on });
    return true;
  },

  unlock: async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock RentLynk", fallbackLabel: "Use passcode" });
    if (r.success) set({ status: "signedIn" });
    return r.success;
  },
}));

// Wire API client events to the store.
authEvents.onSignedOut = (reason) => {
  if (useAuth.getState().status !== "signedOut") useAuth.getState().signOut(reason === "expired" ? "Your session expired. Please sign in again." : undefined);
};
authEvents.onRequirement = (code, details) => {
  if (code === "PASSWORD_CHANGE_REQUIRED") useAuth.getState().setRequirements({ must_change_password: true });
  else if (code === "PIN_SETUP_REQUIRED") useAuth.getState().setRequirements({ must_set_pin: true });
  else useAuth.getState().setRequirements({ pending_consents: details?.documents || [] });
};

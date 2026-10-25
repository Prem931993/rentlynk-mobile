import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Tokens live in the OS keychain / keystore (expo-secure-store).
 * The web build has no keychain, so it falls back to AsyncStorage (localStorage).
 */
const isWeb = Platform.OS === "web";
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const secureStorage = {
  async get(key: string) {
    try { return isWeb ? await AsyncStorage.getItem(key) : await SecureStore.getItemAsync(key, OPTS); } catch { return null; }
  },
  async set(key: string, value: string | null) {
    try {
      if (value === null) return isWeb ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key, OPTS);
      return isWeb ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value, OPTS);
    } catch { /* ignore */ }
  },
};

/** Non-sensitive preferences (onboarding seen, biometric toggle, last email). */
export const prefs = {
  async get<T = string>(key: string): Promise<T | null> {
    try { const v = await AsyncStorage.getItem(`rl:${key}`); return v ? JSON.parse(v) : null; } catch { return null; }
  },
  async set(key: string, value: unknown) {
    try { await AsyncStorage.setItem(`rl:${key}`, JSON.stringify(value)); } catch { /* ignore */ }
  },
};

export const KEYS = { access: "rl_access_token", refresh: "rl_refresh_token" };

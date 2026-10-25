import axios, { AxiosError, AxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { KEYS, secureStorage } from "./secureStorage";

/**
 * API base URL: EXPO_PUBLIC_API_URL in production builds (must be https).
 * In development it falls back to the Expo dev-server host on port 5000.
 */
const resolveBase = () => {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.protocol}//${window.location.hostname}:5000`;
  const hostUri = Constants.expoConfig?.hostUri || "";
  const host = hostUri.split(":")[0] || "localhost";
  return `http://${host}:5000`;
};

export const API_ORIGIN = resolveBase();
export const api = axios.create({ baseURL: `${API_ORIGIN}/api`, timeout: 20000 });

let accessToken: string | null = null;
export const tokens = {
  async load() {
    accessToken = await secureStorage.get(KEYS.access);
    return { access: accessToken, refresh: await secureStorage.get(KEYS.refresh) };
  },
  async save(access: string, refresh?: string) {
    accessToken = access;
    await secureStorage.set(KEYS.access, access);
    if (refresh) await secureStorage.set(KEYS.refresh, refresh);
  },
  async clear() {
    accessToken = null;
    await secureStorage.set(KEYS.access, null);
    await secureStorage.set(KEYS.refresh, null);
  },
  get access() { return accessToken; },
};

/** Hooks the auth store registers so the client can sign out / show gates. */
export const authEvents = {
  onSignedOut: (_reason?: string) => {},
  onRequirement: (_code: "CONSENT_REQUIRED" | "PASSWORD_CHANGE_REQUIRED" | "PIN_SETUP_REQUIRED", _details?: any) => {},
};

api.interceptors.request.use((config) => {
  if (accessToken && !config.headers.Authorization) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

const refreshAccess = async (): Promise<string | null> => {
  const refresh = await secureStorage.get(KEYS.refresh);
  if (!refresh) return null;
  try {
    const { data } = await axios.post(`${API_ORIGIN}/api/auth/refresh`, { refreshToken: refresh }, { timeout: 15000 });
    await tokens.save(data.data.accessToken, data.data.refreshToken);
    return data.data.accessToken;
  } catch (e: any) {
    // Only drop the session when the server rejects it — not on network errors.
    if (e?.response?.status === 401) return null;
    throw e;
  }
};

export const ensureFreshToken = async () => {
  if (!refreshing) refreshing = refreshAccess().finally(() => { setTimeout(() => (refreshing = null), 0); });
  return refreshing;
};

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<any>) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const url = original?.url || "";

    if (status === 401 && !original._retry && !url.includes("/auth/login") && !url.includes("/auth/refresh") && !url.includes("/auth/register")) {
      original._retry = true;
      try {
        const fresh = await ensureFreshToken();
        if (fresh) {
          original.headers = { ...(original.headers || {}), Authorization: `Bearer ${fresh}` };
          return api(original);
        }
        await tokens.clear();
        authEvents.onSignedOut("expired");
      } catch { /* network error during refresh — surface original error */ }
    }
    if (status === 403 && (code === "CONSENT_REQUIRED" || code === "PASSWORD_CHANGE_REQUIRED" || code === "PIN_SETUP_REQUIRED")) {
      authEvents.onRequirement(code, error.response?.data?.errors);
    }
    return Promise.reject(error);
  }
);

/** Human-readable message for any API error. */
export const errorMessage = (e: any, fallback = "Something went wrong. Please try again.") => {
  if (e?.response?.data?.message) return e.response.data.message as string;
  if (e?.code === "ECONNABORTED") return "The server is taking too long. Check your connection and try again.";
  if (e?.message === "Network Error") return "Can't reach RentLynk. Check your internet connection.";
  return e?.message && !String(e.message).startsWith("Request failed") ? e.message : fallback;
};

export const fieldErrors = (e: any): Record<string, string> => {
  const out: Record<string, string> = {};
  const list = e?.response?.data?.errors;
  if (Array.isArray(list)) for (const it of list) if (it.field && !out[it.field]) out[it.field] = it.message;
  return out;
};

/** Absolute URL for signed file links the API returns as /api/files/... */
export const fileUrl = (u?: string | null) => (!u ? null : /^https?:/i.test(u) ? u : `${API_ORIGIN}${u}`);

export const unwrap = <T = any>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

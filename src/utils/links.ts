import { Linking, Share } from "react-native";
import { toast } from "../components/Feedback";
import { useSettingsStore } from "../stores/settingsStore";

/** Open any URL without ever throwing an unhandled promise rejection. */
export const openLink = async (url: string, failMessage = "Couldn't open this link on your device.") => {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    toast.error(failMessage);
    return false;
  }
};

const DIAL_CODES: Record<string, string> = { India: "91", "United States": "1", "United Kingdom": "44", UAE: "971", Singapore: "65" };

/** Digits-only international number; adds the platform country code to local 10-digit numbers. */
export const intlPhone = (phone: string) => {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) {
    const country = useSettingsStore.getState().country || "India";
    digits = (DIAL_CODES[country] || "91") + digits;
  }
  return digits;
};

export const callPhone = (phone: string) => openLink(`tel:${phone.replace(/[^\d+]/g, "")}`, "Calling isn't available on this device.");
export const sendEmail = (email: string) => openLink(`mailto:${email}`, "No email app is set up on this device.");

/**
 * Opens WhatsApp via the universal wa.me link: it launches the app when installed and
 * falls back to WhatsApp Web otherwise (no app-scheme permissions needed).
 */
export const openWhatsApp = async (opts: { phone?: string | null; text?: string }) => {
  const params = opts.text ? `?text=${encodeURIComponent(opts.text)}` : "";
  const url = opts.phone ? `https://wa.me/${intlPhone(opts.phone)}${params}` : `https://wa.me/${params}`;
  const ok = await openLink(url, "Couldn't open WhatsApp.");
  if (!ok && opts.text) Share.share({ message: opts.text }).catch(() => {});
};

import { useSettingsStore } from "../stores/settingsStore";

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

export const money = (amount: number | null | undefined, opts: { compact?: boolean; decimals?: boolean } = {}) => {
  const currency = useSettingsStore.getState().currency || "INR";
  const n = Number(amount || 0);
  const locale = currency === "INR" ? "en-IN" : "en-US";
  try {
    if (opts.compact && Math.abs(n) >= 1000) {
      const sym = useSettingsStore.getState().symbol || "₹";
      if (currency === "INR") {
        if (Math.abs(n) >= 1e7) return `${sym}${(n / 1e7).toFixed(1).replace(/\.0$/, "")}Cr`;
        if (Math.abs(n) >= 1e5) return `${sym}${(n / 1e5).toFixed(1).replace(/\.0$/, "")}L`;
        return `${sym}${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
      }
      return new Intl.NumberFormat(locale, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(n);
    }
    const hasPaise = Math.round(n * 100) % 100 !== 0;
    return new Intl.NumberFormat(locale, {
      style: "currency", currency,
      minimumFractionDigits: opts.decimals || hasPaise ? 2 : 0, maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${useSettingsStore.getState().symbol || ""}${n.toFixed(2)}`;
  }
};

export const parseDate = (s?: string | null) => {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const today = () => toISO(new Date());
export const addDays = (iso: string, n: number) => { const d = parseDate(iso)!; d.setDate(d.getDate() + n); return toISO(d); };

export const fmtDate = (s?: string | null, withYear = true) => {
  const d = parseDate(s);
  if (!d) return "—";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`;
};

export const fmtDateTime = (s?: string | null) => {
  const d = parseDate(s);
  if (!d) return "—";
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
  return `${fmtDate(s)}, ${((h + 11) % 12) + 1}:${m} ${h >= 12 ? "PM" : "AM"}`;
};

export const period = (month: number, year: number) => `${MONTHS[month - 1]} ${year}`;
/** "Jan 2028" — compact month + year for tight spaces. */
export const monthYear = (iso?: string | null) => (iso ? `${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "—");

export const daysUntil = (s?: string | null) => {
  const d = parseDate(s);
  if (!d) return 0;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
};

export const relativeDue = (s?: string | null) => {
  const n = daysUntil(s);
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  if (n > 1) return `Due in ${n} days`;
  if (n === -1) return "1 day overdue";
  return `${Math.abs(n)} days overdue`;
};

export const timeAgo = (s?: string | null) => {
  const d = parseDate(s);
  if (!d) return "";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return fmtDate(s);
};

export const titleCase = (s?: string | null) =>
  (s || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bUpi\b/g, "UPI").replace(/\bId\b/g, "ID");

export const initials = (name?: string | null) =>
  (name || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

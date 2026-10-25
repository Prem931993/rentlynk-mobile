import { Platform, TextStyle, ViewStyle } from "react-native";

export const colors = {
  // Brand
  primary: "#4F46E5",
  primaryDark: "#3730A3",
  primarySoft: "#EEF0FF",
  violet: "#7C3AED",
  ink: "#0B1026", // hero / splash background
  inkSoft: "#151B3B",

  // Surfaces
  bg: "#F5F6FB",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F2F8",
  border: "#E4E7F0",
  borderStrong: "#CDD3E1",

  // Text
  text: "#0F172A",
  textSecondary: "#475069",
  textMuted: "#8A93AB",
  textInverse: "#FFFFFF",

  // Semantic
  success: "#059669",
  successSoft: "#E7F8F1",
  warning: "#D97706",
  warningSoft: "#FFF5E1",
  danger: "#E11D48",
  dangerSoft: "#FFECEF",
  info: "#0284C7",
  infoSoft: "#E6F4FD",
  overlay: "rgba(11,16,38,0.55)",
};

export const gradients = {
  brand: ["#4F46E5", "#7C3AED"] as const,
  hero: ["#1E1B4B", "#312E81", "#4F46E5"] as const,
  night: ["#0B1026", "#1E1B4B"] as const,
  emerald: ["#059669", "#10B981"] as const,
  sunset: ["#F59E0B", "#EF4444"] as const,
  ocean: ["#0284C7", "#4F46E5"] as const,
};

export const radius = { xs: 8, sm: 12, md: 16, lg: 20, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

export const fonts = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
};

const t = (fontFamily: string, fontSize: number, lineHeight: number, extra: TextStyle = {}): TextStyle => ({
  fontFamily, fontSize, lineHeight, color: colors.text, ...extra,
});

export const type = {
  display: t(fonts.extrabold, 32, 38, { letterSpacing: -0.8 }),
  h1: t(fonts.extrabold, 26, 32, { letterSpacing: -0.5 }),
  h2: t(fonts.bold, 21, 28, { letterSpacing: -0.3 }),
  h3: t(fonts.bold, 17, 24, { letterSpacing: -0.2 }),
  title: t(fonts.semibold, 15, 21),
  body: t(fonts.regular, 15, 22, { color: colors.textSecondary }),
  bodyStrong: t(fonts.semibold, 15, 22),
  small: t(fonts.medium, 13, 18, { color: colors.textSecondary }),
  caption: t(fonts.medium, 12, 16, { color: colors.textMuted }),
  overline: t(fonts.bold, 11, 14, { color: colors.textMuted, letterSpacing: 1, textTransform: "uppercase" }),
  amount: t(fonts.extrabold, 30, 36, { letterSpacing: -0.8 }),
};

export const shadow = (level: 1 | 2 | 3 = 1): ViewStyle =>
  Platform.select({
    ios: {
      shadowColor: "#1E1B4B",
      shadowOpacity: [0.06, 0.1, 0.18][level - 1],
      shadowRadius: [10, 18, 28][level - 1],
      shadowOffset: { width: 0, height: [4, 8, 14][level - 1] },
    },
    android: { elevation: [2, 5, 10][level - 1] },
    default: { boxShadow: `0 ${[4, 8, 14][level - 1]}px ${[16, 28, 40][level - 1]}px rgba(30,27,75,${[0.06, 0.1, 0.16][level - 1]})` } as any,
  }) as ViewStyle;

/** Status → colour mapping used across badges, timelines and charts. */
export const statusTone: Record<string, "success" | "warning" | "danger" | "info" | "neutral" | "primary"> = {
  PAID: "success", VERIFIED: "success", ACTIVE: "success", RESOLVED: "success", COMPLETED: "success", ACCEPTED: "success", OCCUPIED: "success", CLOSED: "neutral",
  PENDING: "warning", PARTIALLY_PAID: "info", SUBMITTED: "warning", IN_PROGRESS: "info", ACKNOWLEDGED: "info", SETTLEMENT_PROPOSED: "primary",
  REQUESTED: "warning", NOTICE: "warning", UPCOMING: "info", RESERVED: "info", OPEN: "warning",
  OVERDUE: "danger", REJECTED: "danger", DISPUTED: "danger", URGENT: "danger", HIGH: "warning", MEDIUM: "info", LOW: "neutral",
  CANCELLED: "neutral", ENDED: "neutral", VACANT: "neutral", MAINTENANCE: "warning", EXPIRED: "neutral",
};

export const toneColors = {
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  primary: { fg: colors.primary, bg: colors.primarySoft },
  neutral: { fg: colors.textSecondary, bg: colors.surfaceAlt },
};

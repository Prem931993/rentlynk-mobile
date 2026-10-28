import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator, Animated, Image, Pressable, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, gradients, radius, shadow, space, statusTone, toneColors, type } from "../theme";
import { haptic } from "../utils/haptics";
import { initials, titleCase } from "../utils/format";
import { fileUrl } from "../api/client";

export type IconName = keyof typeof Ionicons.glyphMap;

// ── Typography ─────────────────────────────────────────────────────────────
export const T = ({ v = "body", color, center, style, ...p }: TextProps & { v?: keyof typeof type; color?: string; center?: boolean }) => (
  <Text {...p} style={[type[v], color ? { color } : null, center && { textAlign: "center" }, style]} />
);

// ── Pressable with scale feedback ──────────────────────────────────────────
export const Tap = ({ onPress, children, style, disabled, scale = 0.97, haptics = true, ...rest }: {
  onPress?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; disabled?: boolean; scale?: number; haptics?: boolean;
  accessibilityLabel?: string; hitSlop?: number;
}) => {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  // Layout props must sit on the outer Pressable so the element sizes correctly inside rows/grids.
  const flat = (StyleSheet.flatten(style) || {}) as Record<string, any>;
  const outer: Record<string, any> = {};
  const inner: Record<string, any> = {};
  for (const [k, v] of Object.entries(flat)) (OUTER_KEYS.has(k) ? outer : inner)[k] = v;
  return (
    <Pressable
      {...rest}
      style={outer}
      disabled={disabled || !onPress}
      onPressIn={() => to(scale)}
      onPressOut={() => to(1)}
      onPress={() => { if (haptics) haptic.tap(); onPress?.(); }}
      accessibilityRole="button"
    >
      <Animated.View style={[inner, (outer.flex || outer.width || outer.height) ? { flexGrow: 1 } : null, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
};

const OUTER_KEYS = new Set([
  "flex", "flexGrow", "flexShrink", "flexBasis", "width", "minWidth", "maxWidth", "alignSelf",
  "margin", "marginTop", "marginBottom", "marginLeft", "marginRight", "marginVertical", "marginHorizontal",
  "position", "top", "left", "right", "bottom", "zIndex",
]);

// ── Buttons ────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "light";
export const Button = ({ title, onPress, variant = "primary", icon, iconRight, loading, disabled, size = "lg", style, full = true }: {
  title: string; onPress?: () => void; variant?: BtnVariant; icon?: IconName; iconRight?: IconName; loading?: boolean;
  disabled?: boolean; size?: "sm" | "md" | "lg"; style?: StyleProp<ViewStyle>; full?: boolean;
}) => {
  const h = size === "lg" ? 54 : size === "md" ? 46 : 40;
  const fg = variant === "primary" || variant === "danger" || variant === "success" ? "#fff"
    : variant === "light" ? colors.primary : variant === "secondary" ? colors.primary : colors.textSecondary;
  const content = (
    <View style={[st.btnInner, { height: h, paddingHorizontal: size === "sm" ? 14 : 20 }]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={size === "sm" ? 16 : 19} color={fg} style={{ marginRight: 8 }} />}
          <Text style={[st.btnText, { color: fg, fontSize: size === "sm" ? 13 : 15 }]} numberOfLines={1}>{title}</Text>
          {iconRight && <Ionicons name={iconRight} size={18} color={fg} style={{ marginLeft: 8 }} />}
        </>
      )}
    </View>
  );
  const bg: Record<BtnVariant, ViewStyle> = {
    primary: {}, danger: { backgroundColor: colors.danger }, success: { backgroundColor: colors.success },
    secondary: { backgroundColor: colors.primarySoft }, ghost: { backgroundColor: "transparent" },
    light: { backgroundColor: "#fff" },
  };
  return (
    <Tap onPress={onPress} disabled={disabled || loading} style={[{ opacity: disabled ? 0.5 : 1, alignSelf: full ? "stretch" : "flex-start" }, style]}>
      {variant === "primary" ? (
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.btn, shadow(2)]}>{content}</LinearGradient>
      ) : (
        <View style={[st.btn, bg[variant], variant === "ghost" && { borderWidth: 1, borderColor: colors.border }]}>{content}</View>
      )}
    </Tap>
  );
};

export const IconButton = ({ icon, onPress, color = colors.text, bg = colors.surface, size = 42, badge, label }: {
  icon: IconName; onPress?: () => void; color?: string; bg?: string; size?: number; badge?: number; label?: string;
}) => (
  <Tap onPress={onPress} accessibilityLabel={label} style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
    <Ionicons name={icon} size={size * 0.48} color={color} />
    {!!badge && badge > 0 && (
      <View style={st.badgeDot}><Text style={st.badgeDotText}>{badge > 9 ? "9+" : badge}</Text></View>
    )}
  </Tap>
);

// ── Surfaces ───────────────────────────────────────────────────────────────
export const Card = ({ children, style, onPress, padded = true, elevated = 1 }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean; elevated?: 0 | 1 | 2 | 3;
}) => {
  const s = [st.card, padded && { padding: space.lg }, elevated ? shadow(elevated as 1) : null, style];
  return onPress ? <Tap onPress={onPress} style={s}>{children}</Tap> : <View style={s}>{children}</View>;
};

export const GradientCard = ({ children, colorsList = gradients.hero, style }: { children: React.ReactNode; colorsList?: readonly [string, string, ...string[]]; style?: StyleProp<ViewStyle> }) => (
  <LinearGradient colors={colorsList} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.gradCard, shadow(2), style]}>
    <View style={st.blobA} /><View style={st.blobB} />
    {children}
  </LinearGradient>
);

// ── Status ─────────────────────────────────────────────────────────────────
export const Badge = ({ status, label, tone, icon, small }: { status?: string; label?: string; tone?: keyof typeof toneColors; icon?: IconName; small?: boolean }) => {
  const tn = toneColors[tone || statusTone[status || ""] || "neutral"];
  return (
    <View style={[st.badge, { backgroundColor: tn.bg }, small && { paddingHorizontal: 8, paddingVertical: 2 }]}>
      {icon ? <Ionicons name={icon} size={12} color={tn.fg} style={{ marginRight: 4 }} /> : <View style={[st.dot, { backgroundColor: tn.fg }]} />}
      <Text style={[st.badgeText, { color: tn.fg }]}>{label || titleCase(status)}</Text>
    </View>
  );
};

export const Avatar = ({ name, uri, size = 44, color = colors.primary }: { name?: string | null; uri?: string | null; size?: number; color?: string }) => {
  const src = fileUrl(uri);
  return src ? (
    <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceAlt }} />
  ) : (
    <LinearGradient colors={[color, colors.secondary]} style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontFamily: fonts.bold, fontSize: size * 0.36 }}>{initials(name)}</Text>
    </LinearGradient>
  );
};

export const IconBubble = ({ icon, tone = "primary", size = 44 }: { icon: IconName; tone?: keyof typeof toneColors; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: toneColors[tone].bg, alignItems: "center", justifyContent: "center" }}>
    <Ionicons name={icon} size={size * 0.48} color={toneColors[tone].fg} />
  </View>
);

// ── Layout helpers ─────────────────────────────────────────────────────────
export const Row = ({ children, style, gap = 0, between, wrap }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number; between?: boolean; wrap?: boolean }) => (
  <View style={[{ flexDirection: "row", alignItems: "center", gap }, between && { justifyContent: "space-between" }, wrap && { flexWrap: "wrap" }, style]}>{children}</View>
);
export const Gap = ({ h = space.lg }: { h?: number }) => <View style={{ height: h }} />;
export const Divider = ({ style }: { style?: StyleProp<ViewStyle> }) => <View style={[{ height: 1, backgroundColor: colors.border, marginVertical: space.md }, style]} />;

export const SectionHeader = ({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) => (
  <Row between style={[{ marginBottom: space.md, marginTop: space.xl }, style]}>
    <T v="h3">{title}</T>
    {action && <Tap onPress={onAction}><T v="small" color={colors.primary} style={{ fontFamily: fonts.semibold }}>{action}</T></Tap>}
  </Row>
);

export const KeyValue = ({ label, value, strong, valueColor, icon }: { label: string; value?: React.ReactNode; strong?: boolean; valueColor?: string; icon?: IconName }) => (
  <Row between style={{ paddingVertical: 9 }}>
    <Row gap={8} style={{ flexShrink: 1 }}>
      {icon && <Ionicons name={icon} size={16} color={colors.textMuted} />}
      <T v="small">{label}</T>
    </Row>
    {typeof value === "string" || typeof value === "number" || value === undefined || value === null ? (
      <T v={strong ? "bodyStrong" : "title"} color={valueColor} style={{ maxWidth: "62%", textAlign: "right" }}>{value ?? "—"}</T>
    ) : value}
  </Row>
);

export const ListItem = ({ icon, iconTone, title, subtitle, right, onPress, avatar, chevron = !!onPress, style }: {
  icon?: IconName; iconTone?: keyof typeof toneColors; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void;
  avatar?: React.ReactNode; chevron?: boolean; style?: StyleProp<ViewStyle>;
}) => (
  <Tap onPress={onPress} scale={0.985} style={[st.listItem, style]}>
    {avatar || (icon && <IconBubble icon={icon} tone={iconTone} size={40} />)}
    <View style={{ flex: 1, marginLeft: avatar || icon ? 12 : 0 }}>
      <T v="title" numberOfLines={1}>{title}</T>
      {!!subtitle && <T v="caption" numberOfLines={2} style={{ marginTop: 2 }}>{subtitle}</T>}
    </View>
    {right}
    {chevron && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 6 }} />}
  </Tap>
);

export const StatTile = ({ label, value, icon, tone = "primary", hint, onPress, style }: {
  label: string; value: string | number; icon: IconName; tone?: keyof typeof toneColors; hint?: string; onPress?: () => void; style?: StyleProp<ViewStyle>;
}) => (
  <Card onPress={onPress} style={[{ flex: 1, minWidth: 140 }, style]}>
    <IconBubble icon={icon} tone={tone} size={36} />
    <T v="h2" style={{ marginTop: 12 }} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
    <T v="caption" style={{ marginTop: 2 }}>{label}</T>
    {hint && <T v="caption" color={toneColors[tone].fg} style={{ marginTop: 4, fontFamily: fonts.semibold }}>{hint}</T>}
  </Card>
);

export const ProgressBar = ({ value, color = colors.primary, height = 8, track = colors.surfaceAlt }: { value: number; color?: string; height?: number; track?: string }) => {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(w, { toValue: Math.max(0, Math.min(1, value)), duration: 700, useNativeDriver: false }).start(); }, [value]);
  return (
    <View style={{ height, backgroundColor: track, borderRadius: height, overflow: "hidden" }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: color, width: w.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
    </View>
  );
};

// ── Choice controls ────────────────────────────────────────────────────────
export const Chip = ({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) => (
  <Tap onPress={() => { haptic.select(); onPress?.(); }} haptics={false} style={[st.chip, active && st.chipActive]}>
    {icon && <Ionicons name={icon} size={14} color={active ? "#fff" : colors.textSecondary} style={{ marginRight: 6 }} />}
    <Text style={[st.chipText, active && { color: "#fff" }]}>{label}</Text>
  </Tap>
);

export function ChipGroup<V extends string>({ options, value, onChange, scroll }: {
  options: { label: string; value: V; icon?: IconName }[]; value: V | null | undefined; onChange: (v: V) => void; scroll?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: scroll ? "nowrap" : "wrap", gap: 8 }}>
      {options.map((o) => <Chip key={o.value} label={o.label} icon={o.icon} active={o.value === value} onPress={() => onChange(o.value)} />)}
    </View>
  );
}

export function Segmented<V extends string>({ options, value, onChange }: { options: { label: string; value: V }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View style={st.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => { haptic.select(); onChange(o.value); }} style={[st.segmentItem, active && st.segmentActive]}>
            <Text style={[st.segmentText, active && { color: colors.text }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Feedback ───────────────────────────────────────────────────────────────
export const Notice = ({ tone = "info", title, message, icon, action, onAction, style }: {
  tone?: keyof typeof toneColors; title?: string; message: string; icon?: IconName; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle>;
}) => {
  const tn = toneColors[tone];
  const ic: IconName = icon || (tone === "danger" ? "alert-circle" : tone === "warning" ? "warning" : tone === "success" ? "checkmark-circle" : "information-circle");
  return (
    <View style={[st.notice, { backgroundColor: tn.bg, borderColor: tn.fg + "33" }, style]}>
      <Ionicons name={ic} size={20} color={tn.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        {title && <T v="title" color={tn.fg}>{title}</T>}
        <T v="small" color={colors.textSecondary} style={title ? { marginTop: 2 } : undefined}>{message}</T>
        {action && <Tap onPress={onAction} style={{ marginTop: 8 }}><T v="small" color={tn.fg} style={{ fontFamily: fonts.bold }}>{action} →</T></Tap>}
      </View>
    </View>
  );
};

export const EmptyState = ({ icon, title, message, action, onAction }: { icon: IconName; title: string; message?: string; action?: string; onAction?: () => void }) => (
  <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
    <LinearGradient colors={[colors.primarySoft, colors.secondarySoft]} style={{ width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
      <Ionicons name={icon} size={42} color={colors.primary} />
    </LinearGradient>
    <T v="h3" center>{title}</T>
    {message && <T v="body" center style={{ marginTop: 6 }}>{message}</T>}
    {action && <Button title={action} onPress={onAction} full={false} size="md" style={{ marginTop: 20, alignSelf: "center" }} />}
  </View>
);

export const Skeleton = ({ height = 16, width = "100%", style, radius: r = 10 }: { height?: number; width?: any; style?: StyleProp<ViewStyle>; radius?: number }) => {
  const o = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[{ height, width, borderRadius: r, backgroundColor: "#E3E7F1", opacity: o }, style]} />;
};

export const SkeletonList = ({ rows = 4 }: { rows?: number }) => (
  <View style={{ gap: 12 }}>
    {Array.from({ length: rows }).map((_, i) => (
      <View key={i} style={[st.card, { padding: 16, flexDirection: "row", alignItems: "center" }]}>
        <Skeleton width={44} height={44} radius={14} />
        <View style={{ flex: 1, marginLeft: 12, gap: 8 }}><Skeleton width="60%" /><Skeleton width="35%" height={12} /></View>
      </View>
    ))}
  </View>
);

/** Small animated entrance used for cards and list rows. */
export const FadeIn = ({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 420, delay, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
};

export const AmountText = ({ children, style, color }: { children: React.ReactNode; style?: StyleProp<TextStyle>; color?: string }) => (
  <Text style={[type.amount, color ? { color } : null, style]} numberOfLines={1} adjustsFontSizeToFit>{children}</Text>
);

const st = StyleSheet.create({
  btn: { borderRadius: radius.md, overflow: "hidden" },
  btnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: fonts.bold, letterSpacing: 0.1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: "#EDF0F6" },
  gradCard: { borderRadius: radius.xl, padding: space.xl, overflow: "hidden" },
  blobA: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(255,255,255,0.07)", top: -90, right: -60 },
  blobB: { position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.05)", bottom: -60, left: -30 },
  badge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.2 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  badgeDot: { position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: "#fff" },
  badgeDotText: { color: "#fff", fontSize: 9, fontFamily: fonts.bold },
  listItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.surface, ...shadow(1) },
  segmentText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  notice: { flexDirection: "row", padding: 14, borderRadius: radius.md, borderWidth: 1 },
});

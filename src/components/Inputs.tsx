import { useFormScroll } from "./FormScroll";
import React, { forwardRef, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, space } from "../theme";
import { IconName, Row, T, Tap } from "./ui";
import { Sheet } from "./Feedback";
import { fmtDate, MONTHS, parseDate, toISO } from "../utils/format";
import { useSettingsStore } from "../stores/settingsStore";
import { haptic } from "../utils/haptics";

export const Field = forwardRef<React.ComponentRef<typeof TextInput>, TextInputProps & {
  label?: string; icon?: IconName; error?: string | null; hint?: string; secure?: boolean; right?: React.ReactNode; prefix?: string;
}>(({ label, icon, error, hint, secure, right, prefix, style, onFocus, onBlur, multiline, ...props }, ref) => {
  const [focus, setFocus] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  const wrapRef = useRef<React.ComponentRef<typeof View>>(null);
  const scrollToNode = useFormScroll();
  const border = error ? colors.danger : focus ? colors.primary : colors.border;
  return (
    <View ref={wrapRef} style={{ marginBottom: space.lg }}>
      {label && <Text style={st.label}>{label}</Text>}
      <View style={[st.box, { borderColor: border }, focus && st.boxFocus, multiline && { minHeight: 110, alignItems: "flex-start", paddingTop: 12 }]}>
        {icon && <Ionicons name={icon} size={19} color={focus ? colors.primary : colors.textMuted} style={{ marginRight: 10, marginTop: multiline ? 2 : 0 }} />}
        {prefix && <Text style={st.prefix}>{prefix}</Text>}
        <TextInput
          ref={ref}
          {...props}
          multiline={multiline}
          secureTextEntry={hidden}
          placeholderTextColor={colors.textMuted}
          keyboardAppearance="light"
          onFocus={(e) => { setFocus(true); scrollToNode?.(wrapRef.current); onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); onBlur?.(e); }}
          style={[st.input, multiline && { textAlignVertical: "top", minHeight: 90 }, style]}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? "Show password" : "Hide password"}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textMuted} />
          </Pressable>
        )}
        {right}
      </View>
      {error ? <Text style={st.error}>{error}</Text> : hint ? <Text style={st.hint}>{hint}</Text> : null}
    </View>
  );
});

export const AmountField = ({ value, onChange, ...p }: { value: string; onChange: (v: string) => void; label?: string; error?: string | null; hint?: string; placeholder?: string }) => {
  const symbol = useSettingsStore((s) => s.symbol);
  return (
    <Field {...p} prefix={symbol} keyboardType="decimal-pad" value={value}
      onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").replace(/^(\d*\.\d{0,2}).*$/, "$1"))} />
  );
};

/** Password strength meter matching the server policy. */
export const passwordChecks = (p: string) => [
  { ok: p.length >= 8, label: "8+ characters" },
  { ok: /[A-Z]/.test(p), label: "Uppercase" },
  { ok: /[a-z]/.test(p), label: "Lowercase" },
  { ok: /\d/.test(p), label: "Number" },
  { ok: /[^A-Za-z0-9]/.test(p), label: "Symbol" },
];
export const PasswordStrength = ({ password }: { password: string }) => {
  const checks = passwordChecks(password);
  const score = checks.filter((c) => c.ok).length;
  const color = score <= 2 ? colors.danger : score <= 4 ? colors.warning : colors.success;
  const label = !password ? "" : score <= 2 ? "Weak" : score <= 4 ? "Almost there" : "Strong";
  return (
    <View style={{ marginTop: -6, marginBottom: space.lg }}>
      <Row gap={6}>
        {checks.map((_, i) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < score ? color : colors.border }} />)}
      </Row>
      <Row wrap gap={10} style={{ marginTop: 8 }}>
        {label ? <Text style={[st.hint, { color, fontFamily: fonts.bold, marginTop: 0 }]}>{label}</Text> : null}
        {checks.map((c) => (
          <Row key={c.label} gap={3}>
            <Ionicons name={c.ok ? "checkmark-circle" : "ellipse-outline"} size={13} color={c.ok ? colors.success : colors.textMuted} />
            <Text style={[st.hint, { marginTop: 0 }]}>{c.label}</Text>
          </Row>
        ))}
      </Row>
    </View>
  );
};

/** Tappable field that opens a list of options in a bottom sheet. */
export function SelectField<V extends string>({ label, value, options, onChange, placeholder = "Select", icon, error }: {
  label?: string; value?: V | null; options: { label: string; value: V; subtitle?: string }[]; onChange: (v: V) => void;
  placeholder?: string; icon?: IconName; error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <View style={{ marginBottom: space.lg }}>
        {label && <Text style={st.label}>{label}</Text>}
        <Tap onPress={() => setOpen(true)} scale={0.99} style={[st.box, { borderColor: error ? colors.danger : colors.border }]}>
          {icon && <Ionicons name={icon} size={19} color={colors.textMuted} style={{ marginRight: 10 }} />}
          <Text style={[st.input, { paddingVertical: 15 }, !current && { color: colors.textMuted }]} numberOfLines={1}>{current?.label || placeholder}</Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Tap>
        {error && <Text style={st.error}>{error}</Text>}
      </View>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label || placeholder}>
        {options.map((o) => (
          <Tap key={o.value} onPress={() => { onChange(o.value); setOpen(false); }} style={st.option}>
            <View style={{ flex: 1 }}>
              <T v="title">{o.label}</T>
              {o.subtitle && <T v="caption">{o.subtitle}</T>}
            </View>
            {o.value === value && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
          </Tap>
        ))}
      </Sheet>
    </>
  );
}

/** Date field with a lightweight calendar sheet (no native dependency). */
export const DateField = ({ label, value, onChange, min, max, error, hint, placeholder = "Choose a date" }: {
  label?: string; value?: string | null; onChange: (iso: string) => void; min?: string; max?: string; error?: string | null; hint?: string; placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const initial = parseDate(value) || parseDate(min) || new Date();
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= count; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [cursor]);
  const move = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  return (
    <>
      <View style={{ marginBottom: space.lg }}>
        {label && <Text style={st.label}>{label}</Text>}
        <Tap onPress={() => setOpen(true)} scale={0.99} style={[st.box, { borderColor: error ? colors.danger : colors.border }]}>
          <Ionicons name="calendar-outline" size={19} color={colors.textMuted} style={{ marginRight: 10 }} />
          <Text style={[st.input, { paddingVertical: 15 }, !value && { color: colors.textMuted }]}>{value ? fmtDate(value) : placeholder}</Text>
        </Tap>
        {error ? <Text style={st.error}>{error}</Text> : hint ? <Text style={st.hint}>{hint}</Text> : null}
      </View>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label || "Select date"}>
        <Row between style={{ marginBottom: 12 }}>
          <Tap onPress={() => move(-1)} style={st.calNav}><Ionicons name="chevron-back" size={20} color={colors.text} /></Tap>
          <T v="h3">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</T>
          <Tap onPress={() => move(1)} style={st.calNav}><Ionicons name="chevron-forward" size={20} color={colors.text} /></Tap>
        </Row>
        <View style={st.calGrid}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <Text key={i} style={st.calHead}>{d}</Text>)}
          {days.map((d, i) => {
            if (!d) return <View key={i} style={st.calCell} />;
            const iso = toISO(d);
            const disabled = (min && iso < min) || (max && iso > max);
            const selected = iso === value;
            const isToday = iso === toISO(new Date());
            return (
              <Pressable key={i} disabled={!!disabled} onPress={() => { haptic.select(); onChange(iso); setOpen(false); }} style={st.calCell}>
                <View style={[st.calDay, selected && { backgroundColor: colors.primary }, isToday && !selected && { borderWidth: 1.5, borderColor: colors.primary }]}>
                  <Text style={[st.calText, disabled && { color: colors.borderStrong }, selected && { color: "#fff" }]}>{d.getDate()}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
};

/** 6-digit code input (OTP / invite codes). */
export const CodeInput = ({ value, onChange, length = 6, numeric = true, autoFocus = true }: { value: string; onChange: (v: string) => void; length?: number; numeric?: boolean; autoFocus?: boolean }) => {
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  const wrapRef = useRef<React.ComponentRef<typeof View>>(null);
  const scrollToNode = useFormScroll();
  // Long codes (8 chars) get a visual dash in the middle and narrower cells so they always fit.
  const split = length === 8 ? 4 : -1;
  return (
    <Pressable ref={wrapRef as any} onPress={() => ref.current?.focus()} style={{ marginBottom: space.lg }}>
      <Row gap={length > 6 ? 5 : 8} style={{ justifyContent: "center" }}>
        {Array.from({ length }).map((_, i) => {
          const ch = value[i];
          const active = i === value.length;
          return (
            <React.Fragment key={i}>
              {i === split && <Text style={st.codeDash}>–</Text>}
              <View style={[st.codeCell, length > 6 && st.codeCellSmall, active && { borderColor: colors.primary }, ch && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
                <Text style={[st.codeText, length > 6 && { fontSize: 18 }]}>{ch || ""}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </Row>
      <TextInput
        ref={ref} value={value} autoFocus={autoFocus} maxLength={length} keyboardType={numeric ? "number-pad" : "default"} autoCapitalize="characters"
        keyboardAppearance="light" autoCorrect={false} onFocus={() => scrollToNode?.(wrapRef.current)}
        onChangeText={(t) => onChange((numeric ? t.replace(/\D/g, "") : t.replace(/[^A-Za-z0-9]/g, "").toUpperCase()).slice(0, length))}
        style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
        textContentType={numeric ? "oneTimeCode" : "none"}
      />
    </Pressable>
  );
};

/**
 * Secure 4-digit PIN entry: dots instead of digits, native number pad, calls onComplete on the 4th digit.
 * Pass a changing `errorKey` to shake and clear after a wrong PIN.
 */
export const PinInput = ({ value, onChange, onComplete, label, error, autoFocus = true, errorKey }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; label?: string; error?: string | null; autoFocus?: boolean; errorKey?: number;
}) => {
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  const wrapRef = useRef<React.ComponentRef<typeof View>>(null);
  const scrollToNode = useFormScroll();
  const shake = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!errorKey) return;
    haptic.error();
    Animated.sequence([10, -10, 8, -8, 4, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 45, useNativeDriver: true }))).start();
  }, [errorKey]);
  return (
    <View ref={wrapRef} style={{ marginBottom: space.lg }}>
      {label && <Text style={st.label}>{label}</Text>}
      <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={label || "PIN"} accessibilityHint="4-digit PIN">
        <Animated.View style={{ flexDirection: "row", gap: 12, transform: [{ translateX: shake }] }}>
          {[0, 1, 2, 3].map((i) => {
            const filled = i < value.length;
            const active = i === value.length;
            return (
              <View key={i} style={[st.pinCell, active && { borderColor: colors.primary, backgroundColor: "#FAFAFF" }, filled && { borderColor: colors.primary }, !!error && { borderColor: colors.danger }]}>
                {filled && <View style={[st.pinDot, !!error && { backgroundColor: colors.danger }]} />}
              </View>
            );
          })}
        </Animated.View>
      </Pressable>
      <TextInput
        ref={ref} value={value} autoFocus={autoFocus} maxLength={4} keyboardType="number-pad" secureTextEntry keyboardAppearance="light"
        textContentType="oneTimeCode" autoComplete="off" importantForAutofill="no" caretHidden contextMenuHidden
        onFocus={() => scrollToNode?.(wrapRef.current)}
        onChangeText={(t) => {
          const v = t.replace(/\D/g, "").slice(0, 4);
          onChange(v);
          if (v.length === 4) onComplete?.(v);
        }}
        style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
      />
      {error ? <Text style={st.error}>{error}</Text> : null}
    </View>
  );
};

export const SearchBar =({ value, onChange, placeholder = "Search" }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <View style={[st.box, { borderColor: colors.border, marginBottom: space.lg, backgroundColor: colors.surface }]}>
    <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textMuted} style={st.input} returnKeyType="search" keyboardAppearance="light" />
    {!!value && <Pressable onPress={() => onChange("")} hitSlop={10}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable>}
  </View>
);

export const Checkbox = ({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) => (
  <Pressable onPress={() => { haptic.select(); onToggle(); }} style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 6 }} accessibilityRole="checkbox" accessibilityState={{ checked }}>
    <View style={[st.check, checked && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      {checked && <Ionicons name="checkmark" size={15} color="#fff" />}
    </View>
    <View style={{ flex: 1, marginLeft: 10 }}>{children}</View>
  </Pressable>
);

export const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => {
  const a = useRef(new Animated.Value(value ? 1 : 0)).current;
  React.useEffect(() => { Animated.spring(a, { toValue: value ? 1 : 0, useNativeDriver: false, bounciness: 6 }).start(); }, [value]);
  return (
    <Pressable onPress={() => { haptic.select(); onChange(!value); }} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <Animated.View style={[st.toggle, { backgroundColor: a.interpolate({ inputRange: [0, 1], outputRange: [colors.borderStrong, colors.primary] }) }]}>
        <Animated.View style={[st.knob, { transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [2, 22] }) }] }]} />
      </Animated.View>
    </Pressable>
  );
};

const st = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, marginBottom: 8 },
  box: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 14 },
  boxFocus: { backgroundColor: "#FBFBFF" },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, paddingVertical: 14, outlineStyle: "none" } as any,
  prefix: { fontFamily: fonts.bold, fontSize: 16, color: colors.textSecondary, marginRight: 6 },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 6 },
  hint: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 6 },
  option: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  calNav: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calHead: { width: `${100 / 7}%`, textAlign: "center", fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted, paddingVertical: 6 },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  calDay: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  calText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  codeCell: { width: 46, height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  codeText: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 28, color: colors.text },
  pinCell: { flex: 1, maxWidth: 64, height: 60, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  pinDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.text },
  codeCellSmall:{ width: undefined, flex: 1, maxWidth: 40, height: 50, borderRadius: 12 },
  codeDash: { fontFamily: fonts.bold, fontSize: 18, color: colors.textMuted, alignSelf: "center" },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", marginTop: 1 },
  toggle: { width: 48, height: 28, borderRadius: 14, justifyContent: "center" },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" },
});

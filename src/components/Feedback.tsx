import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FormScrollProvider, useScrollToNode } from "./FormScroll";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { create } from "zustand";
import { colors, fonts, radius, shadow, space } from "../theme";
import { Button, IconName, T } from "./ui";
import { haptic } from "../utils/haptics";

// ── Toast ──────────────────────────────────────────────────────────────────
type ToastKind = "success" | "error" | "info";
const useToastStore = create<{ msg: string | null; kind: ToastKind; id: number; show: (m: string, k?: ToastKind) => void }>((set) => ({
  msg: null, kind: "info", id: 0,
  show: (msg, kind = "info") => set((s) => ({ msg, kind, id: s.id + 1 })),
}));

export const toast = {
  success: (m: string) => { haptic.success(); useToastStore.getState().show(m, "success"); },
  error: (m: string) => { haptic.error(); useToastStore.getState().show(m, "error"); },
  info: (m: string) => useToastStore.getState().show(m, "info"),
};

export const ToastHost = () => {
  const { msg, kind, id } = useToastStore();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-120)).current;
  useEffect(() => {
    if (!msg) return;
    Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
    const t = setTimeout(() => Animated.timing(y, { toValue: -140, duration: 250, useNativeDriver: true }).start(), 3200);
    return () => clearTimeout(t);
  }, [id]);
  if (!msg) return null;
  const tone = kind === "success" ? colors.success : kind === "error" ? colors.danger : colors.primary;
  const icon: IconName = kind === "success" ? "checkmark-circle" : kind === "error" ? "alert-circle" : "information-circle";
  return (
    <Animated.View pointerEvents="none" style={[st.toast, shadow(3), { top: insets.top + 8, transform: [{ translateY: y }] }]}>
      <Ionicons name={icon} size={22} color={tone} />
      <Text style={st.toastText} numberOfLines={3}>{msg}</Text>
    </Animated.View>
  );
};

// ── Bottom sheet ───────────────────────────────────────────────────────────
export const Sheet = ({ visible, onClose, title, children, footer }: {
  visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode;
}) => {
  const insets = useSafeAreaInsets();
  const { scrollRef, scrollToNode } = useScrollToNode(60);
  const y = useRef(new Animated.Value(600)).current;
  useEffect(() => {
    if (visible) Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14 }).start();
    else y.setValue(600);
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable style={st.backdrop} onPress={onClose} />
        <Animated.View style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY: y }] }]}>
          <View style={st.grabber} />
          {title && (
            <View style={st.sheetHead}>
              <T v="h3" style={{ flex: 1 }}>{title}</T>
              <Pressable onPress={onClose} hitSlop={12}><Ionicons name="close" size={24} color={colors.textMuted} /></Pressable>
            </View>
          )}
          <ScrollView ref={scrollRef} style={{ maxHeight: Math.min(560, Dimensions.get("window").height * 0.55) }} contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: 8 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            <FormScrollProvider value={scrollToNode}>{children}</FormScrollProvider>
          </ScrollView>
          {footer && <View style={{ paddingHorizontal: space.xl, paddingTop: 12 }}>{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Confirm dialog (promise-based) ─────────────────────────────────────────
interface ConfirmOpts { title: string; message?: string; confirm?: string; cancel?: string; danger?: boolean; icon?: IconName }
const useConfirmStore = create<{ opts: ConfirmOpts | null; resolve?: (v: boolean) => void; open: (o: ConfirmOpts) => Promise<boolean>; close: (v: boolean) => void }>((set, get) => ({
  opts: null,
  open: (opts) => new Promise<boolean>((resolve) => set({ opts, resolve })),
  close: (v) => { get().resolve?.(v); set({ opts: null, resolve: undefined }); },
}));
export const confirm = (o: ConfirmOpts) => useConfirmStore.getState().open(o);

export const ConfirmHost = () => {
  const { opts, close } = useConfirmStore();
  const s = useRef(new Animated.Value(0.9)).current;
  useEffect(() => { if (opts) { s.setValue(0.9); Animated.spring(s, { toValue: 1, useNativeDriver: true, bounciness: 10 }).start(); } }, [opts]);
  if (!opts) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent>
      <View style={[st.backdrop, { justifyContent: "center", padding: 28 }]}>
        <Animated.View style={[st.dialog, shadow(3), { transform: [{ scale: s }] }]}>
          <View style={[st.dialogIcon, { backgroundColor: opts.danger ? colors.dangerSoft : colors.primarySoft }]}>
            <Ionicons name={opts.icon || (opts.danger ? "warning" : "help-circle")} size={28} color={opts.danger ? colors.danger : colors.primary} />
          </View>
          <T v="h3" center style={{ marginTop: 14 }}>{opts.title}</T>
          {opts.message && <T v="body" center style={{ marginTop: 8 }}>{opts.message}</T>}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
            <View style={{ flex: 1 }}><Button title={opts.cancel || "Cancel"} variant="ghost" size="md" onPress={() => close(false)} /></View>
            <View style={{ flex: 1 }}><Button title={opts.confirm || "Confirm"} variant={opts.danger ? "danger" : "primary"} size="md" onPress={() => close(true)} /></View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  toast: { position: "absolute", left: 16, right: 16, zIndex: 999, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.border },
  toastText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10 },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, marginBottom: 6 },
  sheetHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.xl, paddingVertical: 12 },
  dialog: { backgroundColor: colors.surface, borderRadius: 26, padding: 24, alignItems: "center" },
  dialogIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
});

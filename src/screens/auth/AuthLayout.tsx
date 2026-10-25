import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { IconButton, T } from "../../components/ui";
import { LogoMark } from "../../components/Brand";
import { FormScrollProvider, useScrollToNode } from "../../components/FormScroll";
import { colors, gradients, shadow } from "../../theme";

/** Shared auth layout: gradient header band with logo, white sheet with the form. */
export const AuthLayout = ({ title, subtitle, children, back = true, step }: {
  title: string; subtitle?: string; children: React.ReactNode; back?: boolean; step?: { at: number; of: number };
}) => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { scrollRef, scrollToNode } = useScrollToNode(40);
  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <LinearGradient colors={[...gradients.night, "#312E81"]} style={[st.top, { paddingTop: insets.top + 10 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={st.orb} />
        <View style={st.topRow}>
          {back && nav.canGoBack() ? <IconButton icon="chevron-back" onPress={() => nav.goBack()} bg="rgba(255,255,255,0.12)" color="#fff" label="Back" /> : <View style={{ width: 42 }} />}
          <LogoMark size={40} />
          <View style={{ width: 42 }} />
        </View>
        <T v="h1" color="#fff" style={{ marginTop: 22 }}>{title}</T>
        {subtitle && <T v="body" color="rgba(226,232,255,0.75)" style={{ marginTop: 6 }}>{subtitle}</T>}
        {step && (
          <View style={{ flexDirection: "row", gap: 6, marginTop: 18 }}>
            {Array.from({ length: step.of }).map((_, i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step.at ? "#A5B4FC" : "rgba(255,255,255,0.15)" }} />
            ))}
          </View>
        )}
      </LinearGradient>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[st.sheet, shadow(3)]}>
          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
            <FormScrollProvider value={scrollToNode}>{children}</FormScrollProvider>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const st = StyleSheet.create({
  top: { paddingHorizontal: 24, paddingBottom: 44, overflow: "hidden" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orb: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(124,58,237,0.25)", top: -90, right: -90 },
  sheet: { flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -26, overflow: "hidden" },
});

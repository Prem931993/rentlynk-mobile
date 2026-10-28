import React from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StatusBar, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { colors, gradients, space } from "../theme";
import { IconButton, IconName, T } from "./ui";
import { FormScrollProvider, useScrollToNode } from "./FormScroll";

export const Screen = ({ children, scroll = true, refreshing, onRefresh, style, contentStyle, header, hero, footer, bg = colors.bg, keyboard }: {
  children: React.ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>; header?: React.ReactNode; hero?: React.ReactNode; footer?: React.ReactNode; bg?: string; keyboard?: boolean;
}) => {
  const insets = useSafeAreaInsets();
  const { scrollRef, scrollToNode } = useScrollToNode();
  const bottomPad = footer ? space.xl : insets.bottom + 110;
  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={hero ? { paddingBottom: bottomPad } : [{ padding: space.xl, paddingBottom: bottomPad }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
    >
      {hero ? (
        <>
          {hero}
          {/* Content overlaps the hero's rounded bottom edge */}
          <View style={[{ paddingHorizontal: space.xl, marginTop: -40 }, contentStyle]}>{children}</View>
        </>
      ) : children}
    </ScrollView>
  ) : <View style={[{ flex: 1 }, contentStyle]}>{children}</View>;

  return (
    <View style={[{ flex: 1, backgroundColor: bg }, style]}>
      <StatusBar barStyle="dark-content" />
      {header}
      {/* Every screen avoids the keyboard; focused fields scroll themselves into view. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FormScrollProvider value={scrollToNode}>{body}</FormScrollProvider>
        {footer && <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>{footer}</View>}
      </KeyboardAvoidingView>
    </View>
  );
};

/** Standard top bar with back button, title and optional actions. */
export const Header = ({ title, subtitle, back = true, right, transparent }: {
  title?: string; subtitle?: string; back?: boolean; right?: React.ReactNode; transparent?: boolean;
}) => {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.header, { paddingTop: insets.top + 8 }, !transparent && { backgroundColor: colors.bg }]}>
      <View style={{ width: 42 }}>
        {back && nav.canGoBack() && <IconButton icon="chevron-back" onPress={() => nav.goBack()} label="Back" />}
      </View>
      <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 8 }}>
        {title && <T v="h3" numberOfLines={1}>{title}</T>}
        {subtitle && <T v="caption" numberOfLines={1}>{subtitle}</T>}
      </View>
      <View style={{ minWidth: 42, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
};

/** Big gradient hero used on dashboards. */
export const Hero = ({ children, height, colorsList = gradients.hero }: { children: React.ReactNode; height?: number; colorsList?: readonly [string, string, ...string[]] }) => {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={colorsList} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.hero, { paddingTop: insets.top + 12, minHeight: height }]}>
      <View style={st.ringA} /><View style={st.ringB} />
      {children}
    </LinearGradient>
  );
};

export const HeaderAction = ({ icon, onPress, badge, label }: { icon: IconName; onPress: () => void; badge?: number; label?: string }) => (
  <IconButton icon={icon} onPress={onPress} badge={badge} label={label} />
);

const st = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingBottom: 8 },
  footer: { paddingHorizontal: space.xl, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  hero: { paddingHorizontal: space.xl, paddingBottom: 56, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: "hidden" },
  ringA: { position: "absolute", width: 320, height: 320, borderRadius: 160, borderWidth: 40, borderColor: "rgba(255,255,255,0.05)", top: -140, right: -120 },
  ringB: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(7,166,125,0.25)", bottom: -90, left: -40 },
});

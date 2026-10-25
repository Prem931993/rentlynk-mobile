import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, gradients, shadow } from "../theme";
import { haptic } from "../utils/haptics";

export const TAB_ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap, string]> = {
  Home: ["grid", "grid-outline", "Home"],
  PropertiesTab: ["business", "business-outline", "Properties"],
  TenantsTab: ["people", "people-outline", "Tenants"],
  Billing: ["wallet", "wallet-outline", "Billing"],
  AccountTab: ["person-circle", "person-circle-outline", "Account"],
  HomeTab: ["home", "home-outline", "Home"],
  MyHomeTab: ["key", "key-outline", "My home"],
  RequestsTab: ["construct", "construct-outline", "Requests"],
};

const TabItem = ({ focused, name, onPress, badge }: { focused: boolean; name: string; onPress: () => void; badge?: number }) => {
  const a = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => { Animated.spring(a, { toValue: focused ? 1 : 0, useNativeDriver: false, bounciness: 8 }).start(); }, [focused]);
  const [on, off, label] = TAB_ICONS[name] || ["ellipse", "ellipse-outline", name];
  return (
    <Pressable onPress={onPress} style={st.item} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label}>
      <Animated.View style={[st.pill, { backgroundColor: a.interpolate({ inputRange: [0, 1], outputRange: ["rgba(79,70,229,0)", "rgba(79,70,229,0.1)"] }) }]}>
        <Ionicons name={focused ? on : off} size={22} color={focused ? colors.primary : colors.textMuted} />
        {!!badge && <View style={st.badge}><Text style={st.badgeText}>{badge > 9 ? "9+" : badge}</Text></View>}
      </Animated.View>
      <Text style={[st.label, { color: focused ? colors.primary : colors.textMuted, fontFamily: focused ? fonts.bold : fonts.medium }]}>{label}</Text>
    </Pressable>
  );
};

export const TabBar = ({ state, navigation, descriptors, onCenter }: BottomTabBarProps & { onCenter?: () => void }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={[st.bar, shadow(3)]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          if (route.name === "PayTab") {
            return (
              <Pressable key={route.key} onPress={() => { haptic.tap(); onCenter?.(); }} style={st.centerWrap} accessibilityLabel="Pay rent">
                <LinearGradient colors={gradients.brand} style={[st.center, shadow(2)]}><Ionicons name="flash" size={26} color="#fff" /></LinearGradient>
                <Text style={[st.label, { color: colors.primary, fontFamily: fonts.bold, marginTop: 4 }]}>Pay</Text>
              </Pressable>
            );
          }
          const badge = (descriptors[route.key].options as any).tabBarBadge as number | undefined;
          return (
            <TabItem key={route.key} name={route.name} focused={focused} badge={badge}
              onPress={() => {
                haptic.select();
                const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name as never);
              }} />
          );
        })}
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14, backgroundColor: "transparent" },
  bar: { flexDirection: "row", backgroundColor: Platform.OS === "web" ? "rgba(255,255,255,0.97)" : "#fff", borderRadius: 26, paddingVertical: 8, paddingHorizontal: 6, alignItems: "center", borderWidth: 1, borderColor: "#EDF0F6" },
  item: { flex: 1, alignItems: "center" },
  pill: { width: 52, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, marginTop: 2 },
  centerWrap: { flex: 1, alignItems: "center", marginTop: -30 },
  center: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#fff" },
  badge: { position: "absolute", top: -2, right: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: "#fff" },
  badgeText: { color: "#fff", fontSize: 9, fontFamily: fonts.bold },
});

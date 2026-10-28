import React, { useRef, useState } from "react";
import { Animated, Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, IconName, Row, T, Tap } from "../../components/ui";
import { colors, fonts, gradients, shadow } from "../../theme";
import { useAuth } from "../../stores/authStore";

const { width } = Dimensions.get("window");

const SLIDES: { title: string; body: string; icon: IconName; grad: readonly [string, string]; chips: { icon: IconName; text: string; tone: string }[] }[] = [
  {
    title: "Every rental,\none beautiful place",
    body: "Owners manage properties, units, rentals, leases and tenants. Tenants see their home, rent and requests — all in sync.",
    icon: "business", grad: gradients.brand,
    chips: [{ icon: "home", text: "4 units · 92% occupied", tone: colors.primary }, { icon: "people", text: "Tenant joined via invite", tone: colors.success }],
  },
  {
    title: "Rent that\npays on time",
    body: "Automatic invoices and reminders. Pay by UPI or bank, upload proof, and get an instant receipt when it's approved.",
    icon: "wallet", grad: gradients.emerald,
    chips: [{ icon: "checkmark-circle", text: "Payment approved · ₹19,500", tone: colors.success }, { icon: "notifications", text: "Rent due in 3 days", tone: colors.warning }],
  },
  {
    title: "Fair, transparent\nmove-outs",
    body: "Deposit ledger, itemised charges like painting or cleaning, and a settlement both sides can accept — or dispute.",
    icon: "shield-checkmark", grad: gradients.ocean,
    chips: [{ icon: "receipt", text: "Deposit refund ₹48,000", tone: colors.info }, { icon: "lock-closed", text: "Bank-grade security", tone: colors.secondary }],
  },
];

export const OnboardingScreen = () => {
  const insets = useSafeAreaInsets();
  const x = useRef(new Animated.Value(0)).current;
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  const done = useAuth((s) => s.setOnboardingSeen);

  const next = () => {
    if (index < SLIDES.length - 1) ref.current?.scrollTo({ x: (index + 1) * width, animated: true });
    else done();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Row between style={{ paddingTop: insets.top + 12, paddingHorizontal: 24 }}>
        <T v="overline" color={colors.primary}>{index + 1} / {SLIDES.length}</T>
        {index < SLIDES.length - 1 && <Tap onPress={done}><T v="title" color={colors.textMuted}>Skip</T></Tap>}
      </Row>
      <Animated.ScrollView
        ref={ref as any}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={16}
      >
        {SLIDES.map((s, i) => {
          const range = [(i - 1) * width, i * width, (i + 1) * width];
          const scale = x.interpolate({ inputRange: range, outputRange: [0.7, 1, 0.7], extrapolate: "clamp" });
          const shift = x.interpolate({ inputRange: range, outputRange: [60, 0, -60], extrapolate: "clamp" });
          return (
            <View key={i} style={{ width, paddingHorizontal: 28 }}>
              <View style={st.art}>
                <Animated.View style={{ transform: [{ scale }] }}>
                  <LinearGradient colors={s.grad} style={st.artCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={st.artInner}><Ionicons name={s.icon} size={70} color="#fff" /></View>
                  </LinearGradient>
                </Animated.View>
                {s.chips.map((c, k) => (
                  <Animated.View key={k} style={[st.floatChip, shadow(2), k === 0 ? { top: 24, left: 0 } : { bottom: 20, right: 0 }, { transform: [{ translateX: Animated.multiply(shift, k === 0 ? 1 : -1) }] }]}>
                    <View style={[st.chipIcon, { backgroundColor: c.tone + "1A" }]}><Ionicons name={c.icon} size={16} color={c.tone} /></View>
                    <T v="small" style={{ fontFamily: fonts.semibold, color: colors.text }}>{c.text}</T>
                  </Animated.View>
                ))}
              </View>
              <T v="display" style={{ marginTop: 12 }}>{s.title}</T>
              <T v="body" style={{ marginTop: 14, fontSize: 16, lineHeight: 25 }}>{s.body}</T>
            </View>
          );
        })}
      </Animated.ScrollView>
      <View style={{ paddingHorizontal: 28, paddingBottom: insets.bottom + 24 }}>
        <Row gap={8} style={{ marginBottom: 24 }}>
          {SLIDES.map((_, i) => {
            const w = x.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [8, 28, 8], extrapolate: "clamp" });
            const o = x.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [0.3, 1, 0.3], extrapolate: "clamp" });
            return <Animated.View key={i} style={{ width: w, height: 8, borderRadius: 4, backgroundColor: colors.primary, opacity: o }} />;
          })}
        </Row>
        <Button title={index === SLIDES.length - 1 ? "Get started" : "Next"} iconRight="arrow-forward" onPress={next} />
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  art: { height: width * 0.92, alignItems: "center", justifyContent: "center" },
  artCircle: { width: width * 0.6, height: width * 0.6, borderRadius: width, alignItems: "center", justifyContent: "center" },
  artInner: { width: width * 0.36, height: width * 0.36, borderRadius: width, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  floatChip: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16 },
  chipIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
});

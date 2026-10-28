import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, FadeIn, IconName, Row, T, Tap } from "../../components/ui";
import { LogoMark, Wordmark } from "../../components/Brand";
import { colors, fonts, gradients } from "../../theme";

const Feature = ({ icon, title, text }: { icon: IconName; title: string; text: string }) => (
  <Row gap={14} style={{ marginBottom: 16 }}>
    <View style={st.featIcon}><Ionicons name={icon} size={20} color="#9EC5F2" /></View>
    <View style={{ flex: 1 }}>
      <T v="title" color="#fff">{title}</T>
      <T v="small" color="rgba(226,232,255,0.7)">{text}</T>
    </View>
  </Row>
);

export const WelcomeScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={[...gradients.night, "#0A3A82"]} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={st.orbA} /><View style={st.orbB} />
      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: insets.top + 40 }}>
        <FadeIn>
          <Row gap={12}><LogoMark size={52} tile /><Wordmark size={30} color="#FFFFFF" /></Row>
        </FadeIn>
        <FadeIn delay={120}>
          <T v="display" color="#fff" style={{ marginTop: 44, fontSize: 36, lineHeight: 43 }}>
            Your rental life,{"\n"}<T v="display" color="#3DDC97" style={{ fontSize: 36, lineHeight: 43 }}>beautifully organised.</T>
          </T>
          <T v="body" color="rgba(226,232,255,0.75)" style={{ marginTop: 14, fontSize: 16 }}>
            One app for owners and tenants — rent, deposits, repairs and move-outs, handled with care.
          </T>
        </FadeIn>
        <FadeIn delay={240} style={{ marginTop: 36 }}>
          <Feature icon="flash" title="Automatic invoices & reminders" text="Never chase or miss a rent payment again" />
          <Feature icon="shield-checkmark" title="Verified payments & receipts" text="Proof uploads, approvals and instant receipts" />
          <Feature icon="lock-closed" title="Private by design" text="Encrypted sessions, private files, biometric unlock" />
        </FadeIn>
      </View>
      <FadeIn delay={360} style={{ paddingHorizontal: 28, paddingBottom: insets.bottom + 20 }}>
        <Button title="Create an account" variant="light" iconRight="arrow-forward" onPress={() => navigation.navigate("Register")} />
        <View style={{ height: 12 }} />
        <Tap onPress={() => navigation.navigate("Login")} style={st.outline}>
          <T v="title" color="#fff">I already have an account</T>
        </Tap>
        <Row gap={4} style={{ justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
          <T v="caption" color="rgba(226,232,255,0.6)">By continuing you agree to our</T>
          <Tap onPress={() => navigation.navigate("Legal", { slug: "terms-conditions" })}><T v="caption" color="#9EC5F2" style={{ fontFamily: fonts.bold }}>Terms</T></Tap>
          <T v="caption" color="rgba(226,232,255,0.6)">and</T>
          <Tap onPress={() => navigation.navigate("Legal", { slug: "privacy-policy" })}><T v="caption" color="#9EC5F2" style={{ fontFamily: fonts.bold }}>Privacy Policy</T></Tap>
        </Row>
      </FadeIn>
    </LinearGradient>
  );
};

const st = StyleSheet.create({
  featIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(158,197,242,0.14)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(158,197,242,0.2)" },
  outline: { height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  orbA: { position: "absolute", width: 340, height: 340, borderRadius: 170, backgroundColor: "rgba(10,91,184,0.3)", top: -120, right: -140 },
  orbB: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(7,166,125,0.2)", bottom: 120, left: -150 },
});

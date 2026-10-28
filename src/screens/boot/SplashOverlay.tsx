import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { LogoMark, Wordmark } from "../../components/Brand";
import { fonts, gradients } from "../../theme";

const { width } = Dimensions.get("window");

/**
 * Animated launch screen: logo springs in with expanding pulse rings, the wordmark and
 * tagline rise in, then the whole layer fades away once the app is ready.
 */
export const SplashOverlay = ({ ready, onDone }: { ready: boolean; onDone: () => void }) => {
  const logo = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const tag = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const orb = useRef(new Animated.Value(0)).current;
  const minTimeDone = useRef(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const finish = () => {
    Animated.parallel([
      Animated.timing(out, { toValue: 0, duration: 420, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(logo, { toValue: 1.25, duration: 420, useNativeDriver: true }),
    ]).start(() => onDone());
  };

  useEffect(() => {
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
    pulse(ring1, 300).start();
    pulse(ring2, 1200).start();
    Animated.loop(Animated.timing(bar, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(orb, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(orb, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.sequence([
      Animated.spring(logo, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      Animated.stagger(180, [
        Animated.timing(word, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tag, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
    const t = setTimeout(() => { minTimeDone.current = true; if (readyRef.current) finish(); }, 2100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { if (ready && minTimeDone.current) finish(); }, [ready]);

  const ringStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.5, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.6] }) }],
  });
  const rise = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: out, zIndex: 1000 }]} pointerEvents={ready ? "none" : "auto"}>
      <LinearGradient colors={[...gradients.night, "#0A3A82"]} style={StyleSheet.absoluteFill} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} />
      <Animated.View style={[st.orb, { top: -80, left: -60, backgroundColor: "rgba(10,91,184,0.4)", transform: [{ translateY: orb.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) }] }]} />
      <Animated.View style={[st.orb, { bottom: -100, right: -80, backgroundColor: "rgba(7,166,125,0.28)", transform: [{ translateX: orb.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }) }] }]} />
      <View style={st.center}>
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <Animated.View style={[st.ring, ringStyle(ring1)]} />
          <Animated.View style={[st.ring, ringStyle(ring2)]} />
          <Animated.View style={{
            opacity: logo.interpolate({ inputRange: [0, 0.4, 1, 1.25], outputRange: [0, 1, 1, 0] }),
            transform: [{ scale: logo.interpolate({ inputRange: [0, 1, 1.25], outputRange: [0.3, 1, 1.4] }) }, { rotate: logo.interpolate({ inputRange: [0, 1], outputRange: ["-25deg", "0deg"], extrapolate: "clamp" }) }],
          }}>
            <View style={st.glow}><LogoMark size={96} tile /></View>
          </Animated.View>
        </View>
        <Animated.View style={[{ marginTop: 28 }, rise(word)]}><Wordmark size={38} color="#FFFFFF" /></Animated.View>
        <Animated.Text style={[st.tagline, rise(tag)]}>Rent Smarter. Live Better.</Animated.Text>
      </View>
      <View style={st.barTrack}>
        <Animated.View style={[st.barFill, { transform: [{ translateX: bar.interpolate({ inputRange: [0, 1], outputRange: [-80, 160] }) }] }]} />
      </View>
      <Animated.Text style={[st.foot, { opacity: tag }]}>Secure · Private · Verified</Animated.Text>
    </Animated.View>
  );
};

const st = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: "#5EE0B0" },
  glow: { shadowColor: "#3DDC97", shadowOpacity: 0.8, shadowRadius: 30, shadowOffset: { width: 0, height: 0 }, elevation: 20, borderRadius: 28 },
  tagline: { marginTop: 8, fontFamily: fonts.medium, fontSize: 15, color: "#BFD7F5", letterSpacing: 0.4 },
  orb: { position: "absolute", width: width * 0.9, height: width * 0.9, borderRadius: width },
  barTrack: { position: "absolute", bottom: 90, alignSelf: "center", width: 160, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  barFill: { width: 80, height: 4, borderRadius: 2, backgroundColor: "#3DDC97" },
  foot: { position: "absolute", bottom: 52, alignSelf: "center", fontFamily: fonts.semibold, fontSize: 12, color: "rgba(191,215,245,0.7)", letterSpacing: 1.5 },
});

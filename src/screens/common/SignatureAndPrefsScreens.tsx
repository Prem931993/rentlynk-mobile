import React, { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Header, Screen } from "../../components/Screen";
import { Button, Card, IconBubble, IconName, Notice, Row, T } from "../../components/ui";
import { Toggle } from "../../components/Inputs";
import { toast } from "../../components/Feedback";
import { colors, radius } from "../../theme";
import { useAuth } from "../../stores/authStore";
import { Auth } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { haptic } from "../../utils/haptics";

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Finger-drawn signature, stored as vector strokes and printed on invoices, receipts and settlements. */
export const SignatureScreen = ({ navigation }: any) => {
  const { user, setUser } = useAuth();
  const [paths, setPaths] = useState<string[]>(user?.signature?.paths || []);
  const [current, setCurrent] = useState("");
  const [size, setSize] = useState({ width: 320, height: 160 });
  const [saving, setSaving] = useState(false);
  const live = useRef("");
  const pointCount = useRef(0);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const responder = useMemo(() => {
    // Keep the point inside the pad so strokes never jump outside it.
    const pt = (e: any) => {
      const { locationX, locationY } = e.nativeEvent;
      const x = Math.max(0, Math.min(locationX, sizeRef.current.width));
      const y = Math.max(0, Math.min(locationY, sizeRef.current.height));
      return `${r1(x)} ${r1(y)}`;
    };
    const finish = () => {
      if (live.current) {
        // A tap (single point) becomes a tiny dot so it still shows up.
        const d = pointCount.current > 1 ? live.current : `${live.current} l0.1 0.1`;
        setPaths((p) => [...p, d].slice(-40));
      }
      live.current = "";
      setCurrent("");
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Don't let the screen's back-swipe or other gestures steal the stroke mid-draw.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        live.current = `M${pt(e)}`;
        pointCount.current = 1;
        setCurrent(live.current);
      },
      onPanResponderMove: (e) => {
        if (pointCount.current > 600) return; // keep each stroke compact
        live.current += ` L${pt(e)}`;
        pointCount.current++;
        setCurrent(live.current);
      },
      onPanResponderRelease: finish,
      // If the OS still takes the touch, keep what was drawn instead of dropping it.
      onPanResponderTerminate: finish,
    });
  }, []);

  const save = async () => {
    if (!paths.length) return toast.error("Draw your signature first");
    setSaving(true);
    try {
      setUser(await Auth.saveSignature({ paths, width: Math.round(size.width), height: Math.round(size.height) }));
      haptic.success();
      toast.success("Signature saved. It will appear on your invoices and receipts.");
      navigation.goBack();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <Screen header={<Header title="Your signature" />} scroll={false} footer={
      <Row gap={12}>
        <View style={{ flex: 1 }}><Button title="Clear" variant="ghost" icon="refresh" onPress={() => setPaths([])} /></View>
        <View style={{ flex: 2 }}><Button title="Save signature" icon="checkmark" onPress={save} loading={saving} /></View>
      </Row>
    }>
      <View style={{ padding: 20, flex: 1 }}>
        <T v="body">Sign with your finger. It's printed as the authorised signatory on invoices, payment receipts and deposit settlements.</T>
        <View style={st.pad} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })} {...responder.panHandlers}>
          {/* The drawing must not receive touches itself: otherwise starting a stroke on an existing line
              reports coordinates relative to that line, not the pad. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={size.width} height={size.height}>
              {[...paths, current].filter(Boolean).map((d, i) => (
                <Path key={i} d={d} stroke="#003488" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </Svg>
          </View>
          {!paths.length && !current && (
            <View style={st.hint} pointerEvents="none">
              <Ionicons name="create-outline" size={26} color={colors.textMuted} />
              <T v="small">Sign here</T>
            </View>
          )}
          <View style={st.baseline} pointerEvents="none" />
        </View>
        <Notice tone="info" icon="shield-checkmark" message="Your signature is stored securely and only used on documents you issue." style={{ marginTop: 16 }} />
      </View>
    </Screen>
  );
};

const PREFS: { key: "push" | "email" | "sms" | "whatsapp"; label: string; sub: string; icon: IconName }[] = [
  { key: "push", label: "App notifications", sub: "Instant alerts on this phone", icon: "notifications-outline" },
  { key: "email", label: "Email", sub: "Invoices, receipts and reminders with PDFs", icon: "mail-outline" },
  { key: "sms", label: "SMS", sub: "Rent due and overdue reminders", icon: "chatbox-ellipses-outline" },
  { key: "whatsapp", label: "WhatsApp", sub: "Invoices, reminders and receipts on WhatsApp", icon: "logo-whatsapp" },
];

export const MessagePreferencesScreen = () => {
  const { user, setUser } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, any>>(user?.preferences || {});
  const update = async (key: string, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      const saved = await Auth.preferences({ [key]: value });
      if (user) setUser({ ...user, preferences: saved });
    } catch (e) { setPrefs(prefs); toast.error(errorMessage(e)); }
  };
  return (
    <Screen header={<Header title="Message preferences" />}>
      <T v="body" style={{ marginBottom: 16 }}>Choose how RentLynk reaches you. Security alerts and one-time codes are always sent.</T>
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {PREFS.map((p, i) => (
          <Row key={p.key} between style={{ paddingVertical: 14, borderBottomWidth: i < PREFS.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border }}>
            <Row gap={12} style={{ flex: 1 }}>
              <IconBubble icon={p.icon} tone={p.key === "whatsapp" ? "success" : "primary"} size={40} />
              <View style={{ flex: 1 }}><T v="title">{p.label}</T><T v="caption">{p.sub}</T></View>
            </Row>
            <Toggle value={prefs[p.key] !== false} onChange={(v) => update(p.key, v)} />
          </Row>
        ))}
      </Card>
      <Notice tone="info" message="SMS and WhatsApp are sent to your registered mobile number. Update it in Personal details." style={{ marginTop: 16 }} />
    </Screen>
  );
};

const st = StyleSheet.create({
  pad: { marginTop: 18, height: 220, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed", overflow: "hidden" },
  hint: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", gap: 6 },
  baseline: { position: "absolute", left: 24, right: 24, bottom: 48, height: 1, backgroundColor: colors.border },
});

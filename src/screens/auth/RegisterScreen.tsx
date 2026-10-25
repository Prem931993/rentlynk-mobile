import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { AuthLayout } from "./AuthLayout";
import { Checkbox, Field, PinInput } from "../../components/Inputs";
import { pinProblem } from "../../utils/pin";
import { Button, Card, IconName, Notice, Row, T, Tap } from "../../components/ui";
import { colors, fonts, gradients, radius } from "../../theme";
import { useAuth } from "../../stores/authStore";
import { errorMessage, fieldErrors } from "../../api/client";
import { LegalDoc, Public } from "../../api/endpoints";
import { haptic } from "../../utils/haptics";
import { toast } from "../../components/Feedback";

type Role = "OWNER" | "TENANT";

const RoleCard = ({ role, active, onPress }: { role: Role; active: boolean; onPress: () => void }) => {
  const owner = role === "OWNER";
  const icon: IconName = owner ? "business" : "key";
  const points = owner
    ? ["Add properties & units", "Invite tenants, auto-bill rent", "Approve payments, settle deposits"]
    : ["See your agreement & house rules", "Pay rent, get instant receipts", "Raise repairs, give notice"];
  return (
    <Tap onPress={onPress} style={[st.role, active && st.roleActive]}>
      <Row gap={14}>
        <LinearGradient colors={owner ? gradients.brand : gradients.emerald} style={st.roleIcon}><Ionicons name={icon} size={26} color="#fff" /></LinearGradient>
        <View style={{ flex: 1 }}>
          <T v="h3">{owner ? "I'm a property owner" : "I'm a tenant"}</T>
          <T v="caption">{owner ? "Landlords & property managers" : "Renting a home or shop"}</T>
        </View>
        <View style={[st.radio, active && { borderColor: colors.primary }]}>{active && <View style={st.radioDot} />}</View>
      </Row>
      <View style={{ marginTop: 14, gap: 6 }}>
        {points.map((p) => (
          <Row key={p} gap={8}><Ionicons name="checkmark-circle" size={16} color={owner ? colors.primary : colors.success} /><T v="small">{p}</T></Row>
        ))}
      </View>
    </Tap>
  );
};

export const RegisterScreen = ({ navigation, route }: any) => {
  const register = useAuth((s) => s.register);
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role | null>(route.params?.role || null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", pin: "", confirm: "", invite: route.params?.invite || "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = { email: useRef<React.ComponentRef<typeof TextInput>>(null), phone: useRef<React.ComponentRef<typeof TextInput>>(null) };

  useEffect(() => {
    if (step === 3 && role) Public.legal(role).then(setDocs).catch((e) => setError(errorMessage(e)));
  }, [step, role]);

  const set = (k: keyof typeof form) => (v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };
  const allAccepted = docs.length > 0 && docs.every((d) => accepted[d.id]);

  const validateDetails = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Enter your full name";
    else if (!/^[\p{L}\p{M} .'-]+$/u.test(form.name.trim())) e.name = "Use letters only";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Enter a valid email address";
    if (form.phone.replace(/\D/g, "").length < 10) e.phone = "Enter your 10-digit mobile number — you'll sign in with it";
    const pinErr = pinProblem(form.pin);
    if (pinErr) e.pin = pinErr;
    else if (form.pin !== form.confirm) e.confirm = "PINs don't match";
    if (form.invite && form.invite.replace(/[^A-Za-z0-9]/g, "").length !== 8) e.invite = "Invite codes have 8 characters, like ABCD-1234";
    setErrors(e);
    if (Object.keys(e).length) haptic.warning();
    return !Object.keys(e).length;
  };

  const submit = async () => {
    if (!allAccepted) { haptic.warning(); return setError("Please review and accept every document to continue."); }
    setLoading(true); setError(null);
    try {
      const res = await register({
        name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(), pin: form.pin,
        role, accepted_documents: docs.map((d) => d.id), invite_code: role === "TENANT" && form.invite ? form.invite : null,
      });
      haptic.success();
      toast.success(res.lease_linked ? "Account created and linked to your new home!" : "Welcome to RentLynk!");
    } catch (e) {
      const fe = fieldErrors(e);
      if (Object.keys(fe).length) { setErrors(fe); setStep(2); }
      setError(errorMessage(e));
      haptic.error();
    } finally { setLoading(false); }
  };

  const titles = useMemo(() => ({
    1: ["Create your account", "First, tell us how you'll use RentLynk."],
    2: [role === "OWNER" ? "Owner details" : "Tenant details", "We'll use these to set up your secure account."],
    3: ["Review & agree", "Please read and accept these before we create your account."],
  } as Record<number, [string, string]>), [role]);

  return (
    <AuthLayout title={titles[step][0]} subtitle={titles[step][1]} step={{ at: step, of: 3 }}>
      {error && <Notice tone="danger" message={error} style={{ marginBottom: 16 }} />}

      {step === 1 && (
        <>
          <RoleCard role="OWNER" active={role === "OWNER"} onPress={() => setRole("OWNER")} />
          <View style={{ height: 14 }} />
          <RoleCard role="TENANT" active={role === "TENANT"} onPress={() => setRole("TENANT")} />
          <Button title="Continue" iconRight="arrow-forward" disabled={!role} onPress={() => setStep(2)} style={{ marginTop: 24 }} />
          <Row gap={6} style={{ justifyContent: "center", marginTop: 22 }}>
            <T v="small">Already have an account?</T>
            <Tap onPress={() => navigation.navigate("Login")}><T v="small" color={colors.primary} style={{ fontFamily: fonts.bold }}>Sign in</T></Tap>
          </Row>
        </>
      )}

      {step === 2 && (
        <>
          <Field label="Full name" icon="person-outline" placeholder="As on your ID" value={form.name} onChangeText={set("name")} error={errors.name}
            autoComplete="name" textContentType="name" returnKeyType="next" onSubmitEditing={() => refs.email.current?.focus()} />
          <Field ref={refs.email} label="Email" icon="mail-outline" placeholder="you@example.com" value={form.email} onChangeText={set("email")} error={errors.email}
            autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next"
            onSubmitEditing={() => refs.phone.current?.focus()} hint={role === "TENANT" ? "Use the email your owner invited, if you have an invite." : undefined} />
          <Field ref={refs.phone} label="Mobile number" icon="call-outline" placeholder="98765 43210" value={form.phone} onChangeText={set("phone")}
            error={errors.phone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" hint="You'll sign in with this number (or your email)." />
          <PinInput label="Create a 4-digit PIN" value={form.pin} onChange={set("pin")} autoFocus={false} error={errors.pin} />
          <PinInput label="Confirm PIN" value={form.confirm} onChange={set("confirm")} autoFocus={false} error={errors.confirm} />
          <Notice tone="info" icon="lock-closed" message="Avoid easy PINs like 1234, 0000 or your birth year. Never share your PIN — RentLynk will never ask for it." style={{ marginBottom: 16 }} />
          {role === "TENANT" && (
            <Field label="Invite code (optional)" icon="ticket-outline" placeholder="ABCD-1234" value={form.invite}
              onChangeText={(t) => set("invite")(t.toUpperCase())} autoCapitalize="characters" error={errors.invite}
              hint="Got a code from your owner? Enter it to join your home instantly." />
          )}
          <Row gap={12} style={{ marginTop: 8 }}>
            <View style={{ flex: 1 }}><Button title="Back" variant="ghost" onPress={() => setStep(1)} /></View>
            <View style={{ flex: 2 }}><Button title="Continue" iconRight="arrow-forward" onPress={() => validateDetails() && setStep(3)} /></View>
          </Row>
        </>
      )}

      {step === 3 && (
        <>
          {docs.map((d) => (
            <Card key={d.id} style={{ marginBottom: 12 }}>
              <Row gap={12}>
                <View style={st.docIcon}><Ionicons name={d.slug.includes("privacy") ? "finger-print" : d.slug.includes("rental") ? "home" : "document-text"} size={20} color={colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <T v="title">{d.title}</T>
                  <T v="caption">Version {d.version}</T>
                </View>
                <Tap onPress={() => navigation.navigate("Legal", { slug: d.slug })} style={st.readBtn}><T v="small" color={colors.primary} style={{ fontFamily: fonts.bold }}>Read</T></Tap>
              </Row>
              {d.summary && <T v="small" style={{ marginTop: 10 }}>{d.summary}</T>}
              <View style={{ marginTop: 10 }}>
                <Checkbox checked={!!accepted[d.id]} onToggle={() => setAccepted((a) => ({ ...a, [d.id]: !a[d.id] }))}>
                  <T v="small" style={{ color: colors.text }}>I have read and agree to the {d.title}</T>
                </Checkbox>
              </View>
            </Card>
          ))}
          {docs.length > 1 && (
            <Tap onPress={() => setAccepted(Object.fromEntries(docs.map((d) => [d.id, !allAccepted])))} style={{ alignSelf: "center", marginVertical: 8 }}>
              <T v="small" color={colors.primary} style={{ fontFamily: fonts.bold }}>{allAccepted ? "Clear all" : "Agree to all"}</T>
            </Tap>
          )}
          <Notice tone="info" icon="shield-checkmark" message="We record the version you accept and when, so you always know what you agreed to. You can review these anytime in Settings." style={{ marginVertical: 12 }} />
          <Row gap={12}>
            <View style={{ flex: 1 }}><Button title="Back" variant="ghost" onPress={() => setStep(2)} /></View>
            <View style={{ flex: 2 }}><Button title="Create account" icon="sparkles" onPress={submit} loading={loading} disabled={!allAccepted} /></View>
          </Row>
        </>
      )}
    </AuthLayout>
  );
};

const st = StyleSheet.create({
  role: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, borderWidth: 2, borderColor: colors.border },
  roleActive: { borderColor: colors.primary, backgroundColor: "#FAFAFF" },
  roleIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  docIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  readBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
});

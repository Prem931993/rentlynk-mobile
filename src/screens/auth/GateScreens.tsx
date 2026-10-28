import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AuthLayout } from "./AuthLayout";
import { Checkbox, Field, PasswordStrength, passwordChecks, PinInput } from "../../components/Inputs";
import { pinProblem } from "../../utils/pin";
import { Button, Card, Notice, Row, T, Tap } from "../../components/ui";
import { LogoMark } from "../../components/Brand";
import { colors, fonts, gradients } from "../../theme";
import { useAuth } from "../../stores/authStore";
import { Auth } from "../../api/endpoints";
import { errorMessage, tokens } from "../../api/client";
import { confirm, toast } from "../../components/Feedback";
import { haptic } from "../../utils/haptics";

/** Shown after sign-in when the user must accept new/updated legal documents. */
export const ConsentScreen = ({ navigation }: any) => {
  const { requirements, user, signOut, setRequirements } = useAuth();
  const docs = requirements.pending_consents;
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const all = docs.length > 0 && docs.every((d) => accepted[d.id]);
  const isUpdate = user?.registration_source === "SELF" || !!(user as any)?.last_login_at;

  const accept = async () => {
    setLoading(true); setError(null);
    try {
      const r = await Auth.acceptConsents(docs.map((d) => d.id));
      setRequirements(r.requirements);
      haptic.success();
      toast.success("Thanks! You're all set.");
    } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  };

  const decline = async () => {
    const ok = await confirm({ title: "Decline and sign out?", message: "You need to accept these documents to use RentLynk. You can sign in again anytime to review them.", confirm: "Sign out", danger: true });
    if (ok) signOut();
  };

  return (
    <AuthLayout back={false} title={`Hi ${user?.name?.split(" ")[0] || "there"} 👋`}
      subtitle={isUpdate ? "We've updated our policies. Please review and accept them to continue." : "Before you start, please review and accept our policies."}>
      {error && <Notice tone="danger" message={error} style={{ marginBottom: 16 }} />}
      {docs.map((d) => (
        <Card key={d.id} style={{ marginBottom: 12 }}>
          <Row between>
            <View style={{ flex: 1 }}>
              <T v="title">{d.title}</T>
              <T v="caption">Version {d.version}</T>
            </View>
            <Tap onPress={() => navigation.navigate("Legal", { slug: d.slug })} style={st.read}><T v="small" color={colors.primary} style={{ fontFamily: fonts.bold }}>Read</T></Tap>
          </Row>
          {d.summary && <T v="small" style={{ marginTop: 8 }}>{d.summary}</T>}
          <View style={{ marginTop: 10 }}>
            <Checkbox checked={!!accepted[d.id]} onToggle={() => setAccepted((a) => ({ ...a, [d.id]: !a[d.id] }))}>
              <T v="small" style={{ color: colors.text }}>I agree to the {d.title}</T>
            </Checkbox>
          </View>
        </Card>
      ))}
      <Button title="Accept & continue" icon="checkmark-done" onPress={accept} loading={loading} disabled={!all} style={{ marginTop: 8 }} />
      <Button title="Decline & sign out" variant="ghost" onPress={decline} style={{ marginTop: 10 }} />
    </AuthLayout>
  );
};

/**
 * Owners & tenants must have their own PIN:
 * - admin-created / admin-reset accounts replace the temporary PIN (entered first),
 * - accounts from before PINs (signed in with a password) create one now.
 */
export const SetPinScreen = () => {
  const { requirements, setRequirements, setUser, signOut, user } = useAuth();
  const hasTemp = !!requirements.must_change_password;
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (hasTemp && current.length !== 4) return setError("Enter the temporary PIN from your administrator");
    const p = pinProblem(pin);
    if (p) return setError(p);
    if (pin !== confirmPin) return setError("PINs don't match");
    setLoading(true); setError(null);
    try {
      const r = await Auth.setPin(pin, hasTemp ? current : undefined);
      await tokens.save(r.accessToken, r.refreshToken);
      setUser(r.user);
      setRequirements(r.requirements);
      haptic.success();
      toast.success("PIN created. Use it to sign in from now on.");
    } catch (e) { setError(errorMessage(e)); haptic.error(); } finally { setLoading(false); }
  };

  return (
    <AuthLayout back={false} title="Create your PIN"
      subtitle={hasTemp ? `Your account (${user?.email}) was set up with a temporary PIN. Choose your own 4-digit PIN to continue.` : "RentLynk now uses a 4-digit PIN instead of a password. Create one to continue — you'll sign in with your mobile number or email and this PIN."}>
      {error && <Notice tone="danger" message={error} style={{ marginBottom: 16 }} />}
      {hasTemp && <PinInput label="Temporary PIN" value={current} onChange={setCurrent} autoFocus={false} />}
      <PinInput label="New 4-digit PIN" value={pin} onChange={setPin} autoFocus={false} />
      <PinInput label="Confirm new PIN" value={confirmPin} onChange={setConfirmPin} autoFocus={false} />
      <Notice tone="info" icon="lock-closed" message="Avoid easy PINs like 1234, 0000 or your birth year. Never share your PIN with anyone." style={{ marginBottom: 16 }} />
      <Button title="Save PIN" icon="checkmark-circle-outline" onPress={submit} loading={loading} />
      <Button title="Sign out" variant="ghost" onPress={() => signOut()} style={{ marginTop: 10 }} />
    </AuthLayout>
  );
};

/** Admin-created accounts (or admin password resets) must choose their own password. */
export const ForceChangePasswordScreen = () => {
  const { setRequirements, signOut, user } = useAuth();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!current) return setError("Enter the temporary password you were given");
    if (!passwordChecks(pw).every((c) => c.ok)) return setError("Choose a stronger password");
    if (pw !== confirmPw) return setError("Passwords don't match");
    setLoading(true); setError(null);
    try {
      const r = await Auth.changePassword(current, pw);
      await tokens.save(r.accessToken, r.refreshToken);
      setRequirements(r.requirements);
      haptic.success();
      toast.success("Password set. Your account is secure.");
    } catch (e) { setError(errorMessage(e)); haptic.error(); } finally { setLoading(false); }
  };

  return (
    <AuthLayout back={false} title="Set your password" subtitle={`Your account (${user?.email}) was created with a temporary password. Choose your own to continue.`}>
      {error && <Notice tone="danger" message={error} style={{ marginBottom: 16 }} />}
      <Field label="Temporary password" icon="key-outline" value={current} onChangeText={setCurrent} secure placeholder="From your administrator" />
      <Field label="New password" icon="lock-closed-outline" value={pw} onChangeText={setPw} secure placeholder="Create a strong password" textContentType="newPassword" />
      <PasswordStrength password={pw} />
      <Field label="Confirm new password" icon="shield-checkmark-outline" value={confirmPw} onChangeText={setConfirmPw} secure placeholder="Type it again" />
      <Button title="Save password" icon="checkmark-circle-outline" onPress={submit} loading={loading} />
      <Button title="Sign out" variant="ghost" onPress={() => signOut()} style={{ marginTop: 10 }} />
    </AuthLayout>
  );
};

/** Biometric unlock when the app opens with a saved session. */
export const LockScreen = () => {
  const { unlock, signOut, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  const attempt = async () => { const ok = await unlock(); setFailed(!ok); if (!ok) haptic.error(); };
  useEffect(() => { attempt(); }, []);
  return (
    <LinearGradient colors={[...gradients.night, "#0A3A82"]} style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28 }}>
      <LogoMark size={72} tile />
      <T v="h1" color="#fff" style={{ marginTop: 24 }}>Welcome back</T>
      <T v="body" color="rgba(226,232,255,0.75)" center style={{ marginTop: 6 }}>{user?.name}{"\n"}Unlock to continue</T>
      <Tap onPress={attempt} style={st.fp}>
        <Ionicons name="finger-print" size={44} color="#9EC5F2" />
      </Tap>
      {failed && <T v="small" color="#FDA4AF">Couldn't verify. Try again.</T>}
      <View style={{ position: "absolute", bottom: insets.bottom + 24, left: 28, right: 28 }}>
        <Button title="Use password instead" variant="light" onPress={() => signOut()} />
      </View>
    </LinearGradient>
  );
};

const st = StyleSheet.create({
  read: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primarySoft },
  fp: { marginTop: 40, marginBottom: 16, width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(158,197,242,0.12)", borderWidth: 1, borderColor: "rgba(158,197,242,0.3)", alignItems: "center", justifyContent: "center" },
});

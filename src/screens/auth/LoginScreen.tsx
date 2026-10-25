import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { AuthLayout } from "./AuthLayout";
import { Field, PinInput } from "../../components/Inputs";
import { Button, Notice, Row, T, Tap } from "../../components/ui";
import { colors, fonts } from "../../theme";
import { useAuth } from "../../stores/authStore";
import { errorMessage } from "../../api/client";
import { prefs } from "../../api/secureStorage";
import { haptic } from "../../utils/haptics";

const looksValid = (id: string) => /^\S+@\S+\.\S+$/.test(id.trim()) || id.replace(/\D/g, "").length >= 10;

export const LoginScreen = ({ navigation }: any) => {
  const signIn = useAuth((s) => s.signIn);
  const reason = useAuth((s) => s.signOutReason);
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    Promise.all([prefs.get<string>("lastIdentifier"), prefs.get<string>("lastEmail")]).then(([id, email]) => (id || email) && setIdentifier(id || email || ""));
  }, []);

  const submit = async (pinValue = pin) => {
    if (!looksValid(identifier)) { setIdError("Enter your 10-digit mobile number or email"); return haptic.warning(); }
    if (!usePassword && pinValue.length !== 4) return;
    if (usePassword && !password) return setError("Enter your password");
    setLoading(true); setError(null); setIdError(null);
    try {
      await signIn(identifier, usePassword ? { password } : { pin: pinValue });
      haptic.success();
    } catch (e: any) {
      const code = e?.response?.data?.code;
      if (code === "PIN_NOT_SET") {
        setUsePassword(true);
        setError("Your account was created before PINs. Sign in once with your password — you'll then create your PIN.");
      } else {
        setError(errorMessage(e));
        setShakeKey((k) => k + 1);
      }
      setPin("");
      setPassword("");
    } finally { setLoading(false); }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in with your mobile number or email and your 4-digit PIN.">
      {reason && !error && <Notice tone="warning" message={reason} style={{ marginBottom: 18 }} />}
      {error && <Notice tone={usePassword && !password ? "info" : "danger"} message={error} style={{ marginBottom: 18 }} />}
      <Field label="Mobile number or email" icon="person-circle-outline" placeholder="98765 43210 or you@example.com" value={identifier}
        onChangeText={(t) => { setIdentifier(t); setIdError(null); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
        autoComplete="username" textContentType="username" returnKeyType="next" error={idError} />
      {usePassword ? (
        <>
          <Field label="Password" icon="lock-closed-outline" placeholder="Your current password" value={password} onChangeText={setPassword}
            secure autoComplete="password" textContentType="password" returnKeyType="go" onSubmitEditing={() => submit()} />
          <Button title="Sign in" onPress={() => submit()} loading={loading} icon="log-in-outline" />
          <Tap onPress={() => { setUsePassword(false); setError(null); }} style={{ alignSelf: "center", marginTop: 14 }}>
            <T v="small" color={colors.primary} style={{ fontFamily: fonts.semibold }}>Use my PIN instead</T>
          </Tap>
        </>
      ) : (
        <>
          <PinInput label="PIN" value={pin} onChange={(v) => { setPin(v); setError(null); }} onComplete={(v) => submit(v)} autoFocus={false} error={null} errorKey={shakeKey} />
          <Button title={loading ? "Signing in…" : "Sign in"} onPress={() => submit()} loading={loading} disabled={pin.length !== 4} icon="log-in-outline" />
        </>
      )}
      <Row between style={{ marginTop: 20 }}>
        <Tap onPress={() => navigation.navigate("Forgot", { identifier })}>
          <T v="small" color={colors.primary} style={{ fontFamily: fonts.semibold }}>Forgot PIN?</T>
        </Tap>
        <Tap onPress={() => navigation.navigate("Register")}>
          <T v="small" color={colors.primary} style={{ fontFamily: fonts.bold }}>Create an account</T>
        </Tap>
      </Row>
      <View style={{ marginTop: 32, alignItems: "center" }}>
        <T v="caption" center>🔒 Your PIN is never stored on this phone. After 5 wrong tries the account is locked for a while to keep it safe.</T>
      </View>
    </AuthLayout>
  );
};

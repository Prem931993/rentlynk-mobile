import React, { useEffect, useState } from "react";
import { AuthLayout } from "./AuthLayout";
import { CodeInput, Field, PinInput } from "../../components/Inputs";
import { Button, Notice, Row, T, Tap } from "../../components/ui";
import { colors, fonts } from "../../theme";
import { Auth } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { toast } from "../../components/Feedback";
import { haptic } from "../../utils/haptics";
import { pinProblem } from "../../utils/pin";

export const ForgotPasswordScreen = ({ navigation, route }: any) => {
  const [identifier, setIdentifier] = useState(route.params?.identifier || route.params?.email || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    const id = identifier.trim();
    if (!/^\S+@\S+\.\S+$/.test(id) && id.replace(/\D/g, "").length < 10) return setError("Enter your mobile number or email");
    setLoading(true); setError(null);
    try {
      const r = await Auth.forgot(id);
      navigation.replace("Reset", { identifier: id, channels: r?.channels });
    } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  };
  return (
    <AuthLayout title="Forgot your PIN?" subtitle="We'll send a 6-digit code to your registered mobile number and email.">
      {error && <Notice tone="danger" message={error} style={{ marginBottom: 16 }} />}
      <Field label="Mobile number or email" icon="person-circle-outline" value={identifier} onChangeText={setIdentifier} autoCapitalize="none"
        keyboardType="email-address" placeholder="98765 43210 or you@example.com" returnKeyType="send" onSubmitEditing={send} />
      <Button title="Send code" icon="paper-plane-outline" onPress={send} loading={loading} />
      <Notice tone="info" message="For your security we don't reveal whether an account exists. Codes expire in 10 minutes." style={{ marginTop: 20 }} />
    </AuthLayout>
  );
};

export const ResetPasswordScreen = ({ navigation, route }: any) => {
  const identifier: string = route.params?.identifier;
  const channels = route.params?.channels;
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);
  useEffect(() => { const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000); return () => clearInterval(t); }, []);

  const where = [channels?.sms, channels?.email].filter(Boolean).join(" and ");
  const submit = async () => {
    if (otp.length !== 6) return setError("Enter the 6-digit code we sent you");
    const p = pinProblem(pin);
    if (p) return setError(p);
    if (pin !== confirmPin) return setError("PINs don't match");
    setLoading(true); setError(null);
    try {
      await Auth.reset(identifier, otp, pin);
      haptic.success();
      toast.success("PIN updated. Sign in with your new PIN.");
      navigation.navigate("Login");
    } catch (e) { setError(errorMessage(e)); haptic.error(); } finally { setLoading(false); }
  };
  return (
    <AuthLayout title="Enter the code" subtitle={where ? `We sent a 6-digit code to ${where}.` : "If an account exists, we've sent a 6-digit code to its mobile number and email."}>
      {error && <Notice tone="danger" message={error} style={{ marginBottom: 16 }} />}
      <CodeInput value={otp} onChange={setOtp} />
      <PinInput label="New 4-digit PIN" value={pin} onChange={setPin} autoFocus={false} />
      <PinInput label="Confirm new PIN" value={confirmPin} onChange={setConfirmPin} autoFocus={false} />
      <Button title="Save new PIN" onPress={submit} loading={loading} icon="checkmark-circle-outline" />
      <Row gap={6} style={{ justifyContent: "center", marginTop: 20 }}>
        <T v="small">Didn't get it?</T>
        {cooldown > 0 ? <T v="small" color={colors.textMuted}>Resend in {cooldown}s</T> : (
          <Tap onPress={async () => { await Auth.forgot(identifier).catch(() => {}); setCooldown(60); toast.info("A new code is on its way"); }}>
            <T v="small" color={colors.primary} style={{ fontFamily: fonts.bold }}>Resend code</T>
          </Tap>
        )}
      </Row>
    </AuthLayout>
  );
};

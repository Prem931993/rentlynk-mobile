import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header, Hero, Screen } from "../../components/Screen";
import { Avatar, Badge, Button, Card, EmptyState, FadeIn, IconButton, ListItem, Notice, Row, T, Tap } from "../../components/ui";
import { Field, PinInput, Toggle } from "../../components/Inputs";
import { pinProblem } from "../../utils/pin";
import { Loadable } from "../../components/States";
import { confirm, toast } from "../../components/Feedback";
import { colors, fonts, radius, shadow } from "../../theme";
import { biometricAvailable, useAuth } from "../../stores/authStore";
import { Auth, Notifications } from "../../api/endpoints";
import { errorMessage, fieldErrors, tokens } from "../../api/client";
import { useLoad } from "../../utils/useLoad";
import { fmtDateTime, timeAgo, titleCase } from "../../utils/format";
import { appendFile, pickImage } from "../../utils/files";
import { useSettingsStore } from "../../stores/settingsStore";

// ── Notifications ──────────────────────────────────────────────────────────
const NOTIF_ICON: Record<string, [any, any]> = {
  PAYMENT_SUBMITTED: ["cash-outline", "warning"], PAYMENT_APPROVED: ["checkmark-circle-outline", "success"], PAYMENT_REJECTED: ["close-circle-outline", "danger"],
  INVOICE_GENERATED: ["document-text-outline", "primary"], RENT_REMINDER: ["alarm-outline", "warning"], RENT_OVERDUE: ["alert-circle-outline", "danger"],
  LEASE_CREATED: ["home-outline", "success"], LEASE_EXPIRING: ["hourglass-outline", "warning"], MOVE_OUT: ["exit-outline", "info"],
  SETTLEMENT: ["calculator-outline", "primary"], MAINTENANCE: ["construct-outline", "info"], ANNOUNCEMENT: ["megaphone-outline", "primary"],
  DEPOSIT: ["wallet-outline", "success"], SECURITY: ["shield-checkmark-outline", "danger"], GENERAL: ["sparkles-outline", "primary"],
};

export const NotificationsScreen = () => {
  const q = useLoad(() => Notifications.list(), []);
  const items: any[] = q.data?.data?.items || [];
  const readAll = async () => { await Notifications.readAll(); q.reload(); };
  return (
    <Screen header={<Header title="Notifications" right={items.some((n) => !n.is_read) ? <IconButton icon="checkmark-done" onPress={readAll} label="Mark all read" /> : undefined} />}
      refreshing={q.refreshing} onRefresh={q.refresh}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload}>
        {!items.length ? <EmptyState icon="notifications-off-outline" title="You're all caught up" message="Rent reminders, approvals and updates will show up here." /> : (
          items.map((n, i) => {
            const [icon, tone] = NOTIF_ICON[n.type] || NOTIF_ICON.GENERAL;
            return (
              <FadeIn key={n.id} delay={Math.min(i, 8) * 40}>
                <Tap onPress={async () => { if (!n.is_read) { await Notifications.read(n.id); q.reload(); } }} style={[st.notif, !n.is_read && st.notifUnread]}>
                  <Row gap={12} style={{ alignItems: "flex-start" }}>
                    <View style={[st.notifIcon, { backgroundColor: (colors as any)[tone + "Soft"] || colors.primarySoft }]}>
                      <Ionicons name={icon} size={20} color={(colors as any)[tone] || colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Row between><T v="title" style={{ flex: 1 }} numberOfLines={1}>{n.title}</T><T v="caption">{timeAgo(n.created_at)}</T></Row>
                      <T v="small" style={{ marginTop: 3 }}>{n.body}</T>
                    </View>
                    {!n.is_read && <View style={st.unreadDot} />}
                  </Row>
                </Tap>
              </FadeIn>
            );
          })
        )}
      </Loadable>
    </Screen>
  );
};

// ── Account hub ────────────────────────────────────────────────────────────
export const AccountScreen = ({ navigation }: any) => {
  const { user, signOut } = useAuth();
  const company = useSettingsStore((s) => s.companyName);
  const owner = user?.role === "OWNER";
  const out = async () => { if (await confirm({ title: "Sign out?", message: "You'll need your password to sign in again.", confirm: "Sign out", danger: true, icon: "log-out-outline" })) signOut(); };
  return (
    <Screen hero={<Hero>
      <T v="h2" color="#fff">Account</T>
      <Row gap={14} style={{ marginTop: 20 }}>
        <Avatar name={user?.name} uri={user?.avatar_url} size={64} />
        <View style={{ flex: 1 }}>
          <T v="h3" color="#fff">{user?.name}</T>
          <T v="small" color="rgba(226,232,255,0.75)">{user?.email}</T>
          <View style={{ marginTop: 6 }}><Badge label={owner ? "Property owner" : "Tenant"} tone={owner ? "primary" : "success"} small /></View>
        </View>
      </Row>
    </Hero>}>
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListItem icon="person-outline" title="Personal details" subtitle="Name, phone, emergency contact" onPress={() => navigation.navigate("EditProfile")} />
        {owner && <ListItem icon="card-outline" iconTone="success" title="Payout details" subtitle="UPI & bank shown to your tenants" onPress={() => navigation.navigate("PayoutDetails")} />}
        {owner && <ListItem icon="create-outline" iconTone="info" title="Signature" subtitle={user?.has_signature ? "Printed on invoices & receipts" : "Add your signature for invoices"} onPress={() => navigation.navigate("Signature")} />}
        <ListItem icon="shield-checkmark-outline" iconTone="danger" title="Security" subtitle="Password, biometrics, active devices" onPress={() => navigation.navigate("Security")} />
        <ListItem icon="notifications-outline" iconTone="warning" title="Message preferences" subtitle="App, email, SMS and WhatsApp" onPress={() => navigation.navigate("MessagePreferences")} />
      </Card>
      {owner ? (
        <Card padded={false} style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <ListItem icon="megaphone-outline" title="Notices to tenants" onPress={() => navigation.navigate("Announcements")} />
          <ListItem icon="ticket-outline" title="Tenant invitations" onPress={() => navigation.navigate("Invitations")} />
          <ListItem icon="exit-outline" title="Move-outs & settlements" onPress={() => navigation.navigate("MoveOuts")} />
        </Card>
      ) : (
        <Card padded={false} style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <ListItem icon="ticket-outline" title="Join a home with invite code" onPress={() => navigation.navigate("JoinHome")} />
          <ListItem icon="exit-outline" title="Move out / give notice" onPress={() => navigation.navigate("MoveOut")} />
          <ListItem icon="time-outline" title="Payment history" onPress={() => navigation.navigate("PaymentHistory")} />
        </Card>
      )}
      <Card padded={false} style={{ paddingHorizontal: 16, marginTop: 14 }}>
        <ListItem icon="help-buoy-outline" title="Help & legal" subtitle="FAQs, terms, privacy, support" onPress={() => navigation.navigate("Help")} />
        <ListItem icon="log-out-outline" iconTone="danger" title="Sign out" onPress={out} chevron={false} />
      </Card>
      <T v="caption" center style={{ marginTop: 24 }}>{company} · v1.0.0</T>
    </Screen>
  );
};

// ── Edit profile ───────────────────────────────────────────────────────────
export const EditProfileScreen = ({ navigation }: any) => {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ name: user?.name || "", phone: user?.phone || "", address: user?.address || "", emergency_contact_name: user?.emergency_contact_name || "", emergency_contact_phone: user?.emergency_contact_phone || "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true); setErrors({});
    try { setUser(await Auth.updateProfile(f)); toast.success("Profile updated"); navigation.goBack(); }
    catch (e) { setErrors(fieldErrors(e)); toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  const changePhoto = async () => {
    try {
      const [img] = await pickImage();
      if (!img) return;
      setUploading(true);
      const form = new FormData();
      await appendFile(form, "avatar", img);
      setUser(await Auth.uploadAvatar(form));
      toast.success("Photo updated");
    } catch (e) { toast.error(errorMessage(e)); } finally { setUploading(false); }
  };

  return (
    <Screen header={<Header title="Personal details" />} footer={<Button title="Save changes" onPress={save} loading={saving} />}>
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <Tap onPress={changePhoto}>
          <Avatar name={user?.name} uri={user?.avatar_url} size={96} />
          <View style={st.camera}><Ionicons name={uploading ? "hourglass" : "camera"} size={16} color="#fff" /></View>
        </Tap>
        <T v="caption" style={{ marginTop: 10 }}>{user?.email}</T>
      </View>
      <Field label="Full name" icon="person-outline" value={f.name} onChangeText={set("name")} error={errors.name} />
      <Field label="Mobile number" icon="call-outline" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" error={errors.phone} />
      <Field label="Address" icon="location-outline" value={f.address} onChangeText={set("address")} multiline error={errors.address} />
      <T v="overline" style={{ marginBottom: 12 }}>Emergency contact</T>
      <Field label="Name" icon="people-outline" value={f.emergency_contact_name} onChangeText={set("emergency_contact_name")} />
      <Field label="Phone" icon="call-outline" value={f.emergency_contact_phone} onChangeText={set("emergency_contact_phone")} keyboardType="phone-pad" error={errors.emergency_contact_phone} />
    </Screen>
  );
};

// ── Owner payout details ───────────────────────────────────────────────────
export const PayoutDetailsScreen = ({ navigation }: any) => {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ upi_id: user?.upi_id || "", bank_account_name: user?.bank_account_name || "", bank_account_number: user?.bank_account_number || "", bank_ifsc: user?.bank_ifsc || "", bank_name: user?.bank_name || "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    setSaving(true); setErrors({});
    try { setUser(await Auth.updateProfile(f)); toast.success("Payout details saved"); navigation.goBack(); }
    catch (e) { setErrors(fieldErrors(e)); toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Screen header={<Header title="Payout details" />} footer={<Button title="Save" onPress={save} loading={saving} />}>
      <Notice tone="info" icon="eye-outline" message="Only tenants with an active agreement on your property can see these details, on their invoices and payment screen." style={{ marginBottom: 20 }} />
      <Field label="UPI ID" icon="qr-code-outline" placeholder="yourname@bank" value={f.upi_id} onChangeText={set("upi_id")} autoCapitalize="none" error={errors.upi_id} />
      <T v="overline" style={{ marginBottom: 12, marginTop: 4 }}>Bank account</T>
      <Field label="Account holder name" icon="person-outline" value={f.bank_account_name} onChangeText={set("bank_account_name")} />
      <Field label="Account number" icon="keypad-outline" value={f.bank_account_number} onChangeText={set("bank_account_number")} keyboardType="number-pad" error={errors.bank_account_number} />
      <Field label="IFSC code" icon="business-outline" value={f.bank_ifsc} onChangeText={(t) => set("bank_ifsc")(t.toUpperCase())} autoCapitalize="characters" error={errors.bank_ifsc} />
      <Field label="Bank name" icon="library-outline" value={f.bank_name} onChangeText={set("bank_name")} />
    </Screen>
  );
};

// ── Security center ────────────────────────────────────────────────────────
export const SecurityScreen = () => {
  const { biometricEnabled, setBiometric, signOut } = useAuth();
  const [bioAvailable, setBioAvailable] = useState(false);
  const sessions = useLoad(() => Auth.sessions(), []);
  const [cur, setCur] = useState(""); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { biometricAvailable().then(setBioAvailable); }, []);

  const change = async () => {
    if (cur.length !== 4) return toast.error("Enter your current PIN");
    const problem = pinProblem(pw);
    if (problem) return toast.error(problem);
    if (pw !== pw2) return toast.error("PINs don't match");
    setSaving(true);
    try {
      const r = await Auth.setPin(pw, cur);
      await tokens.save(r.accessToken, r.refreshToken);
      setCur(""); setPw(""); setPw2("");
      toast.success("PIN changed. Other devices were signed out.");
      sessions.reload();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  const revoke = async (id: string) => {
    if (!(await confirm({ title: "Sign out this device?", confirm: "Sign out", danger: true }))) return;
    try { await Auth.revokeSession(id); toast.success("Device signed out"); sessions.reload(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const logoutAll = async () => {
    if (!(await confirm({ title: "Sign out everywhere?", message: "This signs out every device, including this one.", confirm: "Sign out all", danger: true }))) return;
    try { await Auth.logoutAll(); } finally { signOut("You signed out of all devices."); }
  };

  return (
    <Screen header={<Header title="Security" />} keyboard>
      <Card>
        <Row between>
          <Row gap={12} style={{ flex: 1 }}>
            <View style={st.secIcon}><Ionicons name="finger-print" size={22} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <T v="title">Biometric unlock</T>
              <T v="caption">{bioAvailable ? "Face ID / fingerprint when opening the app" : "Not available on this device"}</T>
            </View>
          </Row>
          <Toggle value={biometricEnabled} onChange={async (v) => { if (!bioAvailable) return; const ok = await setBiometric(v); if (!ok && v) toast.error("Couldn't enable biometric unlock"); }} />
        </Row>
      </Card>

      <T v="overline" style={{ marginTop: 24, marginBottom: 12 }}>Change PIN</T>
      <Card>
        <PinInput label="Current PIN" value={cur} onChange={setCur} autoFocus={false} />
        <PinInput label="New PIN" value={pw} onChange={setPw} autoFocus={false} />
        <PinInput label="Confirm new PIN" value={pw2} onChange={setPw2} autoFocus={false} />
        <Button title="Update PIN" onPress={change} loading={saving} disabled={cur.length !== 4 || pw.length !== 4} size="md" />
      </Card>

      <T v="overline" style={{ marginTop: 24, marginBottom: 12 }}>Active devices</T>
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <Loadable loading={sessions.loading} error={sessions.error} onRetry={sessions.reload}>
          {(sessions.data || []).map((s: any) => (
            <ListItem key={s.id} icon={/ios|android/i.test(s.device_name || "") ? "phone-portrait-outline" : "desktop-outline"} iconTone={s.current ? "success" : "neutral"}
              title={`${s.device_name || "Device"}${s.current ? " · This device" : ""}`} subtitle={`Last active ${timeAgo(s.last_used_at)} · ${s.ip_address || ""}`}
              right={!s.current ? <Tap onPress={() => revoke(s.id)}><T v="small" color={colors.danger} style={{ fontFamily: fonts.bold }}>Sign out</T></Tap> : undefined} chevron={false} />
          ))}
        </Loadable>
      </Card>
      <Button title="Sign out of all devices" variant="ghost" icon="power" onPress={logoutAll} style={{ marginTop: 16 }} />
      <Notice tone="info" icon="lock-closed" style={{ marginTop: 16 }} message="Your session keys are stored in your device's secure keychain. After 5 wrong PINs the account locks — 15 minutes at first, then longer each time — so a PIN can't be guessed." />
    </Screen>
  );
};

const st = StyleSheet.create({
  notif: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  notifUnread: { borderColor: "#C7D2FE", backgroundColor: "#FAFAFF" },
  notifIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
  camera: { position: "absolute", right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.bg, ...shadow(1) },
  secIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
});

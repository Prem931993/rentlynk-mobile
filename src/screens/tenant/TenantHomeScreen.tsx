import { callPhone, openLink, openWhatsApp, sendEmail } from "../../utils/links";
import React, { useState } from "react";
import { Dimensions, Image, Linking, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Hero, Screen } from "../../components/Screen";
import { Badge, Button, Card, FadeIn, GradientCard, IconButton, IconName, Notice, Row, SectionHeader, Skeleton, T, Tap } from "../../components/ui";
import { CodeInput } from "../../components/Inputs";
import { ListCard, PaymentRow } from "../../components/Domain";
import { ErrorState } from "../../components/States";
import { toast } from "../../components/Feedback";
import { colors, fonts, gradients, radius, shadow } from "../../theme";
import { useAuth } from "../../stores/authStore";
import { Auth, Notifications, Public, Tenant } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { useLoad } from "../../utils/useLoad";
import { daysUntil, fmtDate, greeting, money, period, relativeDue, timeAgo } from "../../utils/format";
import { haptic } from "../../utils/haptics";

const { width } = Dimensions.get("window");

const Quick = ({ icon, label, onPress, grad }: { icon: IconName; label: string; onPress: () => void; grad: readonly [string, string] }) => (
  <Tap onPress={onPress} style={{ width: "23%", alignItems: "center" }}>
    <LinearGradient colors={grad} style={st.quick}><Ionicons name={icon} size={24} color="#fff" /></LinearGradient>
    <T v="caption" center style={{ marginTop: 8, color: colors.text, fontFamily: fonts.semibold }} numberOfLines={2}>{label}</T>
  </Tap>
);

export const JoinHomeCard = ({ onJoined }: { onJoined: () => void }) => {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const join = async () => {
    setBusy(true);
    try { await Auth.acceptInvite(code); haptic.success(); toast.success("Welcome home! 🏠"); onJoined(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Card>
      <Row gap={12}>
        <View style={st.joinIcon}><Ionicons name="ticket" size={22} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <T v="h3">Join your home</T>
          <T v="small">Enter the 8-character invite code from your owner.</T>
        </View>
      </Row>
      <View style={{ marginTop: 18 }}><CodeInput value={code} onChange={setCode} length={8} numeric={false} autoFocus={false} /></View>
      <Button title="Join" icon="enter-outline" onPress={join} loading={busy} disabled={code.length !== 8} />
    </Card>
  );
};

const Banners = () => {
  const q = useLoad(() => Public.banners(), []);
  if (!q.data?.length) return null;
  return (
    <>
      <SectionHeader title="For you" />
      <ScrollView horizontal pagingEnabled={false} snapToInterval={width * 0.78 + 12} decelerationRate="fast" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {q.data.map((b: any) => (
          <Tap key={b.id} onPress={() => b.target_url && openLink(b.target_url)} style={[st.banner, shadow(1)]}>
            <Image source={{ uri: b.image_url }} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={["transparent", "rgba(11,16,38,0.85)"]} style={StyleSheet.absoluteFill} />
            <View style={{ position: "absolute", left: 16, right: 16, bottom: 14 }}>
              <T v="title" color="#fff">{b.title}</T>
              {b.subtitle && <T v="caption" color="rgba(255,255,255,0.85)" numberOfLines={2}>{b.subtitle}</T>}
            </View>
          </Tap>
        ))}
      </ScrollView>
    </>
  );
};

export const TenantHomeScreen = ({ navigation }: any) => {
  const user = useAuth((s) => s.user);
  const q = useLoad(() => Tenant.dashboard(), []);
  const unread = useLoad(() => Notifications.unread(), []);
  const d = q.data;
  const inv = d?.next_invoice;
  const lease = d?.lease;
  const isL = lease?.agreement_type === "LEASE";
  const inReview = inv && inv.pending_verification > 0 && inv.pending_verification >= inv.balance;
  const overdue = inv && daysUntil(inv.due_date) < 0;

  return (
    <Screen refreshing={q.refreshing} onRefresh={() => { q.refresh(); unread.reload(); }}
      hero={
        <Hero colorsList={["#064E3B", "#065F46", "#059669"]}>
          <Row between>
            <View style={{ flex: 1 }}>
              <T v="small" color="rgba(209,250,229,0.85)">{greeting()},</T>
              <T v="h2" color="#fff" numberOfLines={1}>{user?.name?.split(" ")[0]} 👋</T>
            </View>
            <IconButton icon="notifications-outline" bg="rgba(255,255,255,0.15)" color="#fff" badge={unread.data?.unread} onPress={() => navigation.navigate("Notifications")} />
          </Row>
          {lease ? (
            <Row gap={8} style={{ marginTop: 14 }}>
              <Ionicons name="home" size={14} color="#A7F3D0" />
              <T v="small" color="#D1FAE5" numberOfLines={1}>{lease.property_name} · Unit {lease.unit_number}</T>
            </Row>
          ) : <T v="small" color="#D1FAE5" style={{ marginTop: 14 }}>Your rental, payments and requests in one place.</T>}
        </Hero>
      }>
      {q.error && !d ? <ErrorState message={q.error} onRetry={q.reload} /> : !d ? (
        <View style={{ gap: 14 }}><Skeleton height={190} radius={28} /><Skeleton height={100} radius={20} /></View>
      ) : (
        <>
          <FadeIn>
            {inv ? (
              <GradientCard colorsList={inReview ? gradients.ocean : overdue ? ["#9F1239", "#E11D48"] : gradients.hero}>
                <Row between>
                  <T v="overline" color="rgba(255,255,255,0.75)">{inv.type === "RENT" ? `${period(inv.month, inv.year)} ${isL ? "maintenance" : "rent"}` : inv.type === "DEPOSIT" ? (isL ? "Lease amount" : "Deposit") : `${inv.type.toLowerCase()} invoice`}</T>
                  <Badge label={inReview ? "In review" : relativeDue(inv.due_date)} tone={inReview ? "info" : overdue ? "danger" : "warning"} small />
                </Row>
                <T v="amount" color="#fff" style={{ marginTop: 10, fontSize: 36, lineHeight: 42 }}>{money(inv.balance)}</T>
                <T v="small" color="rgba(255,255,255,0.8)">Due {fmtDate(inv.due_date)}{d.open_invoices.length > 1 ? ` · ${money(d.outstanding)} total outstanding` : ""}</T>
                {inReview ? (
                  <Row gap={10} style={{ marginTop: 18 }}>
                    <Ionicons name="time-outline" size={18} color="#E0F2FE" />
                    <T v="small" color="#E0F2FE" style={{ flex: 1 }}>Your payment is with your owner for verification.</T>
                    <Tap onPress={() => navigation.navigate("TenantInvoice", { id: inv.id })} style={[st.ghostLight, { paddingHorizontal: 18 }]}><T v="title" color="#fff">Details</T></Tap>
                  </Row>
                ) : (
                  <Row gap={10} style={{ marginTop: 18 }}>
                    <View style={{ flex: 1.4 }}>
                      <Button title="Pay now" variant="light" icon="flash" size="md" onPress={() => navigation.navigate("Pay", { invoiceId: inv.id })} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Tap onPress={() => navigation.navigate("TenantInvoice", { id: inv.id })} style={st.ghostLight}><T v="title" color="#fff">Details</T></Tap>
                    </View>
                  </Row>
                )}
              </GradientCard>
            ) : lease ? (
              <GradientCard colorsList={gradients.emerald}>
                <Row gap={14}>
                  <View style={st.okIcon}><Ionicons name="checkmark-done" size={28} color="#fff" /></View>
                  <View style={{ flex: 1 }}>
                    <T v="h3" color="#fff">You're all paid up</T>
                    <T v="small" color="rgba(255,255,255,0.85)">{isL
                      ? `Lease until ${lease.end_date ? fmtDate(lease.end_date) : "—"}. ${Number(lease.maintenance_charge) > 0 ? "Maintenance invoices arrive monthly." : "No monthly rent to pay."}`
                      : `Next invoice arrives about a week before day ${lease.rent_due_day}.`}</T>
                  </View>
                </Row>
              </GradientCard>
            ) : <JoinHomeCard onJoined={q.reload} />}
          </FadeIn>

          {d.rejected_payment && (
            <Notice tone="danger" style={{ marginTop: 14 }} title="Payment needs attention"
              message={`Your ${money(d.rejected_payment.amount)} payment was rejected: ${d.rejected_payment.rejection_reason}`}
              action="Resubmit proof" onAction={() => navigation.navigate("Pay", { invoiceId: d.rejected_payment.invoice_id })} />
          )}
          {lease?.status === "UPCOMING" && <Notice tone="info" style={{ marginTop: 14 }} message={`Your ${isL ? "lease" : "rental"} starts on ${fmtDate(lease.start_date)}.`} />}
          {lease && !lease.tenant_acknowledged_at && (
            <Notice tone="warning" style={{ marginTop: 14 }} title={isL ? "Review your lease" : "Review your rental agreement"} message={isL ? "Please check your lease amount, period and notice terms." : "Please check your rent, deposit and notice terms."} action="View terms" onAction={() => navigation.navigate("MyHomeTab")} />
          )}
          {d.move_out && !["COMPLETED", "CANCELLED"].includes(d.move_out.status) && (
            <Notice tone={d.move_out.status === "SETTLEMENT_PROPOSED" ? "primary" : "info"} style={{ marginTop: 14 }}
              title={d.move_out.status === "SETTLEMENT_PROPOSED" ? "Settlement ready for review" : "Move-out in progress"}
              message={`Planned move-out ${fmtDate(d.move_out.planned_move_out_date)}`} action="Open" onAction={() => navigation.navigate("MoveOut")} />
          )}

          {lease && (
            <>
              <SectionHeader title="Quick actions" />
              <Row between style={{ alignItems: "flex-start" }}>
                <Quick icon="card" label={isL ? "Pay bills" : "Pay rent"} grad={gradients.brand} onPress={() => navigation.navigate("Pay")} />
                <Quick icon="construct" label="Repairs" grad={gradients.ocean} onPress={() => navigation.navigate("NewMaintenance")} />
                <Quick icon="receipt" label="Bills" grad={gradients.emerald} onPress={() => navigation.navigate("TenantInvoices")} />
                <Quick icon="exit" label="Move out" grad={gradients.sunset} onPress={() => navigation.navigate("MoveOut")} />
              </Row>

              <Row gap={12} style={{ marginTop: 18 }}>
                <Card style={{ flex: 1 }} onPress={() => navigation.navigate("MyHomeTab")}>
                  <T v="caption">{isL ? "Lease amount" : "Deposit held"}</T><T v="h3" style={{ marginTop: 4 }}>{money(d.deposit_held)}</T>
                </Card>
                <Card style={{ flex: 1 }} onPress={() => navigation.navigate("RequestsTab")}>
                  <T v="caption">Open requests</T><T v="h3" style={{ marginTop: 4 }}>{d.open_maintenance}</T>
                </Card>
              </Row>

              {d.owner && (
                <Card style={{ marginTop: 12 }}>
                  <Row between>
                    <View style={{ flex: 1 }}>
                      <T v="caption">Your owner</T>
                      <T v="title">{d.owner.name}</T>
                    </View>
                    <Row gap={8}>
                      {d.owner.phone && <IconButton icon="call" bg={colors.successSoft} color={colors.success} onPress={() => callPhone(d.owner.phone)} label="Call owner" />}
                      {d.owner.phone && <IconButton icon="logo-whatsapp" bg={colors.successSoft} color={colors.success} onPress={() => openWhatsApp({ phone: d.owner.phone })} label="WhatsApp owner" />}
                    </Row>
                  </Row>
                </Card>
              )}
            </>
          )}

          {!!d.notices?.length && (
            <>
              <SectionHeader title="Notices" action="All" onAction={() => navigation.navigate("Notices")} />
              {d.notices.map((n: any) => (
                <Card key={n.id} style={{ marginBottom: 10, borderLeftWidth: 4, borderLeftColor: n.priority === "IMPORTANT" ? colors.danger : colors.primary }}>
                  <Row between><T v="title" style={{ flex: 1 }}>{n.title}</T><T v="caption">{timeAgo(n.created_at)}</T></Row>
                  <T v="small" style={{ marginTop: 4 }} numberOfLines={3}>{n.body}</T>
                </Card>
              ))}
            </>
          )}

          {!!d.recent_payments?.length && (
            <>
              <SectionHeader title="Recent payments" action="History" onAction={() => navigation.navigate("PaymentHistory")} />
              <ListCard>{d.recent_payments.slice(0, 3).map((p: any) => <PaymentRow key={p.id} p={p} onPress={() => navigation.navigate("TenantInvoice", { id: p.invoice_id })} />)}</ListCard>
            </>
          )}
          <Banners />
        </>
      )}
    </Screen>
  );
};

const st = StyleSheet.create({
  quick: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  ghostLight: { height: 46, borderRadius: 16, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center" },
  okIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  joinIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  banner: { width: width * 0.78, height: 150, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceAlt },
});

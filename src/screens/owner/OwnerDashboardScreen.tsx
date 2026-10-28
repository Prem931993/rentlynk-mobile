import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Hero, Screen } from "../../components/Screen";
import { Card, FadeIn, IconButton, IconName, Row, SectionHeader, Skeleton, StatTile, T, Tap, Notice } from "../../components/ui";
import { CollectionChart, Ring } from "../../components/Charts";
import { InvoiceRow, ListCard, PaymentRow } from "../../components/Domain";
import { ErrorState } from "../../components/States";
import { colors, fonts, radius, shadow } from "../../theme";
import { useAuth } from "../../stores/authStore";
import { Notifications, Owner } from "../../api/endpoints";
import { useLoad } from "../../utils/useLoad";
import { fmtDate, greeting, money, MONTHS } from "../../utils/format";

const Action = ({ icon, label, onPress, color }: { icon: IconName; label: string; onPress: () => void; color: string }) => (
  <Tap onPress={onPress} style={st.action}>
    <View style={[st.actionIcon, { backgroundColor: color + "18" }]}><Ionicons name={icon} size={22} color={color} /></View>
    <T v="caption" center style={{ color: colors.text, fontFamily: fonts.semibold, marginTop: 8 }} numberOfLines={2}>{label}</T>
  </Tap>
);

const Alert = ({ icon, tone, title, subtitle, onPress }: { icon: IconName; tone: string; title: string; subtitle: string; onPress: () => void }) => (
  <Tap onPress={onPress} style={[st.alert, shadow(1)]}>
    <View style={[st.alertIcon, { backgroundColor: tone + "18" }]}><Ionicons name={icon} size={20} color={tone} /></View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <T v="title">{title}</T>
      <T v="caption">{subtitle}</T>
    </View>
    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
  </Tap>
);

export const OwnerDashboardScreen = ({ navigation }: any) => {
  const user = useAuth((s) => s.user);
  const q = useLoad(() => Owner.dashboard(), []);
  const unread = useLoad(() => Notifications.unread(), []);
  const d = q.data;
  const collectedRatio = d && d.this_month.billed ? d.this_month.paid / d.this_month.billed : 0;
  const now = new Date();

  return (
    <Screen refreshing={q.refreshing} onRefresh={() => { q.refresh(); unread.reload(); }}
      hero={
        <Hero>
          <Row between>
            <View style={{ flex: 1 }}>
              <T v="small" color="rgba(226,232,255,0.75)">{greeting()},</T>
              <T v="h2" color="#fff" numberOfLines={1}>{user?.name?.split(" ")[0]} 👋</T>
            </View>
            <IconButton icon="notifications-outline" bg="rgba(255,255,255,0.14)" color="#fff" badge={unread.data?.unread} onPress={() => navigation.navigate("Notifications")} />
          </Row>
          <Row gap={18} style={{ marginTop: 22 }}>
            {d ? <Ring value={collectedRatio} label={`${Math.round(collectedRatio * 100)}%`} sub="collected" size={96} color="#34D399" /> : <Skeleton width={96} height={96} radius={48} style={{ opacity: 0.2 }} />}
            <View style={{ flex: 1 }}>
              <T v="overline" color="rgba(191,215,245,0.85)">{MONTHS[now.getMonth()]} rent</T>
              <T v="amount" color="#fff" style={{ marginTop: 4 }}>{d ? money(d.this_month.paid) : "—"}</T>
              <T v="small" color="rgba(226,232,255,0.75)">of {d ? money(d.this_month.billed) : "—"} billed</T>
            </View>
          </Row>
        </Hero>
      }>
      {q.error && !d ? <ErrorState message={q.error} onRetry={q.reload} /> : (
        <>
          <FadeIn>
            <Row gap={12} style={{ alignItems: "stretch" }}>
              <StatTile label="Outstanding" value={d ? money(d.outstanding, { compact: true }) : "…"} icon="hourglass-outline" tone="warning" onPress={() => navigation.navigate("Billing", { tab: "invoices" })} />
              <StatTile label="Occupancy" value={d ? `${d.units.occupancy_rate}%` : "…"} icon="home-outline" tone="success" hint={d ? `${d.units.OCCUPIED}/${d.units.total} units` : undefined} onPress={() => navigation.navigate("PropertiesTab")} />
            </Row>
          </FadeIn>

          {d && (d.pending_verifications > 0 || d.overdue.count > 0 || d.open_maintenance > 0 || d.active_move_outs > 0 || d.pending_invites > 0 || d.bills_to_upload?.length > 0 || d.deposit_at_risk?.length > 0) && (
            <FadeIn delay={80}>
              <SectionHeader title="Needs your attention" />
              <View style={{ gap: 10 }}>
                {d.pending_verifications > 0 && <Alert icon="cash-outline" tone={colors.warning} title={`${d.pending_verifications} payment${d.pending_verifications > 1 ? "s" : ""} to verify`} subtitle="Check proof and approve or reject" onPress={() => navigation.navigate("Billing", { tab: "review" })} />}
                {d.overdue.count > 0 && <Alert icon="alert-circle-outline" tone={colors.danger} title={`${d.overdue.count} overdue invoice${d.overdue.count > 1 ? "s" : ""}`} subtitle={`${money(d.overdue.amount)} past due · send a reminder`} onPress={() => navigation.navigate("Billing", { tab: "invoices", status: "OVERDUE" })} />}
                {d.open_maintenance > 0 && <Alert icon="construct-outline" tone={colors.info} title={`${d.open_maintenance} open repair request${d.open_maintenance > 1 ? "s" : ""}`} subtitle="Update status for your tenants" onPress={() => navigation.navigate("Maintenance")} />}
                {d.active_move_outs > 0 && <Alert icon="exit-outline" tone={colors.secondary} title={`${d.active_move_outs} move-out${d.active_move_outs > 1 ? "s" : ""} in progress`} subtitle="Inspect, settle deposit, close lease" onPress={() => navigation.navigate("MoveOuts")} />}
                {d.deposit_at_risk?.map((r: any) => (
                  <Alert key={`dep-${r.lease_id}`} icon="warning-outline" tone={colors.danger} title={`${r.agreement_type === "LEASE" ? "Lease amount" : "Deposit"} nearly used · ${r.tenant_name}`}
                    subtitle={`Dues ${money(r.dues, { compact: true })} + painting ${money(r.painting, { compact: true })} vs advance ${money(r.held, { compact: true })}`}
                    onPress={() => navigation.navigate("LeaseDetail", { id: r.lease_id, tab: "deposit" })} />
                ))}
                {d.bills_to_upload?.map((b: any) => (
                  <Alert key={`bill-${b.lease_id}`} icon="flash-outline" tone={colors.warning} title={`Upload electricity bill · Unit ${b.unit_number}`}
                    subtitle={`${b.tenant_name} · this month is a billing month`}
                    onPress={() => navigation.navigate("AddUtilityBill", { leaseId: b.lease_id, lease: b })} />
                ))}
                {d.pending_invites > 0 && <Alert icon="ticket-outline" tone={colors.primary} title={`${d.pending_invites} invite${d.pending_invites > 1 ? "s" : ""} waiting`} subtitle="Tenants haven't joined yet" onPress={() => navigation.navigate("Invitations")} />}
              </View>
            </FadeIn>
          )}

          <SectionHeader title="Quick actions" />
          <Row between>
            <Action icon="add-circle-outline" label="Add property" color={colors.primary} onPress={() => navigation.navigate("PropertyForm")} />
            <Action icon="person-add-outline" label="Add tenant" color={colors.success} onPress={() => navigation.navigate("CreateLease")} />
            <Action icon="document-text-outline" label="New invoice" color={colors.warning} onPress={() => navigation.navigate("CreateInvoice")} />
            <Action icon="megaphone-outline" label="Send notice" color={colors.secondary} onPress={() => navigation.navigate("Announcements")} />
          </Row>

          {d && d.properties === 0 && (
            <Notice tone="primary" style={{ marginTop: 20 }} title="Let's set up your first property" message="Add a property and its units, then invite tenants. Rent invoices and reminders run automatically." action="Add property" onAction={() => navigation.navigate("PropertyForm")} />
          )}

          <SectionHeader title="Collections · last 6 months" />
          <Card>{d ? <CollectionChart data={d.trend} /> : <Skeleton height={170} />}</Card>

          {!!d?.pending_payments?.length && (
            <>
              <SectionHeader title="Latest payments to review" action="See all" onAction={() => navigation.navigate("Billing", { tab: "review" })} />
              <ListCard>{d.pending_payments.map((p: any) => <PaymentRow key={p.id} p={p} showTenant onPress={() => navigation.navigate("PaymentReview", { id: p.id })} />)}</ListCard>
            </>
          )}

          {!!d?.due_soon?.length && (
            <>
              <SectionHeader title="Due this week" />
              <ListCard>{d.due_soon.map((i: any) => <InvoiceRow key={i.id} inv={i} showTenant onPress={() => navigation.navigate("OwnerInvoice", { id: i.id })} />)}</ListCard>
            </>
          )}

          {!!d?.expiring_leases?.length && (
            <>
              <SectionHeader title="Agreements ending soon" />
              <ListCard>
                {d.expiring_leases.map((l: any) => (
                  <Tap key={l.id} onPress={() => navigation.navigate("LeaseDetail", { id: l.id })} style={st.expRow}>
                    <View style={{ flex: 1 }}>
                      <T v="title">{l.tenant_name}</T>
                      <T v="caption">{l.property_name} · Unit {l.unit_number}</T>
                    </View>
                    <T v="small" color={colors.warning} style={{ fontFamily: fonts.bold }}>Ends {fmtDate(l.end_date, false)}</T>
                  </Tap>
                ))}
              </ListCard>
            </>
          )}
        </>
      )}
    </Screen>
  );
};

const st = StyleSheet.create({
  action: { width: "23%", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 4, borderWidth: 1, borderColor: "#EDF0F6" },
  actionIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  alert: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: "#EDF0F6" },
  alertIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  expRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});

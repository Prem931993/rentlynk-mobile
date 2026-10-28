import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Badge, Card, IconBubble, ProgressBar, Row, T, Tap } from "./ui";
import { colors, fonts, gradients, radius, shadow } from "../theme";
import { fmtDate, money, period, relativeDue, titleCase } from "../utils/format";
import { fileUrl } from "../api/client";
import { Invoice, Payment } from "../api/endpoints";

export const InvoiceRow = ({ inv, onPress, showTenant }: { inv: Invoice; onPress?: () => void; showTenant?: boolean }) => {
  const open = !["PAID", "CANCELLED"].includes(inv.status);
  const icon = inv.type === "DEPOSIT" ? "wallet-outline" : inv.type === "SETTLEMENT" ? "calculator-outline" : inv.type === "OTHER" ? "flash-outline" : "receipt-outline";
  return (
    <Tap onPress={onPress} scale={0.985} style={st.row}>
      <IconBubble icon={icon as any} tone={inv.status === "OVERDUE" ? "danger" : inv.status === "PAID" ? "success" : "primary"} size={42} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <T v="title" numberOfLines={1}>{showTenant ? inv.tenant_name : inv.type === "RENT" ? `${period(inv.month, inv.year)} rent` : titleCase(inv.type) + " invoice"}</T>
        <T v="caption" numberOfLines={1}>
          {showTenant ? `${inv.property_name} · ${inv.unit_number} · ` : ""}{open ? relativeDue(inv.due_date) : inv.status === "PAID" ? `Paid · ${inv.invoice_number}` : inv.invoice_number}
        </T>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <T v="bodyStrong">{money(open ? inv.balance : inv.total)}</T>
        <View style={{ marginTop: 4 }}><Badge status={inv.status} small /></View>
      </View>
    </Tap>
  );
};

export const PaymentRow = ({ p, onPress, showTenant }: { p: Payment; onPress?: () => void; showTenant?: boolean }) => (
  <Tap onPress={onPress} scale={0.985} style={st.row}>
    <IconBubble icon={p.method === "UPI" ? "qr-code-outline" : p.method === "CASH" ? "cash-outline" : p.method === "DEPOSIT_ADJUSTMENT" ? "wallet-outline" : "card-outline"}
      tone={p.status === "VERIFIED" ? "success" : p.status === "REJECTED" ? "danger" : "warning"} size={42} />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <T v="title" numberOfLines={1}>{showTenant ? p.tenant_name : p.invoice_number || "Payment"}</T>
      <T v="caption" numberOfLines={1}>{showTenant ? `Unit ${p.unit_number} · ` : ""}{titleCase(p.method)} · {fmtDate(p.payment_date)}</T>
    </View>
    <View style={{ alignItems: "flex-end" }}>
      <T v="bodyStrong">{money(p.amount)}</T>
      <View style={{ marginTop: 4 }}><Badge status={p.status === "PENDING" ? "PENDING" : p.status} label={p.status === "PENDING" ? "In review" : undefined} small /></View>
    </View>
  </Tap>
);

export const LeaseRow = ({ l, onPress }: { l: any; onPress?: () => void }) => (
  <Tap onPress={onPress} scale={0.985} style={st.row}>
    <Avatar name={l.tenant_name} uri={l.tenant_avatar_url} size={44} />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <T v="title" numberOfLines={1}>{l.tenant_name}</T>
      <T v="caption" numberOfLines={1}>{l.property_name} · Unit {l.unit_number}</T>
    </View>
    <View style={{ alignItems: "flex-end" }}>
      {l.agreement_type === "LEASE"
        ? <T v="bodyStrong">{money(l.security_deposit, { compact: true })}<T v="caption"> lease</T></T>
        : <T v="bodyStrong">{money(l.rent_amount)}<T v="caption">/mo</T></T>}
      <View style={{ marginTop: 4 }}>{l.outstanding > 0 ? <Badge label={`${money(l.outstanding, { compact: true })} due`} tone="danger" small /> : <Badge status={l.status} small />}</View>
    </View>
  </Tap>
);

export const PropertyCard = ({ p, onPress }: { p: any; onPress?: () => void }) => {
  const occ = p.total_units ? p.occupied_units / p.total_units : 0;
  const cover = fileUrl(p.cover_url);
  return (
    <Tap onPress={onPress} style={[st.prop, shadow(1)]}>
      <View style={st.cover}>
        {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : (
          <LinearGradient colors={gradients.brand} style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="business" size={44} color="rgba(255,255,255,0.8)" />
          </LinearGradient>
        )}
        <LinearGradient colors={["transparent", "rgba(11,16,38,0.75)"]} style={StyleSheet.absoluteFill} />
        <View style={st.coverTag}><T v="caption" color="#fff" style={{ fontFamily: fonts.bold }}>{titleCase(p.type)}</T></View>
        {p.status === "INACTIVE" && <View style={[st.coverTag, { left: undefined, right: 12, backgroundColor: "rgba(225,29,72,0.85)" }]}><T v="caption" color="#fff" style={{ fontFamily: fonts.bold }}>Archived</T></View>}
        <View style={{ position: "absolute", left: 16, bottom: 14, right: 16 }}>
          <T v="h3" color="#fff" numberOfLines={1}>{p.name}</T>
          <Row gap={4}><Ionicons name="location" size={12} color="rgba(255,255,255,0.8)" /><T v="caption" color="rgba(255,255,255,0.85)" numberOfLines={1}>{p.city}{p.state ? `, ${p.state}` : ""}</T></Row>
        </View>
      </View>
      <View style={{ padding: 16 }}>
        <Row between style={{ marginBottom: 10 }}>
          <View><T v="caption">Units</T><T v="bodyStrong">{p.occupied_units}/{p.total_units} occupied</T></View>
          <View style={{ alignItems: "flex-end" }}><T v="caption">Monthly rent</T><T v="bodyStrong" color={colors.success}>{money(p.monthly_rent)}</T></View>
        </Row>
        <ProgressBar value={occ} color={occ >= 0.8 ? colors.success : occ >= 0.5 ? colors.warning : colors.danger} height={6} />
      </View>
    </Tap>
  );
};

/** Vertical timeline for maintenance updates and move-out stages. */
export const Timeline = ({ items }: { items: { title: string; subtitle?: string; time?: string; done?: boolean; active?: boolean }[] }) => (
  <View>
    {items.map((it, i) => (
      <Row key={i} gap={12} style={{ alignItems: "flex-start" }}>
        <View style={{ alignItems: "center" }}>
          <View style={[st.tlDot, it.done && { backgroundColor: colors.success, borderColor: colors.success }, it.active && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
            {it.done && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
          {i < items.length - 1 && <View style={[st.tlLine, it.done && { backgroundColor: colors.success }]} />}
        </View>
        <View style={{ flex: 1, paddingBottom: 18 }}>
          <Row between><T v="title" color={it.done || it.active ? colors.text : colors.textMuted}>{it.title}</T>{it.time && <T v="caption">{it.time}</T>}</Row>
          {it.subtitle && <T v="small" style={{ marginTop: 2 }}>{it.subtitle}</T>}
        </View>
      </Row>
    ))}
  </View>
);

export const LineItems = ({ inv }: { inv: Invoice }) => (
  <View>
    {inv.line_items.map((li, i) => (
      <Row key={i} between style={{ paddingVertical: 8 }}>
        <T v="small" style={{ color: colors.text, flex: 1 }}>{li.label}</T>
        <T v="title">{money(li.amount)}</T>
      </Row>
    ))}
    {inv.discount > 0 && <Row between style={{ paddingVertical: 8 }}><T v="small">Discount</T><T v="title" color={colors.success}>−{money(inv.discount)}</T></Row>}
    <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
    <Row between style={{ paddingVertical: 4 }}><T v="title">Total</T><T v="h3">{money(inv.total)}</T></Row>
    {inv.amount_paid > 0 && <Row between style={{ paddingVertical: 4 }}><T v="small">Paid</T><T v="title" color={colors.success}>−{money(inv.amount_paid)}</T></Row>}
    {inv.amount_paid > 0 && <Row between style={{ paddingVertical: 4 }}><T v="title">Balance</T><T v="h3" color={inv.balance > 0 ? colors.danger : colors.success}>{money(inv.balance)}</T></Row>}
  </View>
);

/** Utility bills (e.g. electricity board bill) attached to an invoice, with a link to the bill copy. */
export const BillAttachments = ({ bills, onOpen }: { bills?: any[]; onOpen: (url: string) => void }) => {
  if (!bills?.length) return null;
  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      {bills.map((b) => (
        <Tap key={b.id} onPress={() => b.file_url && onOpen(b.file_url)} style={[st.billRow, !b.file_url && { opacity: 0.85 }]}>
          <IconBubble icon={b.type === "ELECTRICITY" ? "flash" : b.type === "WATER" ? "water" : "flame"} tone="warning" size={38} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <T v="title" numberOfLines={1}>{b.label}</T>
            <T v="caption">{b.previous_reading != null && b.current_reading != null ? `Meter ${b.previous_reading} → ${b.current_reading} · ` : ""}{money(b.amount)}</T>
          </View>
          {b.file_url ? <T v="small" color={colors.primary} style={{ fontFamily: fonts.bold }}>View bill</T> : null}
        </Tap>
      ))}
    </View>
  );
};

export const ListCard =({ children }: { children: React.ReactNode }) => (
  <Card padded={false} style={{ paddingHorizontal: 14 }}>{children}</Card>
);

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  prop: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden", marginBottom: 16 },
  cover: { height: 150, backgroundColor: colors.surfaceAlt },
  coverTag: { position: "absolute", top: 12, left: 12, backgroundColor: "rgba(11,16,38,0.55)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  billRow: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: radius.md, backgroundColor: colors.warningSoft },
  tlDot:{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  tlLine: { width: 2, flex: 1, minHeight: 22, backgroundColor: colors.border, marginVertical: 2 },
});

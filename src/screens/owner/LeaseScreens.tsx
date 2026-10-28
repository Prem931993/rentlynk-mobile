import { callPhone, openLink, openWhatsApp, sendEmail } from "../../utils/links";
import React, { useEffect, useMemo, useState } from "react";
import { Linking, Share, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Header, Screen } from "../../components/Screen";
import {
  Avatar, Badge, Button, Card, ChipGroup, EmptyState, FadeIn, GradientCard, IconButton, KeyValue, ListItem, Notice, Row, SectionHeader, Segmented, T, Tap,
} from "../../components/ui";
import { AmountField, DateField, Field, SearchBar, SelectField, Toggle } from "../../components/Inputs";
import { InvoiceRow, LeaseRow, ListCard, PaymentRow } from "../../components/Domain";
import { Loadable } from "../../components/States";
import { confirm, Sheet, toast } from "../../components/Feedback";
import { colors, fonts, gradients, radius } from "../../theme";
import { Owner } from "../../api/endpoints";
import { errorMessage, fieldErrors, fileUrl } from "../../api/client";
import { useLoad } from "../../utils/useLoad";
import { addDays, fmtDate, fmtDateTime, money, monthYear, MONTHS, period, titleCase, today } from "../../utils/format";
import { appendFile, pickDocument } from "../../utils/files";
import { haptic } from "../../utils/haptics";

// ── Tenants / leases list ──────────────────────────────────────────────────
export const LeasesScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<"LIVE" | "ENDED">("LIVE");
  const [search, setSearch] = useState("");
  const q = useLoad(() => Owner.leases({ status: tab }), [tab]);
  const list = (q.data || []).filter((l: any) => !search || `${l.tenant_name} ${l.unit_number} ${l.property_name}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}
      header={<Header back={false} title="Tenants" right={<IconButton icon="person-add" bg={colors.primary} color="#fff" onPress={() => navigation.navigate("CreateLease")} label="Add tenant" />} />}>
      <Segmented value={tab} onChange={setTab} options={[{ label: "Current", value: "LIVE" }, { label: "Past", value: "ENDED" }]} />
      <View style={{ height: 14 }} />
      <SearchBar value={search} onChange={setSearch} placeholder="Search tenant, unit or property" />
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload}>
        {!list.length ? (
          <EmptyState icon="people-outline" title={tab === "LIVE" ? "No tenants yet" : "No past tenants"}
            message={tab === "LIVE" ? "Add a tenant to a vacant unit on a monthly rental or a lump-sum lease. Existing RentLynk users are linked instantly; new ones get an invite code." : undefined}
            action={tab === "LIVE" ? "Add tenant" : undefined} onAction={() => navigation.navigate("CreateLease")} />
        ) : <ListCard>{list.map((l: any) => <LeaseRow key={l.id} l={l} onPress={() => navigation.navigate("LeaseDetail", { id: l.id })} />)}</ListCard>}
      </Loadable>
      <Button title="Pending invitations" variant="ghost" icon="ticket-outline" onPress={() => navigation.navigate("Invitations")} style={{ marginTop: 18 }} />
    </Screen>
  );
};

// ── Add tenant: rental or lease agreement / invite ─────────────────────────
/** Months from the agreement start month through the current month (only when the start is in the past). */
const monthsBetween = (startISO: string) => {
  if (!startISO || startISO >= today()) return [] as { key: string; month: number; year: number; label: string }[];
  const [y, m] = startISO.split("-").map(Number);
  const now = new Date();
  const out: { key: string; month: number; year: number; label: string }[] = [];
  let year = y, month = m;
  while ((year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth() + 1)) && out.length < 60) {
    out.push({ key: `${year}-${month}`, month, year, label: `${MONTHS[month - 1]} ${year}` });
    if (++month > 12) { month = 1; year++; }
  }
  return out;
};

export const CreateLeaseScreen = ({ navigation, route }: any) => {
  const presetUnit: string | undefined = route.params?.unitId;
  const props = useLoad(() => Owner.properties({ status: "ACTIVE" }), []);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [unitId, setUnitId] = useState<string | null>(presetUnit || null);
  const [unitInfo, setUnitInfo] = useState<any>(null);
  const [f, setF] = useState<any>({
    agreement_type: "RENTAL",
    email: "", name: "", phone: "", start_date: today(), end_date: addDays(today(), 334), rent_amount: "", security_deposit: "", deposit_received: "",
    maintenance_charge: "", rent_due_day: "5", notice_period_days: "30", lock_in_months: "0", late_fee_per_day: "0", grace_period_days: "3",
    electricity_billing: "METERED", water_billing: "FIXED", auto_invoice: true, collect_deposit_in_app: true, agreement_terms: "",
    escalation_type: "PERCENT", escalation_value: "5", escalation_frequency_months: "12", painting_charge: "",
    electricity_cycle_months: "2", electricity_bill_months: "EVEN",
  });
  // Back-dated agreement: how each month from the start date until now was settled.
  const [past, setPast] = useState<Record<string, { status: "PAID" | "UNPAID" | "ADJUST_DEPOSIT"; amount?: string }>>({});
  const pastMonths = useMemo(() => monthsBetween(f.start_date), [f.start_date]);
  const isL = f.agreement_type === "LEASE";
  const monthlyTotal = (isL ? 0 : Number(f.rent_amount) || 0) + (Number(f.maintenance_charge) || 0);
  const amountLabel = isL ? "Lease amount" : "Security deposit";
  /** Switch model; a lease is usually 1–3 years with no monthly rent. */
  const chooseType = (t: "RENTAL" | "LEASE") => {
    setF((s: any) => {
      if (t === s.agreement_type) return s;
      if (t === "LEASE") {
        const d = new Date(s.start_date); d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1);
        return { ...s, agreement_type: t, end_date: d.toISOString().slice(0, 10), escalation_type: "NONE", escalation_value: "0", auto_invoice: true };
      }
      return { ...s, agreement_type: t, escalation_type: "PERCENT", escalation_value: "5" };
    });
    setErrors({});
  };
  const adjustTotal = pastMonths.filter((m) => past[m.key]?.status === "ADJUST_DEPOSIT").length * monthlyTotal;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const set = (k: string) => (v: any) => { setF((s: any) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };

  useEffect(() => {
    if (!propertyId) return;
    Owner.property(propertyId).then((p) => setUnits(p.units.filter((u: any) => u.status === "VACANT"))).catch(() => setUnits([]));
  }, [propertyId]);

  useEffect(() => {
    if (!unitId) return;
    Owner.unit(unitId).then((u) => {
      setUnitInfo(u);
      setF((s: any) => ({ ...s, rent_amount: String(u.rent_amount || ""), security_deposit: String(u.security_deposit || ""), maintenance_charge: String(u.maintenance_charge || "") }));
    }).catch(() => {});
  }, [unitId]);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!unitId) e.unit = "Choose a vacant unit";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter the tenant's email";
    if (!isL && !(Number(f.rent_amount) > 0)) e.rent_amount = "Enter the monthly rent";
    if (isL && !(Number(f.security_deposit) > 0)) e.security_deposit = "Enter the lease amount";
    if (isL && !f.end_date) e.end_date = "A lease needs an end date";
    if (Number(f.deposit_received || 0) > Number(f.security_deposit || 0)) e.deposit_received = `Can't exceed the ${amountLabel.toLowerCase()}`;
    if (f.end_date && f.end_date <= f.start_date) e.end_date = "Must be after the start date";
    setErrors(e);
    if (Object.keys(e).length) return haptic.warning();
    setSaving(true);
    try {
      const res = await Owner.createLease({
        unit_id: unitId, tenant: { email: f.email.trim().toLowerCase(), name: f.name.trim() || null, phone: f.phone.trim() || null },
        terms: {
          agreement_type: f.agreement_type,
          start_date: f.start_date, end_date: f.end_date || null, rent_amount: isL ? 0 : Number(f.rent_amount), security_deposit: Number(f.security_deposit || 0),
          deposit_received: Number(f.deposit_received || 0), maintenance_charge: Number(f.maintenance_charge || 0), rent_due_day: Number(f.rent_due_day),
          notice_period_days: Number(f.notice_period_days), lock_in_months: Number(f.lock_in_months || 0), late_fee_per_day: Number(f.late_fee_per_day || 0),
          grace_period_days: Number(f.grace_period_days || 0), electricity_billing: f.electricity_billing, water_billing: f.water_billing,
          auto_invoice: f.auto_invoice, collect_deposit_in_app: f.collect_deposit_in_app, agreement_terms: f.agreement_terms || null,
          escalation_type: isL ? "NONE" : f.escalation_type, escalation_value: isL ? 0 : Number(f.escalation_value || 0), escalation_frequency_months: Number(f.escalation_frequency_months || 12),
          painting_charge: Number(f.painting_charge || 0),
          electricity_cycle_months: Number(f.electricity_cycle_months || 1), electricity_bill_months: f.electricity_cycle_months === "1" ? "ALL" : f.electricity_bill_months,
          past_months: monthlyTotal <= 0 ? [] : pastMonths.map((m) => {
            const p = past[m.key] || { status: "UNPAID" };
            return { month: m.month, year: m.year, status: p.status, amount_paid: p.status === "PAID" && p.amount ? Number(p.amount) : null };
          }),
        },
      });
      haptic.success();
      if (res.mode === "LINKED") { toast.success(`${isL ? "Lease" : "Rental agreement"} created. Your tenant has been notified.`); navigation.replace("LeaseDetail", { id: res.lease.id }); }
      else setInvite(res);
    } catch (err) { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); } finally { setSaving(false); }
  };

  if (invite) return <InviteResult invite={invite} onDone={() => navigation.goBack()} />;

  return (
    <Screen header={<Header title="Add tenant" />} footer={<Button title={isL ? "Create lease" : "Create rental agreement"} icon="checkmark-circle-outline" onPress={submit} loading={saving} />}>
      <T v="overline" style={{ marginBottom: 10 }}>1 · Unit</T>
      {presetUnit && unitInfo ? (
        <Card style={{ marginBottom: 18 }}><T v="title">{unitInfo.property_name} · Unit {unitInfo.unit_number}</T><T v="caption">{money(unitInfo.rent_amount)} / month</T></Card>
      ) : (
        <>
          <SelectField label="Property" icon="business-outline" value={propertyId} onChange={(v) => { setPropertyId(v); setUnitId(null); }}
            options={(props.data || []).map((p: any) => ({ label: p.name, value: p.id, subtitle: `${p.total_units - p.occupied_units} not occupied` }))} />
          {propertyId && (
            <SelectField label="Vacant unit" icon="grid-outline" value={unitId} onChange={setUnitId} error={errors.unit}
              placeholder={units.length ? "Select unit" : "No vacant units in this property"}
              options={units.map((u: any) => ({ label: `Unit ${u.unit_number}`, value: u.id, subtitle: `${money(u.rent_amount)} · ${u.unit_type || ""}` }))} />
          )}
        </>
      )}

      <T v="overline" style={{ marginBottom: 10 }}>2 · Tenant</T>
      <Field label="Tenant email" icon="mail-outline" value={f.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" error={errors.email}
        hint="If they already use RentLynk they're linked instantly. Otherwise we create a secure invite code." />
      <Row gap={12}>
        <View style={{ flex: 1 }}><Field label="Name" value={f.name} onChangeText={set("name")} /></View>
        <View style={{ flex: 1 }}><Field label="Phone" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" /></View>
      </Row>

      <T v="overline" style={{ marginBottom: 10 }}>3 · Agreement type</T>
      <Row gap={12} style={{ marginBottom: 12, alignItems: "stretch" }}>
        <TypeCard selected={!isL} icon="calendar-outline" title="Monthly rental" text="Monthly rent + refundable advance" onPress={() => chooseType("RENTAL")} />
        <TypeCard selected={isL} icon="key-outline" title="Lease" text="One lump sum, no monthly rent" onPress={() => chooseType("LEASE")} />
      </Row>
      <Notice tone="info" icon={isL ? "key-outline" : "calendar-outline"} style={{ marginBottom: 18 }}
        message={isL
          ? "The tenant pays one lease amount up front and stays for the agreed period without monthly rent. At the end it's refunded after deducting painting, damages and any unpaid bills."
          : "The tenant pays rent every month. The advance is refunded at move-out after deducting painting, damages and unpaid rent."} />

      <T v="overline" style={{ marginBottom: 10 }}>4 · {isL ? "Lease terms" : "Rental terms"}</T>
      <Row gap={12}>
        <View style={{ flex: 1 }}><DateField label="Start date" value={f.start_date} onChange={set("start_date")} /></View>
        <View style={{ flex: 1 }}><DateField label="End date" value={f.end_date} onChange={set("end_date")} min={f.start_date} error={errors.end_date} /></View>
      </Row>
      <Row gap={8} style={{ marginTop: -6, marginBottom: 16 }}>
        {(isL ? [[12, "1 year"], [24, "2 years"], [36, "3 years"]] : [[11, "11 months"], [12, "1 year"], [24, "2 years"]]).map(([m, l]) => (
          <Tap key={l as string} onPress={() => { const d = new Date(f.start_date); d.setMonth(d.getMonth() + (m as number)); d.setDate(d.getDate() - 1); set("end_date")(d.toISOString().slice(0, 10)); }} style={st.quick}>
            <T v="caption" color={colors.primary} style={{ fontFamily: fonts.bold }}>{l}</T>
          </Tap>
        ))}
      </Row>
      {!isL && <AmountField label="Monthly rent" value={f.rent_amount} onChange={set("rent_amount")} error={errors.rent_amount} />}
      <Row gap={12}>
        <View style={{ flex: 1 }}><AmountField label={amountLabel} value={f.security_deposit} onChange={set("security_deposit")} error={errors.security_deposit} /></View>
        <View style={{ flex: 1 }}><AmountField label="Already received" value={f.deposit_received} onChange={set("deposit_received")} error={errors.deposit_received} /></View>
      </Row>
      <AmountField label={isL ? "Monthly maintenance (optional)" : "Monthly maintenance"} value={f.maintenance_charge} onChange={set("maintenance_charge")}
        hint={isL ? "Leave empty if the tenant pays nothing monthly. If set, a maintenance invoice is raised every month." : undefined} />
      {monthlyTotal > 0 && (
        <>
          <T v="small" style={{ marginBottom: 8, color: colors.text, fontFamily: fonts.semibold }}>{isL ? "Maintenance due day" : "Rent due day"}</T>
          <View style={{ marginBottom: 16 }}><ChipGroup value={f.rent_due_day} onChange={set("rent_due_day")} options={["1", "5", "7", "10", "15"].map((d) => ({ label: `${d}${d === "1" ? "st" : "th"}`, value: d }))} /></View>
        </>
      )}
      <T v="small" style={{ marginBottom: 8, color: colors.text, fontFamily: fonts.semibold }}>Notice period</T>
      <View style={{ marginBottom: 16 }}><ChipGroup value={f.notice_period_days} onChange={set("notice_period_days")} options={["15", "30", "60", "90"].map((d) => ({ label: `${d} days`, value: d }))} /></View>
      <Row gap={12}>
        <View style={{ flex: 1 }}><Field label="Lock-in (months)" keyboardType="number-pad" value={f.lock_in_months} onChangeText={set("lock_in_months")} /></View>
        {monthlyTotal > 0 ? <View style={{ flex: 1 }}><Field label="Grace days" keyboardType="number-pad" value={f.grace_period_days} onChangeText={set("grace_period_days")} /></View> : <View style={{ flex: 1 }} />}
      </Row>
      {monthlyTotal > 0 && <AmountField label="Late fee per day (optional)" value={f.late_fee_per_day} onChange={set("late_fee_per_day")} />}
      <T v="small" style={{ marginBottom: 8, color: colors.text, fontFamily: fonts.semibold }}>Electricity</T>
      <View style={{ marginBottom: 12 }}><ChipGroup value={f.electricity_billing} onChange={set("electricity_billing")} options={[{ label: "By meter", value: "METERED" }, { label: "Fixed", value: "FIXED" }, { label: "Included", value: "INCLUDED" }]} /></View>
      {f.electricity_billing === "METERED" && (
        <Card style={{ marginBottom: 16 }}>
          <T v="title">Electricity bill cycle</T>
          <T v="caption" style={{ marginBottom: 10 }}>{monthlyTotal > 0 ? "You upload the board's bill and its amount is added to that month's invoice." : "You upload the board's bill and the tenant gets a separate bill to pay."}</T>
          <View style={{ marginBottom: 10 }}><ChipGroup value={f.electricity_cycle_months} onChange={set("electricity_cycle_months")} options={[{ label: "Every month", value: "1" }, { label: "Every 2 months", value: "2" }]} /></View>
          {f.electricity_cycle_months === "2" && (
            <ChipGroup value={f.electricity_bill_months} onChange={set("electricity_bill_months")} options={[{ label: "Even months (Feb, Apr…)", value: "EVEN" }, { label: "Odd months (Jan, Mar…)", value: "ODD" }]} />
          )}
        </Card>
      )}

      {!isL && (<>
      <T v="overline" style={{ marginBottom: 10, marginTop: 4 }}>Yearly rent increase</T>
      <View style={{ marginBottom: 12 }}>
        <ChipGroup value={f.escalation_type === "PERCENT" && ["5", "10"].includes(f.escalation_value) ? `P${f.escalation_value}` : f.escalation_type === "NONE" ? "NONE" : f.escalation_type === "FIXED" ? "FIXED" : "CUSTOM"}
          onChange={(v) => {
            if (v === "NONE") setF((s: any) => ({ ...s, escalation_type: "NONE", escalation_value: "0" }));
            else if (v === "P5" || v === "P10") setF((s: any) => ({ ...s, escalation_type: "PERCENT", escalation_value: v.slice(1) }));
            else if (v === "CUSTOM") setF((s: any) => ({ ...s, escalation_type: "PERCENT", escalation_value: "" }));
            else setF((s: any) => ({ ...s, escalation_type: "FIXED", escalation_value: "" }));
          }}
          options={[{ label: "None", value: "NONE" }, { label: "5%", value: "P5" }, { label: "10%", value: "P10" }, { label: "Custom %", value: "CUSTOM" }, { label: "Fixed ₹", value: "FIXED" }]} />
      </View>
      {f.escalation_type !== "NONE" && (
        <Row gap={12}>
          <View style={{ flex: 1 }}>
            {f.escalation_type === "FIXED"
              ? <AmountField label="Increase by" value={f.escalation_value} onChange={set("escalation_value")} />
              : <Field label="Increase %" keyboardType="decimal-pad" value={f.escalation_value} onChangeText={set("escalation_value")} />}
          </View>
          <View style={{ flex: 1 }}><Field label="Every (months)" keyboardType="number-pad" value={f.escalation_frequency_months} onChangeText={set("escalation_frequency_months")} /></View>
        </Row>
      )}
      {f.escalation_type !== "NONE" && Number(f.rent_amount) > 0 && Number(f.escalation_value) > 0 && (
        <Notice tone="info" icon="trending-up" style={{ marginBottom: 16, marginTop: -4 }}
          message={`Rent becomes ${money(f.escalation_type === "FIXED" ? Number(f.rent_amount) + Number(f.escalation_value) : Math.round(Number(f.rent_amount) * (1 + Number(f.escalation_value) / 100)))} after ${f.escalation_frequency_months || 12} months. Your tenant is told 30 days before.`} />
      )}
      </>)}

      <T v="overline" style={{ marginBottom: 10, marginTop: 4 }}>Move-out estimate</T>
      <AmountField label="Painting / move-out charges (estimate)" value={f.painting_charge} onChange={set("painting_charge")}
        hint={isL ? "Deducted from the lease amount at the end. Used to show the tenant their expected refund." : "Used to warn your tenant early if unpaid dues plus painting will use up the advance."} />
      {isL && Number(f.security_deposit) > 0 && (
        <Notice tone="success" icon="return-down-back-outline" style={{ marginBottom: 16, marginTop: -4 }}
          message={`Expected refund at the end: ${money(Math.max(0, Number(f.security_deposit) - (Number(f.painting_charge) || 0)))} (lease amount − painting estimate). Unpaid bills are also deducted.`} />
      )}

      {pastMonths.length > 0 && monthlyTotal > 0 && (
        <>
          <T v="overline" style={{ marginBottom: 6, marginTop: 8 }}>Past months ({pastMonths.length})</T>
          <T v="caption" style={{ marginBottom: 12 }}>{isL ? "The lease started earlier, so we'll create a maintenance invoice for each month." : "The agreement started earlier, so we'll create a rent invoice for each month."} Tell us what was already paid — anything not marked stays as overdue.</T>
          {pastMonths.map((m) => {
            const p = past[m.key] || { status: "UNPAID" as const };
            const setP = (patch: any) => setPast((s) => ({ ...s, [m.key]: { ...p, ...patch } }));
            return (
              <Card key={m.key} style={{ marginBottom: 10 }}>
                <Row between style={{ marginBottom: 10 }}>
                  <T v="title">{m.label}</T>
                  <T v="small">{money(monthlyTotal)}</T>
                </Row>
                <Segmented value={p.status} onChange={(v) => setP({ status: v })}
                  options={[{ label: "Paid", value: "PAID" }, { label: "Unpaid", value: "UNPAID" }, { label: isL ? "From lease amt" : "From advance", value: "ADJUST_DEPOSIT" }]} />
                {p.status === "PAID" && (
                  <View style={{ marginTop: 12 }}>
                    <AmountField label="Amount paid (leave blank if full)" value={p.amount || ""} onChange={(v) => setP({ amount: v })} placeholder={String(monthlyTotal || "")} />
                  </View>
                )}
              </Card>
            );
          })}
          <Row gap={8} style={{ marginBottom: 12 }}>
            <Tap onPress={() => setPast(Object.fromEntries(pastMonths.map((m) => [m.key, { status: "PAID" }])))} style={st.quick}><T v="caption" color={colors.primary} style={{ fontFamily: fonts.bold }}>All paid</T></Tap>
            <Tap onPress={() => setPast({})} style={st.quick}><T v="caption" color={colors.primary} style={{ fontFamily: fonts.bold }}>All unpaid</T></Tap>
          </Row>
          {adjustTotal > 0 && (
            <Notice tone={adjustTotal > Number(f.deposit_received || 0) ? "danger" : "warning"} style={{ marginBottom: 16 }}
              message={adjustTotal > Number(f.deposit_received || 0)
                ? `Adjusting ${money(adjustTotal)} needs more than the ${money(Number(f.deposit_received || 0))} ${isL ? "lease amount" : "advance"} received — only what's available will be used.`
                : `${money(adjustTotal)} will be deducted from the ${isL ? "lease amount" : "advance"} (${money(Number(f.deposit_received || 0))} received).`} />
          )}
        </>
      )}
      <Card style={{ marginBottom: 16 }}>
        {monthlyTotal > 0 && (
          <>
            <Row between><View style={{ flex: 1 }}><T v="title">Auto-generate monthly invoices</T><T v="caption">Created 7 days before the due date, with reminders</T></View><Toggle value={f.auto_invoice} onChange={set("auto_invoice")} /></Row>
            <View style={{ height: 14 }} />
          </>
        )}
        <Row between><View style={{ flex: 1 }}><T v="title">{isL ? "Collect pending lease amount in app" : "Collect pending deposit in app"}</T><T v="caption">Raises an invoice for the balance not yet received</T></View><Toggle value={f.collect_deposit_in_app} onChange={set("collect_deposit_in_app")} /></Row>
      </Card>
      <Field label="Agreement terms (optional)" multiline value={f.agreement_terms} onChangeText={set("agreement_terms")} placeholder={isL ? "Lease period, painting, repairs, renewal…" : "Painting charges, pets, parking, escalation…"} hint="Shown to the tenant in the app." />
    </Screen>
  );
};

const TypeCard = ({ selected, icon, title, text, onPress }: { selected: boolean; icon: any; title: string; text: string; onPress: () => void }) => (
  <Tap onPress={onPress} scale={0.97} style={[st.typeCard, selected && st.typeCardOn]}>
    <Row between>
      <View style={[st.typeIcon, selected && { backgroundColor: colors.primary }]}><Ionicons name={icon} size={18} color={selected ? "#fff" : colors.primary} /></View>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? colors.primary : colors.textMuted} />
    </Row>
    <T v="title" style={{ marginTop: 10 }}>{title}</T>
    <T v="caption" style={{ marginTop: 2 }}>{text}</T>
  </Tap>
);

const InviteResult = ({ invite, onDone }: { invite: any; onDone: () => void }) => {
  const copy = async () => { await Clipboard.setStringAsync(invite.code); haptic.success(); toast.success("Code copied"); };
  return (
    <Screen header={<Header title="Invite created" back={false} />} footer={<Button title="Done" onPress={onDone} />}>
      <FadeIn>
        <GradientCard colorsList={gradients.brand}>
          <T v="overline" color="#BFD7F5">Invite code</T>
          <T style={{ fontFamily: fonts.extrabold, fontSize: 36, lineHeight: 46, color: "#fff", letterSpacing: 3, marginTop: 8 }} numberOfLines={1} adjustsFontSizeToFit selectable>{invite.code}</T>
          <T v="small" color="rgba(255,255,255,0.8)" style={{ marginTop: 8 }}>For {invite.invite.tenant_email} · expires {fmtDate(invite.invite.expires_at)}</T>
          <Row gap={10} style={{ marginTop: 18 }}>
            <View style={{ flex: 1 }}><Button title="Copy" variant="light" icon="copy-outline" size="md" onPress={copy} /></View>
            <View style={{ flex: 1 }}><Button title="Share" variant="light" icon="share-social-outline" size="md" onPress={() => Share.share({ message: invite.share_message })} /></View>
          </Row>
        </GradientCard>
      </FadeIn>
      <Notice tone="info" icon="shield-checkmark" style={{ marginTop: 18 }} title="How it works"
        message="Your tenant downloads RentLynk, signs up as a tenant with this exact email, accepts the terms and enters the code. The agreement is created automatically and you'll be notified. For security, the code only works with that email and is shown only now — you can generate a new one anytime." />
      <Button title="Send via WhatsApp" variant="secondary" icon="logo-whatsapp" style={{ marginTop: 16 }}
        onPress={() => openWhatsApp({ phone: invite.invite.tenant_phone, text: invite.share_message })} />
    </Screen>
  );
};

// ── Agreement detail hub (rental or lease) ─────────────────────────────────
export const LeaseDetailScreen = ({ navigation, route }: any) => {
  const { id } = route.params;
  const q = useLoad(() => Owner.lease(id), [id]);
  const l = q.data;
  const [tab, setTab] = useState<"overview" | "billing" | "bills" | "deposit" | "docs">(route.params?.tab || "overview");
  const [depositOpen, setDepositOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const live = l && ["ACTIVE", "NOTICE", "UPCOMING"].includes(l.status);
  const isL = l?.agreement_type === "LEASE";
  const held = isL ? "Lease amount" : "Deposit";
  const monthly = l ? (isL ? 0 : Number(l.rent_amount)) + Number(l.maintenance_charge || 0) : 0;

  const uploadDoc = async () => {
    try {
      const file = await pickDocument();
      if (!file) return;
      const form = new FormData();
      await appendFile(form, "file", file);
      form.append("title", file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Document");
      form.append("category", file.name.toLowerCase().includes("agree") ? "LEASE_AGREEMENT" : "OTHER");
      await Owner.uploadDocument(id, form);
      toast.success("Document uploaded"); q.reload();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const deleteDoc = async (docId: string) => {
    if (!(await confirm({ title: "Delete document?", confirm: "Delete", danger: true }))) return;
    try { await Owner.deleteDocument(docId); q.reload(); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <Screen header={<Header title={l?.tenant_name || "Agreement"} subtitle={l ? `${l.property_name} · Unit ${l.unit_number}` : undefined} />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload} skeleton="detail">
        {l && (
          <>
            <GradientCard>
              <Row between>
                <Row gap={12} style={{ flex: 1 }}>
                  <Avatar name={l.tenant_name} uri={l.tenant_avatar_url} size={52} />
                  <View style={{ flex: 1 }}>
                    <T v="h3" color="#fff" numberOfLines={1}>{l.tenant_name}</T>
                    <T v="caption" color="rgba(226,232,255,0.8)">{isL ? "Lease" : "Monthly rental"} · {l.lease_number}</T>
                  </View>
                </Row>
                <Badge status={l.status} />
              </Row>
              <Row gap={10} style={{ marginTop: 18 }}>
                {isL ? (
                  <View style={st.heroStat}><T v="caption" color="rgba(226,232,255,0.75)">Lease</T><T v="h3" color="#fff">{money(l.deposit.held, { compact: true })}</T></View>
                ) : (
                  <View style={st.heroStat}><T v="caption" color="rgba(226,232,255,0.75)">Rent</T><T v="h3" color="#fff">{money(l.rent_amount)}</T></View>
                )}
                <View style={st.heroStat}><T v="caption" color="rgba(226,232,255,0.75)">Due</T><T v="h3" color={l.outstanding > 0 ? "#FDA4AF" : "#6EE7B7"}>{money(l.outstanding)}</T></View>
                {isL ? (
                  <View style={st.heroStat}><T v="caption" color="rgba(226,232,255,0.75)">Ends</T><T v="h3" color="#fff" numberOfLines={1}>{monthYear(l.end_date)}</T></View>
                ) : (
                  <View style={st.heroStat}><T v="caption" color="rgba(226,232,255,0.75)">Deposit</T><T v="h3" color="#fff">{money(l.deposit.held, { compact: true })}</T></View>
                )}
              </Row>
              <Row gap={10} style={{ marginTop: 16 }}>
                {l.tenant_phone && <IconButton icon="call" bg="rgba(255,255,255,0.16)" color="#fff" onPress={() => callPhone(l.tenant_phone)} label="Call tenant" />}
                {l.tenant_phone && <IconButton icon="logo-whatsapp" bg="rgba(255,255,255,0.16)" color="#fff" onPress={() => openWhatsApp({ phone: l.tenant_phone })} label="WhatsApp" />}
                <IconButton icon="mail" bg="rgba(255,255,255,0.16)" color="#fff" onPress={() => sendEmail(l.tenant_email)} label="Email" />
              </Row>
            </GradientCard>

            {l.move_out && l.move_out.status !== "COMPLETED" && (
              <Notice tone="warning" style={{ marginTop: 14 }} title="Move-out in progress" message={`Planned for ${fmtDate(l.move_out.planned_move_out_date)} · ${titleCase(l.move_out.status)}`}
                action="Open move-out" onAction={() => navigation.navigate("MoveOutDetail", { id: l.move_out.id })} />
            )}
            {!l.tenant_acknowledged_at && live && <Notice tone="info" style={{ marginTop: 14 }} message="Tenant hasn't acknowledged the agreement terms yet." />}

            {live && (
              <Row gap={10} style={{ marginTop: 16 }}>
                <View style={{ flex: 1 }}><Button title="Invoice" icon="add" size="sm" variant="secondary" onPress={() => navigation.navigate("CreateInvoice", { leaseId: l.id })} /></View>
                <View style={{ flex: 1 }}><Button title={isL ? "Amount" : "Deposit"} icon="wallet-outline" size="sm" variant="secondary" onPress={() => setDepositOpen(true)} /></View>
                <View style={{ flex: 1 }}><Button title="Terms" icon="create-outline" size="sm" variant="secondary" onPress={() => setEditOpen(true)} /></View>
              </Row>
            )}

            <View style={{ marginTop: 18 }}>
              <Segmented value={tab} onChange={setTab} options={[{ label: "Overview", value: "overview" }, { label: "Invoices", value: "billing" }, { label: "Bills", value: "bills" }, { label: isL ? "Amount" : "Deposit", value: "deposit" }, { label: "Docs", value: "docs" }]} />
            </View>

            {tab === "overview" && (
              <>
                <Card style={{ marginTop: 14 }}>
                  <KeyValue icon="document-text-outline" label="Agreement" value={isL ? "Lease (lump sum)" : "Monthly rental"} />
                  <KeyValue icon="calendar-outline" label="Period" value={`${fmtDate(l.start_date)} → ${l.end_date ? fmtDate(l.end_date) : "Open-ended"}`} />
                  {isL && <KeyValue icon="wallet-outline" label="Lease amount" value={money(l.security_deposit)} />}
                  {monthly > 0 && <KeyValue icon="alarm-outline" label={isL ? "Maintenance due" : "Rent due"} value={`${l.rent_due_day} of every month`} />}
                  <KeyValue icon="build-outline" label="Maintenance" value={l.maintenance_charge > 0 ? `${money(l.maintenance_charge)}/month` : "None"} />
                  {monthly > 0 && <KeyValue icon="time-outline" label="Grace period" value={`${l.grace_period_days} days`} />}
                  <KeyValue icon="exit-outline" label="Notice period" value={`${l.notice_period_days} days`} />
                  <KeyValue icon="lock-closed-outline" label="Lock-in" value={l.lock_in_months ? `${l.lock_in_months} months` : "None"} />
                  {monthly > 0 && <KeyValue icon="trending-up-outline" label="Late fee" value={l.late_fee_per_day ? `${money(l.late_fee_per_day)}/day` : "None"} />}
                  <KeyValue icon="flash-outline" label="Electricity" value={l.electricity_billing === "METERED" ? `By meter · ${l.electricity_cycle_months > 1 ? `every ${l.electricity_cycle_months} months (${l.electricity_bill_months === "ODD" ? "odd" : "even"})` : "monthly"}` : titleCase(l.electricity_billing)} />
                  {!isL && <KeyValue icon="trending-up-outline" label="Yearly increase" value={l.escalation_type === "PERCENT" ? `${l.escalation_value}% every ${l.escalation_frequency_months} mo` : l.escalation_type === "FIXED" ? `${money(l.escalation_value)} every ${l.escalation_frequency_months} mo` : "None"} />}
                  {l.upcoming_rent && <KeyValue icon="calendar-number-outline" label="Next rent" value={`${money(l.upcoming_rent.amount)} from ${fmtDate(l.upcoming_rent.effective_date)}`} valueColor={colors.primary} />}
                  <KeyValue icon="color-palette-outline" label="Painting estimate" value={l.painting_charge ? money(l.painting_charge) : "Not set"} />
                  {monthly > 0 && <KeyValue icon="sync-outline" label="Auto invoices" value={l.auto_invoice ? "On" : "Off"} />}
                </Card>
                {!!l.rent_revisions?.length && (
                  <>
                    <SectionHeader title="Rent history" />
                    <ListCard>
                      {l.rent_revisions.map((r: any) => (
                        <ListItem key={r.id} icon="trending-up-outline" iconTone="primary" title={`${money(r.old_rent)} → ${money(r.new_rent)}`} subtitle={`From ${fmtDate(r.effective_date)}${r.reason ? ` · ${r.reason}` : ""}`} chevron={false} />
                      ))}
                    </ListCard>
                  </>
                )}
                {l.agreement_terms && (<><SectionHeader title="Agreement terms" /><Card><T v="body">{l.agreement_terms}</T></Card></>)}
                <Card style={{ marginTop: 14 }}>
                  <KeyValue icon="mail-outline" label="Email" value={l.tenant_email} />
                  <KeyValue icon="call-outline" label="Phone" value={l.tenant_phone || "—"} />
                  <KeyValue icon="construct-outline" label="Open repairs" value={String(l.open_maintenance)} />
                </Card>
                {l.status === "ACTIVE" && !l.move_out && (
                  <Button title={isL ? "End lease / start move-out" : "End rental / start move-out"} variant="ghost" icon="exit-outline" onPress={() => setMoveOpen(true)} style={{ marginTop: 18 }} />
                )}
              </>
            )}

            {tab === "billing" && (
              <>
                <SectionHeader title="Invoices" action="+ New" onAction={() => navigation.navigate("CreateInvoice", { leaseId: l.id })} />
                {l.invoices.length ? <ListCard>{l.invoices.map((i: any) => <InvoiceRow key={i.id} inv={i} onPress={() => navigation.navigate("OwnerInvoice", { id: i.id })} />)}</ListCard>
                  : <EmptyState icon="receipt-outline" title="No invoices yet" />}
                {!!l.payments.length && (<><SectionHeader title="Payments" /><ListCard>{l.payments.map((p: any) => <PaymentRow key={p.id} p={p} onPress={() => navigation.navigate("PaymentReview", { id: p.id })} />)}</ListCard></>)}
              </>
            )}

            {tab === "bills" && (
              <>
                <SectionHeader title="Electricity & utility bills" action={live ? "+ Add bill" : undefined} onAction={() => navigation.navigate("AddUtilityBill", { leaseId: l.id, lease: l })} />
                {l.utility_bills?.length ? (
                  <ListCard>
                    {l.utility_bills.map((b: any) => (
                      <ListItem key={b.id} icon={b.type === "ELECTRICITY" ? "flash-outline" : b.type === "WATER" ? "water-outline" : "flame-outline"} iconTone={b.status === "BILLED" ? "success" : "warning"}
                        title={`${period(b.bill_month, b.bill_year)} · ${money(b.amount)}`}
                        subtitle={`${b.label}${b.status === "PENDING" ? " · will be added to that month's invoice" : " · on invoice"}`}
                        onPress={() => b.file_url && openLink(fileUrl(b.file_url)!)}
                        right={b.status === "PENDING" ? <IconButton icon="trash-outline" size={34} color={colors.danger} bg={colors.dangerSoft} onPress={async () => {
                          if (!(await confirm({ title: "Remove this bill?", confirm: "Remove", danger: true }))) return;
                          try { await Owner.deleteUtilityBill(b.id); q.reload(); } catch (e) { toast.error(errorMessage(e)); }
                        }} /> : <Badge label="Billed" tone="success" small />} />
                    ))}
                  </ListCard>
                ) : (
                  <EmptyState icon="flash-outline" title="No bills yet" message={l.electricity_billing === "METERED"
                    ? `Upload the electricity board's bill ${l.electricity_cycle_months > 1 ? `every ${l.electricity_cycle_months} months` : "each month"} — ${monthly > 0 ? "its amount is added to that month's invoice." : "the tenant gets it as a separate bill to pay."}`
                    : monthly > 0 ? "Add water, gas or other utility bills to include them in the monthly invoice." : "Add water, gas or other utility bills for the tenant to pay."} action={live ? "Add bill" : undefined}
                    onAction={() => navigation.navigate("AddUtilityBill", { leaseId: l.id, lease: l })} />
                )}
              </>
            )}

            {tab === "deposit" && (
              <>
                {l.deposit_health && (
                  <Card style={{ marginTop: 14, borderColor: l.deposit_health.at_risk ? colors.danger : "#EDF0F6" }}>
                    <Row between>
                      <T v="title">{isL ? "Expected refund" : "Deposit health"}</T>
                      {l.deposit_health.at_risk ? <Badge label="At risk" tone="danger" /> : <Badge label="Healthy" tone="success" />}
                    </Row>
                    <KeyValue label="Held" value={money(l.deposit_health.held)} />
                    <KeyValue label="Unpaid dues" value={`− ${money(l.deposit_health.dues)}`} valueColor={l.deposit_health.dues ? colors.danger : undefined} />
                    <KeyValue label="Painting estimate" value={`− ${money(l.deposit_health.painting)}`} />
                    <KeyValue label={isL ? "Refund if they leave today" : "Remaining cover"} strong value={`${money(l.deposit_health.cover)}${!isL && l.deposit_health.months_of_cover != null ? ` ≈ ${Math.max(0, l.deposit_health.months_of_cover).toFixed(1)} months` : ""}`}
                      valueColor={l.deposit_health.cover <= 0 ? colors.danger : colors.success} />
                    {l.deposit_health.at_risk && <Notice tone="danger" style={{ marginTop: 10 }} message={`The ${isL ? "lease amount" : "advance"} is almost used up. Your tenant is sent a move-out reminder by email, SMS and WhatsApp. Consider starting a move-out if dues aren't cleared.`} />}
                  </Card>
                )}
                <Card style={{ marginTop: 14 }}>
                  <Row between>
                    <View><T v="caption">Held now</T><T v="h2" color={colors.success}>{money(l.deposit.held)}</T></View>
                    <View style={{ alignItems: "flex-end" }}><T v="caption">Agreed</T><T v="h3">{money(l.deposit.agreed)}</T></View>
                  </Row>
                  {l.deposit.pending > 0 && <Notice tone="warning" style={{ marginTop: 12 }} message={`${money(l.deposit.pending)} of the ${isL ? "lease amount" : "deposit"} is still to be collected.`} />}
                </Card>
                <SectionHeader title="Ledger" action={live ? "+ Entry" : undefined} onAction={() => setDepositOpen(true)} />
                {l.deposit.ledger.length ? (
                  <ListCard>
                    {l.deposit.ledger.map((d: any) => (
                      <ListItem key={d.id} icon={d.type === "RECEIVED" ? "arrow-down-circle-outline" : d.type === "REFUND" ? "arrow-up-circle-outline" : "remove-circle-outline"}
                        iconTone={d.type === "RECEIVED" ? "success" : d.type === "REFUND" ? "info" : "danger"}
                        title={d.description || titleCase(d.type)} subtitle={`${titleCase(d.type)}${d.category ? ` · ${titleCase(d.category)}` : ""} · ${fmtDate(d.transaction_date)}`}
                        right={<T v="bodyStrong" color={d.type === "RECEIVED" ? colors.success : colors.danger}>{d.type === "RECEIVED" ? "+" : "−"}{money(d.amount)}</T>} />
                    ))}
                  </ListCard>
                ) : <EmptyState icon="wallet-outline" title="No entries yet" message={`Record the ${isL ? "lease amount" : "advance"} you received from the tenant.`} />}
              </>
            )}

            {tab === "docs" && (
              <>
                <SectionHeader title="Documents" action={live ? "+ Upload" : undefined} onAction={uploadDoc} />
                {l.documents.length ? (
                  <ListCard>
                    {l.documents.map((d: any) => (
                      <ListItem key={d.id} icon={d.mime_type === "application/pdf" ? "document-outline" : "image-outline"} title={d.title}
                        subtitle={`${titleCase(d.category)} · ${fmtDate(d.created_at)}`} onPress={() => d.url && openLink(fileUrl(d.url)!)}
                        right={<IconButton icon="trash-outline" size={34} color={colors.danger} bg={colors.dangerSoft} onPress={() => deleteDoc(d.id)} />} />
                    ))}
                  </ListCard>
                ) : <EmptyState icon="folder-open-outline" title="No documents" message={`Upload the ${isL ? "lease" : "rental"} agreement, ID proofs or inspection photos (PDF or image, up to 10 MB).`} action={live ? "Upload document" : undefined} onAction={uploadDoc} />}
              </>
            )}
            <DepositSheet visible={depositOpen} onClose={() => setDepositOpen(false)} lease={l} onSaved={q.reload} />
            <EditTermsSheet visible={editOpen} onClose={() => setEditOpen(false)} lease={l} onSaved={q.reload} />
            <StartMoveOutSheet visible={moveOpen} onClose={() => setMoveOpen(false)} lease={l} onSaved={(mo: any) => { q.reload(); navigation.navigate("MoveOutDetail", { id: mo.id }); }} />
          </>
        )}
      </Loadable>
    </Screen>
  );
};

const DepositSheet = ({ visible, onClose, lease, onSaved }: any) => {
  const [type, setType] = useState<"RECEIVED" | "REFUND" | "DEDUCTION">("RECEIVED");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [desc, setDesc] = useState("");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!(Number(amount) > 0)) return toast.error("Enter an amount");
    setSaving(true);
    try {
      await Owner.deposit(lease.id, { type, amount: Number(amount), transaction_date: date, description: desc || null, reference: ref || null });
      toast.success("Ledger updated"); setAmount(""); setDesc(""); setRef(""); onClose(); onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={lease?.agreement_type === "LEASE" ? "Lease amount entry" : "Deposit entry"} footer={<Button title="Save entry" onPress={save} loading={saving} />}>
      <Segmented value={type} onChange={setType} options={[{ label: "Received", value: "RECEIVED" }, { label: "Deduction", value: "DEDUCTION" }, { label: "Refund", value: "REFUND" }]} />
      <View style={{ height: 16 }} />
      {type === "RECEIVED" && lease.deposit.pending > 0 && <Notice tone="info" message={`Remaining to collect: ${money(lease.deposit.pending)}`} style={{ marginBottom: 14 }} />}
      <AmountField label="Amount" value={amount} onChange={setAmount} />
      <DateField label="Date" value={date} onChange={setDate} max={today()} />
      <Field label="Description" value={desc} onChangeText={setDesc} placeholder={type === "RECEIVED" ? (lease?.agreement_type === "LEASE" ? "e.g. Lease amount via NEFT" : "e.g. Advance via NEFT") : "e.g. Broken window repair"} />
      <Field label="Reference (optional)" value={ref} onChangeText={setRef} placeholder="UTR / cheque no." />
    </Sheet>
  );
};

const EditTermsSheet = ({ visible, onClose, lease, onSaved }: any) => {
  const [f, setF] = useState<any>({});
  useEffect(() => {
    if (visible) setF({
      rent_amount: String(lease.rent_amount), maintenance_charge: String(lease.maintenance_charge), end_date: lease.end_date, rent_due_day: String(lease.rent_due_day),
      notice_period_days: String(lease.notice_period_days), auto_invoice: lease.auto_invoice, escalation_type: lease.escalation_type || "NONE",
      escalation_value: String(lease.escalation_value || ""), escalation_frequency_months: String(lease.escalation_frequency_months || 12), next_escalation_date: lease.next_escalation_date,
      painting_charge: String(lease.painting_charge || ""), electricity_billing: lease.electricity_billing, electricity_cycle_months: String(lease.electricity_cycle_months || 2),
      electricity_bill_months: lease.electricity_bill_months || "EVEN",
    });
  }, [visible]);
  const [saving, setSaving] = useState(false);
  const isL = lease?.agreement_type === "LEASE";
  const save = async () => {
    setSaving(true);
    try {
      await Owner.updateLease(lease.id, isL ? {
        maintenance_charge: Number(f.maintenance_charge || 0), end_date: f.end_date || null, rent_due_day: Number(f.rent_due_day),
        notice_period_days: Number(f.notice_period_days), auto_invoice: f.auto_invoice, painting_charge: Number(f.painting_charge || 0),
        electricity_billing: f.electricity_billing, electricity_cycle_months: Number(f.electricity_cycle_months), electricity_bill_months: f.electricity_cycle_months === "1" ? "ALL" : f.electricity_bill_months,
      } : {
        rent_amount: Number(f.rent_amount), maintenance_charge: Number(f.maintenance_charge || 0), end_date: f.end_date || null, rent_due_day: Number(f.rent_due_day),
        notice_period_days: Number(f.notice_period_days), auto_invoice: f.auto_invoice,
        escalation_type: f.escalation_type, escalation_value: Number(f.escalation_value || 0), escalation_frequency_months: Number(f.escalation_frequency_months || 12),
        next_escalation_date: f.escalation_type === "NONE" ? null : f.next_escalation_date || null, painting_charge: Number(f.painting_charge || 0),
        electricity_billing: f.electricity_billing, electricity_cycle_months: Number(f.electricity_cycle_months), electricity_bill_months: f.electricity_cycle_months === "1" ? "ALL" : f.electricity_bill_months,
      });
      toast.success(isL ? "Lease updated" : "Rental agreement updated"); onClose(); onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }));
  return (
    <Sheet visible={visible} onClose={onClose} title={isL ? "Edit lease terms" : "Edit rental terms"} footer={<Button title="Save" onPress={save} loading={saving} />}>
      {!isL && <AmountField label="Monthly rent" value={f.rent_amount || ""} onChange={set("rent_amount")} hint="Applies to future invoices" />}
      <AmountField label={isL ? "Monthly maintenance (optional)" : "Monthly maintenance"} value={f.maintenance_charge || ""} onChange={set("maintenance_charge")} />
      <DateField label="End date (renew / extend)" value={f.end_date} onChange={set("end_date")} min={lease.start_date} />
      <Row gap={12}>
        <View style={{ flex: 1 }}><Field label="Due day" keyboardType="number-pad" value={f.rent_due_day} onChangeText={set("rent_due_day")} /></View>
        <View style={{ flex: 1 }}><Field label="Notice days" keyboardType="number-pad" value={f.notice_period_days} onChangeText={set("notice_period_days")} /></View>
      </Row>
      {!isL && <T v="overline" style={{ marginBottom: 8 }}>Yearly increase</T>}
      {!isL && <View style={{ marginBottom: 12 }}><ChipGroup value={f.escalation_type} onChange={set("escalation_type")} options={[{ label: "None", value: "NONE" }, { label: "Percent", value: "PERCENT" }, { label: "Fixed ₹", value: "FIXED" }]} /></View>}
      {!isL && f.escalation_type !== "NONE" && (
        <>
          <Row gap={12}>
            <View style={{ flex: 1 }}><Field label={f.escalation_type === "PERCENT" ? "Increase %" : "Increase ₹"} keyboardType="decimal-pad" value={f.escalation_value} onChangeText={set("escalation_value")} /></View>
            <View style={{ flex: 1 }}><Field label="Every (months)" keyboardType="number-pad" value={f.escalation_frequency_months} onChangeText={set("escalation_frequency_months")} /></View>
          </Row>
          <DateField label="Next increase on" value={f.next_escalation_date} onChange={set("next_escalation_date")} min={today()} hint="Leave empty to count from the agreement anniversary." />
        </>
      )}
      <AmountField label="Painting / move-out estimate" value={f.painting_charge || ""} onChange={set("painting_charge")} />
      <T v="overline" style={{ marginBottom: 8 }}>Electricity</T>
      <View style={{ marginBottom: 10 }}><ChipGroup value={f.electricity_billing} onChange={set("electricity_billing")} options={[{ label: "By meter", value: "METERED" }, { label: "Fixed", value: "FIXED" }, { label: "Included", value: "INCLUDED" }]} /></View>
      {f.electricity_billing === "METERED" && (
        <View style={{ marginBottom: 14, gap: 10 }}>
          <ChipGroup value={f.electricity_cycle_months} onChange={set("electricity_cycle_months")} options={[{ label: "Every month", value: "1" }, { label: "Every 2 months", value: "2" }]} />
          {f.electricity_cycle_months === "2" && <ChipGroup value={f.electricity_bill_months} onChange={set("electricity_bill_months")} options={[{ label: "Even months", value: "EVEN" }, { label: "Odd months", value: "ODD" }]} />}
        </View>
      )}
      <Row between><T v="title">Auto-generate invoices</T><Toggle value={!!f.auto_invoice} onChange={set("auto_invoice")} /></Row>
    </Sheet>
  );
};

const StartMoveOutSheet = ({ visible, onClose, lease, onSaved }: any) => {
  const [date, setDate] = useState(addDays(today(), lease?.notice_period_days || 30));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { const mo = await Owner.startMoveOut(lease.id, { planned_move_out_date: date, reason: reason || null }); toast.success("Notice recorded and tenant informed"); onClose(); onSaved(mo); }
    catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Start move-out" footer={<Button title="Give notice" variant="danger" onPress={save} loading={saving} />}>
      <Notice tone="warning" message={`The agreement has a ${lease?.notice_period_days}-day notice period. Your tenant will be notified immediately.`} style={{ marginBottom: 16 }} />
      <DateField label="Move-out date" value={date} onChange={setDate} min={today()} />
      <Field label="Reason (shared with tenant)" value={reason} onChangeText={setReason} multiline />
    </Sheet>
  );
};

// ── Invitations ────────────────────────────────────────────────────────────
export const InvitationsScreen = ({ navigation }: any) => {
  const q = useLoad(() => Owner.invitations(), []);
  const [code, setCode] = useState<{ code: string; email: string } | null>(null);
  const regenerate = async (inv: any) => {
    try { const r = await Owner.regenerateInvite(inv.id); setCode({ code: r.code, email: inv.tenant_email }); q.reload(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const cancel = async (inv: any) => {
    if (!(await confirm({ title: "Cancel this invitation?", message: "The code will stop working and the unit becomes available.", confirm: "Cancel invite", danger: true }))) return;
    try { await Owner.cancelInvite(inv.id); toast.success("Invitation cancelled"); q.reload(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <Screen header={<Header title="Invitations" />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload}>
        {!q.data?.length ? <EmptyState icon="ticket-outline" title="No invitations" message="When you add a tenant who isn't on RentLynk yet, their invite shows here." action="Add tenant" onAction={() => navigation.navigate("CreateLease")} /> : (
          q.data.map((inv: any) => (
            <Card key={inv.id} style={{ marginBottom: 12 }}>
              <Row between>
                <View style={{ flex: 1 }}>
                  <T v="title">{inv.tenant_name || inv.tenant_email}</T>
                  <T v="caption">{inv.property_name} · Unit {inv.unit_number}</T>
                </View>
                <Badge status={inv.status} />
              </Row>
              <T v="small" style={{ marginTop: 8 }}>{inv.tenant_email} · code …{inv.code_hint} · {inv.status === "PENDING" ? `expires ${fmtDate(inv.expires_at)}` : `created ${fmtDate(inv.created_at)}`}</T>
              {["PENDING", "EXPIRED"].includes(inv.status) && (
                <Row gap={10} style={{ marginTop: 12 }}>
                  <View style={{ flex: 1 }}><Button title="New code" size="sm" variant="secondary" icon="refresh" onPress={() => regenerate(inv)} /></View>
                  {inv.status === "PENDING" && <View style={{ flex: 1 }}><Button title="Cancel" size="sm" variant="ghost" onPress={() => cancel(inv)} /></View>}
                </Row>
              )}
            </Card>
          ))
        )}
      </Loadable>
      <Sheet visible={!!code} onClose={() => setCode(null)} title="New invite code">
        {code && (
          <View style={{ alignItems: "center", paddingVertical: 10 }}>
            <T style={{ fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 44, letterSpacing: 3, color: colors.primary }} numberOfLines={1} adjustsFontSizeToFit selectable>{code.code}</T>
            <T v="small" center style={{ marginTop: 8 }}>Share this with {code.email}. It's valid for 14 days.</T>
            <Row gap={10} style={{ marginTop: 18, alignSelf: "stretch" }}>
              <View style={{ flex: 1 }}><Button title="Copy" variant="secondary" icon="copy-outline" size="md" onPress={async () => { await Clipboard.setStringAsync(code.code); toast.success("Copied"); }} /></View>
              <View style={{ flex: 1 }}><Button title="Share" icon="share-social-outline" size="md" onPress={() => Share.share({ message: `Your RentLynk invite code is ${code.code}. Sign up as a tenant with ${code.email} and enter this code.` })} /></View>
            </Row>
          </View>
        )}
      </Sheet>
    </Screen>
  );
};

const st = StyleSheet.create({
  heroStat: { flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14, padding: 10 },
  typeCard: { flex: 1, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: "#E4E7F0", backgroundColor: "#FFFFFF" },
  typeCardOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  typeIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  quick: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
});

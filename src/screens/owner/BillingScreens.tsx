import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header, Screen } from "../../components/Screen";
import { Badge, Button, Card, ChipGroup, EmptyState, IconButton, KeyValue, Notice, Row, SectionHeader, Segmented, T, Tap } from "../../components/ui";
import { AmountField, DateField, Field, SelectField } from "../../components/Inputs";
import { BillAttachments, InvoiceRow, LineItems, ListCard, PaymentRow, Timeline } from "../../components/Domain";
import { openLink } from "../../utils/links";
import { Loadable } from "../../components/States";
import { confirm, Sheet, toast } from "../../components/Feedback";
import { colors, fonts, radius } from "../../theme";
import { LineItem, Owner } from "../../api/endpoints";
import { errorMessage, fileUrl } from "../../api/client";
import { useLoad } from "../../utils/useLoad";
import { fmtDate, fmtDateTime, money, MONTHS, period, relativeDue, timeAgo, titleCase, today } from "../../utils/format";
import { downloadPdf } from "../../utils/files";
import { haptic } from "../../utils/haptics";

const STATUS_FILTERS = [
  { label: "Open", value: "OPEN" }, { label: "Overdue", value: "OVERDUE" }, { label: "Paid", value: "PAID" }, { label: "All", value: "" },
] as const;

export const BillingScreen = ({ navigation, route }: any) => {
  const [tab, setTab] = useState<"review" | "invoices">(route.params?.tab || "review");
  const [status, setStatus] = useState<string>(route.params?.status || "OPEN");
  useEffect(() => { if (route.params?.tab) setTab(route.params.tab); if (route.params?.status) setStatus(route.params.status); }, [route.params]);
  const pay = useLoad(() => Owner.payments({ status: "PENDING", limit: 50 }), []);
  const inv = useLoad(() => Owner.invoices({ status: status || undefined, limit: 50 }), [status]);
  const summary = inv.data?.data?.summary;
  return (
    <Screen refreshing={pay.refreshing || inv.refreshing} onRefresh={() => { pay.refresh(); inv.refresh(); }}
      header={<Header back={false} title="Billing" right={<IconButton icon="add" bg={colors.primary} color="#fff" onPress={() => navigation.navigate("CreateInvoice")} label="New invoice" />} />}>
      <Segmented value={tab} onChange={setTab} options={[{ label: `To review${pay.data?.length ? ` (${pay.data.length})` : ""}`, value: "review" }, { label: "Invoices", value: "invoices" }]} />
      {tab === "review" ? (
        <View style={{ marginTop: 16 }}>
          <Loadable loading={pay.loading} error={pay.error} onRetry={pay.reload}>
            {!pay.data?.length ? <EmptyState icon="checkmark-done-circle-outline" title="All payments reviewed" message="When tenants upload payment proof, it appears here for you to approve." /> : (
              <>
                <Notice tone="info" icon="shield-checkmark-outline" message="Check the amount, date and UTR in your bank app before approving. Approved payments generate receipts automatically." style={{ marginBottom: 14 }} />
                <ListCard>{pay.data.map((p) => <PaymentRow key={p.id} p={p} showTenant onPress={() => navigation.navigate("PaymentReview", { id: p.id })} />)}</ListCard>
              </>
            )}
          </Loadable>
          <Button title="Record cash / offline payment" variant="ghost" icon="cash-outline" style={{ marginTop: 16 }} onPress={() => setTab("invoices")} />
        </View>
      ) : (
        <View style={{ marginTop: 16 }}>
          {summary && (
            <Row gap={10} style={{ marginBottom: 14 }}>
              <Card style={st.sum}><T v="caption">Billed</T><T v="title">{money(summary.billed, { compact: true })}</T></Card>
              <Card style={st.sum}><T v="caption">Collected</T><T v="title" color={colors.success}>{money(summary.collected, { compact: true })}</T></Card>
              <Card style={st.sum}><T v="caption">Outstanding</T><T v="title" color={colors.danger}>{money(summary.outstanding, { compact: true })}</T></Card>
            </Row>
          )}
          <ChipGroup value={status as any} onChange={setStatus as any} options={STATUS_FILTERS as any} />
          <View style={{ height: 14 }} />
          <Loadable loading={inv.loading} error={inv.error} onRetry={inv.reload}>
            {!inv.data?.data?.items?.length ? <EmptyState icon="receipt-outline" title="No invoices here" message="Rent invoices are created automatically for active leases. You can also create one anytime." action="New invoice" onAction={() => navigation.navigate("CreateInvoice")} />
              : <ListCard>{inv.data.data.items.map((i: any) => <InvoiceRow key={i.id} inv={i} showTenant onPress={() => navigation.navigate("OwnerInvoice", { id: i.id })} />)}</ListCard>}
          </Loadable>
        </View>
      )}
    </Screen>
  );
};

// ── Invoice detail ─────────────────────────────────────────────────────────
const CATEGORIES = ["ELECTRICITY", "WATER", "MAINTENANCE", "GAS", "PARKING", "INTERNET", "LATE_FEE", "REPAIRS", "CLEANING", "PAINTING", "OTHER"];

export const OwnerInvoiceScreen = ({ route, navigation }: any) => {
  const { id } = route.params;
  const q = useLoad(() => Owner.invoice(id), [id]);
  const inv = q.data;
  const [chargesOpen, setChargesOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = inv && !["PAID", "CANCELLED"].includes(inv.status);

  const remind = async () => {
    setBusy(true);
    try { await Owner.remind(id); toast.success(`Reminder sent to ${inv?.tenant_name}`); q.reload(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!(await confirm({ title: "Cancel this invoice?", message: "The tenant will be notified. This can't be undone.", confirm: "Cancel invoice", danger: true }))) return;
    try { await Owner.cancelInvoice(id, "Cancelled by owner"); toast.success("Invoice cancelled"); q.reload(); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <Screen header={<Header title={inv?.invoice_number || "Invoice"} right={inv ? <IconButton icon="download-outline" onPress={() => downloadPdf(`/owner/invoices/${id}/pdf`, `${inv.invoice_number}.pdf`).catch((e) => toast.error(errorMessage(e)))} label="Download PDF" /> : undefined} />}
      refreshing={q.refreshing} onRefresh={q.refresh}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload} skeleton="detail">
        {inv && (
          <>
            <Card>
              <Row between><Badge status={inv.status} /><T v="caption">{titleCase(inv.type)} · {period(inv.month, inv.year)}</T></Row>
              <T v="amount" style={{ marginTop: 12 }} color={inv.balance > 0 && open ? colors.text : colors.success}>{money(open ? inv.balance : inv.total)}</T>
              <T v="small">{open ? `${relativeDue(inv.due_date)} · due ${fmtDate(inv.due_date)}` : inv.status === "PAID" ? `Paid in full${inv.paid_at ? ` on ${fmtDate(inv.paid_at)}` : ""}` : `Cancelled: ${inv.cancel_reason || ""}`}</T>
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 14 }} />
              <KeyValue label="Tenant" value={inv.tenant_name} />
              <KeyValue label="Unit" value={`${inv.property_name} · ${inv.unit_number}`} />
            </Card>
            <SectionHeader title="Charges" action={open ? "+ Add charge" : undefined} onAction={() => setChargesOpen(true)} />
            <Card><LineItems inv={inv} /><BillAttachments bills={(inv as any).utility_bills} onOpen={(u) => openLink(fileUrl(u)!)} /></Card>
            {inv.notes && <Notice tone="info" message={inv.notes} style={{ marginTop: 12 }} />}

            {open && (
              <Row gap={10} style={{ marginTop: 16 }}>
                <View style={{ flex: 1 }}><Button title="Remind" icon="notifications-outline" variant="secondary" size="md" onPress={remind} loading={busy} /></View>
                <View style={{ flex: 1 }}><Button title="Record payment" icon="cash-outline" size="md" onPress={() => setRecordOpen(true)} /></View>
              </Row>
            )}

            {!!inv.payments?.length && (
              <>
                <SectionHeader title="Payments" />
                <ListCard>{inv.payments.map((p: any) => <PaymentRow key={p.id} p={p} onPress={() => navigation.navigate("PaymentReview", { id: p.id })} />)}</ListCard>
              </>
            )}
            {!!inv.reminders?.length && (
              <>
                <SectionHeader title="Reminders sent" />
                <Card><Timeline items={inv.reminders.map((r: any) => ({ title: titleCase(r.type), subtitle: r.message, time: timeAgo(r.sent_at), done: true }))} /></Card>
              </>
            )}
            {open && inv.amount_paid === 0 && <Button title="Cancel invoice" variant="ghost" icon="close-circle-outline" onPress={cancel} style={{ marginTop: 20 }} />}
            <AddChargesSheet visible={chargesOpen} onClose={() => setChargesOpen(false)} invoiceId={id} onSaved={q.reload} />
            <RecordPaymentSheet visible={recordOpen} onClose={() => setRecordOpen(false)} inv={inv} onSaved={q.reload} />
          </>
        )}
      </Loadable>
    </Screen>
  );
};

const AddChargesSheet = ({ visible, onClose, invoiceId, onSaved }: any) => {
  const [cat, setCat] = useState("ELECTRICITY");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!(Number(amount) > 0)) return toast.error("Enter an amount");
    setSaving(true);
    try { await Owner.addCharges(invoiceId, [{ category: cat, label: label || titleCase(cat), amount: Number(amount) }]); toast.success("Charge added"); setAmount(""); setLabel(""); onClose(); onSaved(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Add a charge" footer={<Button title="Add to invoice" onPress={save} loading={saving} />}>
      <SelectField label="Type" value={cat} onChange={setCat} options={CATEGORIES.map((c) => ({ label: titleCase(c), value: c }))} />
      <Field label="Description" value={label} onChangeText={setLabel} placeholder={cat === "ELECTRICITY" ? "Meter 1240 → 1395 units" : "Optional"} />
      <AmountField label="Amount" value={amount} onChange={setAmount} />
    </Sheet>
  );
};

const RecordPaymentSheet = ({ visible, onClose, inv, onSaved }: any) => {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [date, setDate] = useState(today());
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible && inv) setAmount(String(inv.balance)); }, [visible]);
  const save = async () => {
    setSaving(true);
    try { await Owner.recordPayment({ invoice_id: inv.id, amount: Number(amount), method, payment_date: date, transaction_id: ref || null }); haptic.success(); toast.success("Payment recorded. Receipt sent to tenant."); onClose(); onSaved(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Record payment" footer={<Button title="Save payment" onPress={save} loading={saving} />}>
      <T v="small" style={{ marginBottom: 14 }}>For payments you received outside the app. They're marked verified immediately.</T>
      <AmountField label="Amount received" value={amount} onChange={setAmount} hint={inv ? `Balance due: ${money(inv.balance)}` : undefined} />
      <View style={{ marginBottom: 16 }}><ChipGroup value={method} onChange={setMethod} options={[{ label: "Cash", value: "CASH" }, { label: "UPI", value: "UPI" }, { label: "Bank", value: "BANK_TRANSFER" }, { label: "Cheque", value: "CHEQUE" }]} /></View>
      <DateField label="Date received" value={date} onChange={setDate} max={today()} />
      <Field label="Reference (optional)" value={ref} onChangeText={setRef} placeholder="Cheque / UTR no." />
    </Sheet>
  );
};

// ── Create invoice ─────────────────────────────────────────────────────────
export const CreateInvoiceScreen = ({ navigation, route }: any) => {
  const leases = useLoad(() => Owner.leases({ status: "LIVE" }), []);
  const now = new Date();
  const [leaseId, setLeaseId] = useState<string | null>(route.params?.leaseId || null);
  const [type, setType] = useState<"RENT" | "OTHER">("RENT");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year] = useState(now.getFullYear());
  const [items, setItems] = useState<LineItem[]>([]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const lease = (leases.data || []).find((l: any) => l.id === leaseId);

  useEffect(() => {
    if (!lease) return;
    if (type === "RENT") {
      const base: LineItem[] = [{ label: "Monthly rent", amount: lease.rent_amount, category: "RENT" }];
      if (lease.maintenance_charge > 0) base.push({ label: "Maintenance charges", amount: lease.maintenance_charge, category: "MAINTENANCE" });
      setItems(base);
    } else setItems([{ label: "", amount: 0, category: "ELECTRICITY" }]);
  }, [leaseId, type]);

  const total = Math.max(0, items.reduce((s, i) => s + (Number(i.amount) || 0), 0) - (Number(discount) || 0));
  const update = (i: number, patch: Partial<LineItem>) => setItems((arr) => arr.map((it, k) => (k === i ? { ...it, ...patch } : it)));

  const save = async () => {
    if (!leaseId) return toast.error("Choose a tenant");
    const clean = items.filter((i) => Number(i.amount) > 0).map((i) => ({ ...i, label: i.label || titleCase(i.category), amount: Number(i.amount) }));
    if (!clean.length) return toast.error("Add at least one charge");
    setSaving(true);
    try {
      const inv = await Owner.createInvoice({ lease_id: leaseId, type, month: Number(month), year, items: clean, due_date: dueDate || undefined, discount: Number(discount) || 0, notes: notes || null });
      haptic.success(); toast.success("Invoice sent to tenant");
      navigation.replace("OwnerInvoice", { id: inv.id });
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <Screen header={<Header title="New invoice" />} footer={
      <Row between gap={12}>
        <View><T v="caption">Total</T><T v="h2">{money(total)}</T></View>
        <View style={{ flex: 1 }}><Button title="Send invoice" icon="paper-plane-outline" onPress={save} loading={saving} /></View>
      </Row>}>
      <SelectField label="Tenant" icon="person-outline" value={leaseId} onChange={setLeaseId}
        options={(leases.data || []).map((l: any) => ({ label: l.tenant_name, value: l.id, subtitle: `${l.property_name} · Unit ${l.unit_number}` }))} />
      <Segmented value={type} onChange={setType} options={[{ label: "Monthly rent", value: "RENT" }, { label: "Utility / other", value: "OTHER" }]} />
      <View style={{ height: 16 }} />
      <SelectField label="Billing month" value={month} onChange={setMonth} options={MONTHS.map((m, i) => ({ label: `${m} ${year}`, value: String(i + 1) }))} />
      <SectionHeader title="Charges" action="+ Add line" onAction={() => setItems((a) => [...a, { label: "", amount: 0, category: "OTHER" }])} style={{ marginTop: 4 }} />
      {items.map((it, i) => (
        <Card key={i} style={{ marginBottom: 10 }}>
          <Row between style={{ marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <SelectField value={it.category} onChange={(v) => update(i, { category: v })} options={["RENT", ...CATEGORIES].map((c) => ({ label: titleCase(c), value: c }))} />
            </View>
            {items.length > 1 && <IconButton icon="trash-outline" size={36} color={colors.danger} bg={colors.dangerSoft} onPress={() => setItems((a) => a.filter((_, k) => k !== i))} />}
          </Row>
          <Field label="Description" value={it.label} onChangeText={(t) => update(i, { label: t })} placeholder={titleCase(it.category)} />
          <AmountField label="Amount" value={it.amount ? String(it.amount) : ""} onChange={(v) => update(i, { amount: v as any })} />
        </Card>
      ))}
      <AmountField label="Discount (optional)" value={discount} onChange={setDiscount} />
      <DateField label="Due date (optional)" value={dueDate} onChange={setDueDate} hint={lease ? `Defaults to day ${lease.rent_due_day} of the month` : undefined} />
      <Field label="Note to tenant (optional)" value={notes} onChangeText={setNotes} multiline />
    </Screen>
  );
};

// ── Payment review ─────────────────────────────────────────────────────────
const REJECT_REASONS = ["Amount doesn't match", "Screenshot is unclear or cropped", "UTR / reference not found in bank", "Payment date is wrong", "Paid to a different account"];

export const PaymentReviewScreen = ({ route, navigation }: any) => {
  const { id } = route.params;
  const q = useLoad(() => Owner.payment(id), [id]);
  const p = q.data;
  const [zoom, setZoom] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"APPROVE" | "REJECT" | null>(null);
  const proof = fileUrl(p?.proof_url);

  const act = async (action: "APPROVE" | "REJECT") => {
    if (action === "APPROVE" && !(await confirm({ title: `Approve ${money(p!.amount)}?`, message: "Confirm you've received this amount in your account. A receipt will be sent to the tenant.", confirm: "Approve", icon: "checkmark-circle" }))) return;
    if (action === "REJECT" && reason.trim().length < 5) return toast.error("Tell the tenant why (at least a few words)");
    setBusy(action);
    try {
      await Owner.review(id, { action, rejection_reason: action === "REJECT" ? reason.trim() : undefined });
      haptic.success(); toast.success(action === "APPROVE" ? "Payment approved · receipt sent" : "Payment rejected · tenant notified");
      setRejectOpen(false); navigation.goBack();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };

  return (
    <Screen header={<Header title="Payment" />} refreshing={q.refreshing} onRefresh={q.refresh}
      footer={p?.status === "PENDING" ? (
        <Row gap={12}>
          <View style={{ flex: 1 }}><Button title="Reject" variant="ghost" icon="close" onPress={() => setRejectOpen(true)} /></View>
          <View style={{ flex: 1.4 }}><Button title="Approve" variant="success" icon="checkmark" onPress={() => act("APPROVE")} loading={busy === "APPROVE"} /></View>
        </Row>
      ) : undefined}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload} skeleton="detail">
        {p && (
          <>
            {p.duplicate_reference_flag && <Notice tone="danger" title="Possible duplicate" message="This reference number was already used on another payment. Double-check before approving." style={{ marginBottom: 14 }} />}
            <Card>
              <Row between><T v="overline">{p.tenant_name}</T><Badge status={p.status} label={p.status === "PENDING" ? "Awaiting review" : undefined} /></Row>
              <T v="amount" style={{ marginTop: 10 }}>{money(p.amount)}</T>
              <T v="small">for {p.invoice_number} · {p.month ? period(p.month, p.year!) : ""}</T>
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
              <KeyValue label="Method" value={titleCase(p.method)} />
              <KeyValue label="Reference / UTR" value={p.transaction_id || "—"} />
              <KeyValue label="Paid on" value={fmtDate(p.payment_date)} />
              <KeyValue label="Submitted" value={fmtDateTime(p.created_at)} />
              <KeyValue label="Invoice balance" value={money((p.invoice_total || 0) - (p.invoice_paid || 0))} />
              <KeyValue label="Unit" value={`${p.property_name} · ${p.unit_number}`} />
              {p.notes && <KeyValue label="Tenant note" value={p.notes} />}
              {p.receipt_number && <KeyValue label="Receipt" value={p.receipt_number} valueColor={colors.success} />}
            </Card>
            {p.status === "REJECTED" && <Notice tone="danger" title="Rejected" message={p.rejection_reason || ""} style={{ marginTop: 12 }} />}
            <SectionHeader title="Payment proof" />
            {proof ? (
              <Tap onPress={() => setZoom(true)}>
                <Image source={{ uri: proof }} style={st.proof} resizeMode="cover" />
                <View style={st.zoomHint}><Ionicons name="expand" size={14} color="#fff" /><T v="caption" color="#fff"> Tap to zoom</T></View>
              </Tap>
            ) : <Notice tone="neutral" message={p.method === "CASH" ? "Cash payment — no screenshot." : "No proof attached."} />}
            {p.status === "VERIFIED" && p.receipt_number && (
              <Button title="Download receipt" variant="secondary" icon="download-outline" style={{ marginTop: 16 }} onPress={() => downloadPdf(`/owner/payments/${id}/receipt`, `${p.receipt_number}.pdf`).catch((e) => toast.error(errorMessage(e)))} />
            )}
            {!!p.other_payments?.length && (
              <>
                <SectionHeader title="Other payments on this invoice" />
                <ListCard>{p.other_payments.map((o) => <PaymentRow key={o.id} p={o} />)}</ListCard>
              </>
            )}
            <Modal visible={zoom} transparent onRequestClose={() => setZoom(false)}>
              <Pressable style={st.zoomBg} onPress={() => setZoom(false)}>
                {proof && <Image source={{ uri: proof }} style={{ width: "100%", height: "80%" }} resizeMode="contain" />}
                <T v="small" color="#fff" style={{ marginTop: 12 }}>Tap anywhere to close</T>
              </Pressable>
            </Modal>
            <Sheet visible={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject payment" footer={<Button title="Reject & notify tenant" variant="danger" onPress={() => act("REJECT")} loading={busy === "REJECT"} />}>
              <T v="small" style={{ marginBottom: 12 }}>Pick a reason or write your own. Your tenant sees this and can resubmit.</T>
              <View style={{ gap: 8, marginBottom: 14 }}>
                {REJECT_REASONS.map((r) => (
                  <Tap key={r} onPress={() => setReason(r)} style={[st.reason, reason === r && { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}>
                    <T v="small" color={reason === r ? colors.danger : colors.text}>{r}</T>
                  </Tap>
                ))}
              </View>
              <Field label="Reason" value={reason} onChangeText={setReason} multiline placeholder="Explain what's wrong" />
            </Sheet>
          </>
        )}
      </Loadable>
    </Screen>
  );
};

const st = StyleSheet.create({
  sum: { flex: 1, paddingVertical: 12 },
  proof: { width: "100%", height: 320, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  zoomHint: { position: "absolute", right: 12, bottom: 12, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  zoomBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: 16 },
  reason: { padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
});

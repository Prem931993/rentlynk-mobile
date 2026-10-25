import { openLink } from "../../utils/links";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Linking, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Header, Screen } from "../../components/Screen";
import { Badge, Button, Card, ChipGroup, EmptyState, IconButton, KeyValue, Notice, Row, SectionHeader, Segmented, T, Tap } from "../../components/ui";
import { AmountField, DateField, Field } from "../../components/Inputs";
import { BillAttachments, InvoiceRow, LineItems, ListCard, PaymentRow } from "../../components/Domain";
import { Loadable } from "../../components/States";
import { toast } from "../../components/Feedback";
import { colors, fonts, radius } from "../../theme";
import { Tenant } from "../../api/endpoints";
import { errorMessage, fileUrl } from "../../api/client";
import { useLoad } from "../../utils/useLoad";
import { fmtDate, money, period, relativeDue, titleCase, today } from "../../utils/format";
import { appendFile, downloadPdf, pickDocument, pickImage, PickedFile } from "../../utils/files";
import { haptic } from "../../utils/haptics";

const CopyRow = ({ label, value }: { label: string; value?: string | null }) => {
  if (!value) return null;
  return (
    <Row between style={{ paddingVertical: 8 }}>
      <View style={{ flex: 1 }}><T v="caption">{label}</T><T v="title" selectable>{value}</T></View>
      <IconButton icon="copy-outline" size={36} bg={colors.primarySoft} color={colors.primary} onPress={async () => { await Clipboard.setStringAsync(value); haptic.success(); toast.success(`${label} copied`); }} label={`Copy ${label}`} />
    </Row>
  );
};

export const PayToCard = ({ owner, amount }: { owner: any; amount?: number }) => (
  <Card>
    <Row gap={10} style={{ marginBottom: 6 }}>
      <Ionicons name="business-outline" size={18} color={colors.primary} />
      <T v="title">Pay to {owner?.bank_account_name || owner?.name}</T>
    </Row>
    {owner?.upi_id || owner?.bank_account_number ? (
      <>
        <CopyRow label="UPI ID" value={owner.upi_id} />
        <CopyRow label="Account number" value={owner.bank_account_number} />
        <CopyRow label="IFSC" value={owner.bank_ifsc} />
        {owner.bank_name && <KeyValue label="Bank" value={owner.bank_name} />}
        {owner.upi_id && amount ? (
          <Button title="Open UPI app" variant="secondary" icon="qr-code-outline" size="md" style={{ marginTop: 10 }}
            onPress={() => openLink(`upi://pay?pa=${encodeURIComponent(owner.upi_id)}&pn=${encodeURIComponent(owner.name)}&am=${amount.toFixed(2)}&cu=INR&tn=Rent`, "No UPI app found. Copy the UPI ID instead.")} />
        ) : null}
      </>
    ) : <T v="small">Your owner hasn't added payment details yet. Contact them for UPI or bank details{owner?.phone ? ` (${owner.phone})` : ""}.</T>}
  </Card>
);

export const PayScreen = ({ navigation, route }: any) => {
  const inv = useLoad(() => Tenant.invoices("OPEN"), []);
  const [invoiceId, setInvoiceId] = useState<string | null>(route.params?.invoiceId || null);
  const detail = useLoad(() => (invoiceId ? Tenant.invoice(invoiceId) : Promise.resolve(null)), [invoiceId]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("UPI");
  const [utr, setUtr] = useState("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<any>(null);

  useEffect(() => { if (!invoiceId && inv.data?.length) setInvoiceId(inv.data[0].id); }, [inv.data]);
  const d = detail.data;
  const pendingAmt = (d?.payments || []).filter((p: any) => p.status === "PENDING").reduce((s: number, p: any) => s + p.amount, 0);
  const available = d ? Math.max(0, d.balance - pendingAmt) : 0;
  useEffect(() => { if (d) setAmount(String(available)); }, [d?.id, available]);
  const needsProof = ["UPI", "BANK_TRANSFER", "ONLINE"].includes(method);

  const choose = async (src: "camera" | "gallery" | "pdf") => {
    try {
      const f = src === "pdf" ? await pickDocument() : (await pickImage({ camera: src === "camera" }))[0];
      if (f) setProof(f);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const submit = async () => {
    if (!d) return toast.error("Choose a bill to pay");
    const amt = Number(amount);
    if (!(amt > 0)) return toast.error("Enter the amount you paid");
    if (amt > available) return toast.error(`You can pay up to ${money(available)} on this bill`);
    if (needsProof && !utr.trim()) return toast.error("Enter the UTR / transaction reference");
    if (needsProof && !proof) return toast.error("Add a screenshot of the payment");
    setSaving(true);
    try {
      const form = new FormData();
      form.append("invoice_id", d.id); form.append("amount", String(amt)); form.append("method", method);
      form.append("payment_date", date);
      if (utr.trim()) form.append("transaction_id", utr.trim());
      if (notes.trim()) form.append("notes", notes.trim());
      if (proof) await appendFile(form, "proof", proof);
      const p = await Tenant.pay(form);
      haptic.success();
      setDone(p);
    } catch (e) { toast.error(errorMessage(e)); haptic.error(); } finally { setSaving(false); }
  };

  if (done) return <PaymentSuccess payment={done} onDone={() => navigation.goBack()} />;

  return (
    <Screen header={<Header title="Pay rent" />} footer={d && available > 0 ? <Button title={`Submit ${money(Number(amount) || 0)}`} icon="shield-checkmark" onPress={submit} loading={saving} /> : undefined}>
      <Loadable loading={inv.loading} error={inv.error} onRetry={inv.reload}>
        {!inv.data?.length ? <EmptyState icon="happy-outline" title="Nothing to pay" message="You have no open bills. We'll remind you before your next rent is due." /> : (
          <>
            {inv.data.length > 1 && (
              <>
                <T v="overline" style={{ marginBottom: 10 }}>Choose a bill</T>
                <View style={{ gap: 8, marginBottom: 18 }}>
                  {inv.data.map((i) => (
                    <Tap key={i.id} onPress={() => setInvoiceId(i.id)} style={[st.bill, invoiceId === i.id && st.billOn]}>
                      <View style={{ flex: 1 }}>
                        <T v="title">{i.type === "RENT" ? `${period(i.month, i.year)} rent` : `${titleCase(i.type)} · ${i.invoice_number}`}</T>
                        <T v="caption">{relativeDue(i.due_date)}</T>
                      </View>
                      <T v="bodyStrong">{money(i.balance)}</T>
                    </Tap>
                  ))}
                </View>
              </>
            )}
            {d && (
              <>
                {pendingAmt > 0 && <Notice tone="info" message={`${money(pendingAmt)} is already waiting for your owner's review on this bill.`} style={{ marginBottom: 14 }} />}
                {available <= 0 ? <Notice tone="success" title="Nothing more to pay right now" message="Your payment is being reviewed." /> : (
                  <>
                    <T v="overline" style={{ marginBottom: 10 }}>1 · Pay your owner</T>
                    <PayToCard owner={d.owner} amount={Number(amount) || available} />
                    <T v="overline" style={{ marginTop: 22, marginBottom: 10 }}>2 · Tell us about the payment</T>
                    <AmountField label="Amount paid" value={amount} onChange={setAmount} hint={`Balance due ${money(available)} · partial payments are allowed`} />
                    <View style={{ marginBottom: 16 }}>
                      <ChipGroup value={method} onChange={setMethod} options={[{ label: "UPI", value: "UPI", icon: "qr-code-outline" }, { label: "Bank transfer", value: "BANK_TRANSFER", icon: "business-outline" }, { label: "Cash", value: "CASH", icon: "cash-outline" }, { label: "Cheque", value: "CHEQUE", icon: "document-outline" }]} />
                    </View>
                    {method !== "CASH" && <Field label={method === "CHEQUE" ? "Cheque number" : "UTR / reference number"} icon="barcode-outline" value={utr} onChangeText={setUtr} autoCapitalize="characters" placeholder="e.g. 412345678901" />}
                    <DateField label="Payment date" value={date} onChange={setDate} max={today()} />
                    <T v="overline" style={{ marginBottom: 10 }}>3 · Proof {needsProof ? "" : "(optional)"}</T>
                    {proof ? (
                      <Card>
                        <Row gap={12}>
                          {proof.type.startsWith("image") ? <Image source={{ uri: proof.uri }} style={st.preview} /> : <View style={[st.preview, { alignItems: "center", justifyContent: "center" }]}><Ionicons name="document" size={30} color={colors.primary} /></View>}
                          <View style={{ flex: 1 }}><T v="title" numberOfLines={1}>{proof.name}</T><T v="caption">Ready to upload</T></View>
                          <IconButton icon="close" size={34} onPress={() => setProof(null)} bg={colors.surfaceAlt} />
                        </Row>
                      </Card>
                    ) : (
                      <Row gap={10}>
                        {([["camera-outline", "Camera", "camera"], ["images-outline", "Gallery", "gallery"], ["document-attach-outline", "PDF", "pdf"]] as const).map(([icon, label, src]) => (
                          <Tap key={src} onPress={() => choose(src)} style={st.upload}>
                            <Ionicons name={icon} size={24} color={colors.primary} />
                            <T v="caption" style={{ marginTop: 6, color: colors.text, fontFamily: fonts.semibold }}>{label}</T>
                          </Tap>
                        ))}
                      </Row>
                    )}
                    <View style={{ height: 16 }} />
                    <Field label="Note to owner (optional)" value={notes} onChangeText={setNotes} multiline />
                    <Notice tone="info" icon="lock-closed" message="Your screenshot is stored privately and only your owner can view it. Re-using an old screenshot or reference is flagged automatically." />
                  </>
                )}
              </>
            )}
          </>
        )}
      </Loadable>
    </Screen>
  );
};

const PaymentSuccess = ({ payment, onDone }: { payment: any; onDone: () => void }) => {
  const s = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(s, { toValue: 1, friction: 4, useNativeDriver: true }).start(); }, []);
  return (
    <Screen scroll={false} contentStyle={{ alignItems: "center", justifyContent: "center", padding: 28 }}>
      <Animated.View style={[st.success, { transform: [{ scale: s }] }]}><Ionicons name="checkmark" size={64} color="#fff" /></Animated.View>
      <T v="h1" center style={{ marginTop: 28 }}>Payment submitted</T>
      <T v="body" center style={{ marginTop: 8 }}>{money(payment.amount)} is now waiting for your owner to verify. We'll notify you as soon as it's approved and your receipt is ready.</T>
      <View style={{ alignSelf: "stretch", marginTop: 32 }}><Button title="Done" onPress={onDone} /></View>
    </Screen>
  );
};

// ── Bills ──────────────────────────────────────────────────────────────────
export const TenantInvoicesScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<"OPEN" | "PAID">("OPEN");
  const q = useLoad(() => Tenant.invoices(tab), [tab]);
  return (
    <Screen header={<Header title="Bills" />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <Segmented value={tab} onChange={setTab} options={[{ label: "To pay", value: "OPEN" }, { label: "Paid", value: "PAID" }]} />
      <View style={{ height: 14 }} />
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload}>
        {!q.data?.length ? <EmptyState icon={tab === "OPEN" ? "happy-outline" : "receipt-outline"} title={tab === "OPEN" ? "No bills to pay" : "No paid bills yet"} />
          : <ListCard>{q.data.map((i) => <InvoiceRow key={i.id} inv={i} onPress={() => navigation.navigate("TenantInvoice", { id: i.id })} />)}</ListCard>}
      </Loadable>
    </Screen>
  );
};

export const TenantInvoiceScreen = ({ route, navigation }: any) => {
  const { id } = route.params;
  const q = useLoad(() => Tenant.invoice(id), [id]);
  const inv = q.data;
  const open = inv && !["PAID", "CANCELLED"].includes(inv.status);
  return (
    <Screen header={<Header title={inv?.invoice_number || "Bill"} right={inv ? <IconButton icon="download-outline" onPress={() => downloadPdf(`/tenant/invoices/${id}/pdf`, `${inv.invoice_number}.pdf`).catch((e) => toast.error(errorMessage(e)))} label="Download PDF" /> : undefined} />}
      refreshing={q.refreshing} onRefresh={q.refresh}
      footer={open && inv.balance > 0 ? <Button title={`Pay ${money(inv.balance)}`} icon="flash" onPress={() => navigation.navigate("Pay", { invoiceId: id })} /> : undefined}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload} skeleton="detail">
        {inv && (
          <>
            <Card>
              <Row between><Badge status={inv.status} /><T v="caption">{period(inv.month, inv.year)}</T></Row>
              <T v="amount" style={{ marginTop: 10 }} color={open ? colors.text : colors.success}>{money(open ? inv.balance : inv.total)}</T>
              <T v="small">{open ? `${relativeDue(inv.due_date)} · ${fmtDate(inv.due_date)}` : inv.status === "PAID" ? "Paid in full — thank you!" : "Cancelled"}</T>
            </Card>
            <SectionHeader title="Breakdown" />
            <Card><LineItems inv={inv} /><BillAttachments bills={(inv as any).utility_bills} onOpen={(u) => openLink(fileUrl(u)!)} /></Card>
            {inv.notes && <Notice tone="info" message={inv.notes} style={{ marginTop: 12 }} />}
            {!!inv.payments?.length && (
              <>
                <SectionHeader title="Your payments" />
                {inv.payments.map((p: any) => (
                  <Card key={p.id} style={{ marginBottom: 10 }}>
                    <Row between><T v="bodyStrong">{money(p.amount)}</T><Badge status={p.status} label={p.status === "PENDING" ? "In review" : undefined} small /></Row>
                    <T v="caption" style={{ marginTop: 4 }}>{titleCase(p.method)} · {fmtDate(p.payment_date)}{p.transaction_id ? ` · ${p.transaction_id}` : ""}</T>
                    {p.status === "REJECTED" && <Notice tone="danger" message={p.rejection_reason} style={{ marginTop: 10 }} />}
                    {p.status === "VERIFIED" && p.receipt_number && (
                      <Tap onPress={() => downloadPdf(`/tenant/payments/${p.id}/receipt`, `${p.receipt_number}.pdf`).catch((e) => toast.error(errorMessage(e)))} style={{ marginTop: 10 }}>
                        <T v="small" color={colors.primary} style={{ fontFamily: fonts.bold }}>⬇ Download receipt {p.receipt_number}</T>
                      </Tap>
                    )}
                  </Card>
                ))}
              </>
            )}
            {open && <><SectionHeader title="How to pay" /><PayToCard owner={inv.owner} /></>}
          </>
        )}
      </Loadable>
    </Screen>
  );
};

export const PaymentHistoryScreen = ({ navigation }: any) => {
  const q = useLoad(() => Tenant.payments(), []);
  const total = (q.data || []).filter((p) => p.status === "VERIFIED").reduce((s, p) => s + p.amount, 0);
  return (
    <Screen header={<Header title="Payment history" />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload}>
        <Card style={{ marginBottom: 14 }}><T v="caption">Total paid through RentLynk</T><T v="h2" color={colors.success}>{money(total)}</T></Card>
        {!q.data?.length ? <EmptyState icon="time-outline" title="No payments yet" /> : (
          <ListCard>{q.data.map((p) => <PaymentRow key={p.id} p={p} onPress={() => navigation.navigate("TenantInvoice", { id: p.invoice_id })} />)}</ListCard>
        )}
      </Loadable>
    </Screen>
  );
};

const st = StyleSheet.create({
  bill: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  billOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  upload: { flex: 1, height: 88, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#C7D2FE", backgroundColor: "#FAFAFF", alignItems: "center", justifyContent: "center" },
  preview: { width: 60, height: 60, borderRadius: 12, backgroundColor: colors.surfaceAlt },
  success: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
});

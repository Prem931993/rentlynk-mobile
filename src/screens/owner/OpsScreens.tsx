import React, { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { Header, Screen } from "../../components/Screen";
import { Badge, Button, Card, ChipGroup, EmptyState, FadeIn, GradientCard, IconButton, KeyValue, ListItem, Notice, Row, SectionHeader, Segmented, T, Tap } from "../../components/ui";
import { AmountField, DateField, Field, SelectField, Toggle } from "../../components/Inputs";
import { ListCard, Timeline } from "../../components/Domain";
import { Loadable } from "../../components/States";
import { confirm, Sheet, toast } from "../../components/Feedback";
import { colors, fonts, gradients, radius } from "../../theme";
import { Owner } from "../../api/endpoints";
import { errorMessage, fileUrl } from "../../api/client";
import { useLoad } from "../../utils/useLoad";
import { fmtDate, fmtDateTime, money, timeAgo, titleCase, today } from "../../utils/format";
import { haptic } from "../../utils/haptics";
import { downloadPdf } from "../../utils/files";

export const MOVE_STAGES = ["REQUESTED", "ACKNOWLEDGED", "SETTLEMENT_PROPOSED", "ACCEPTED", "COMPLETED"];
export const moveTimeline = (mo: any) => {
  const idx = mo.status === "DISPUTED" ? 2 : MOVE_STAGES.indexOf(mo.status);
  return [
    { title: "Notice given", subtitle: `By ${mo.initiated_by === "TENANT" ? "tenant" : "owner"} · move-out ${fmtDate(mo.planned_move_out_date)}`, time: fmtDate(mo.notice_date, false) },
    { title: "Acknowledged & inspection", subtitle: mo.inspection_date ? `Inspection on ${fmtDate(mo.inspection_date)}` : "Owner reviews and schedules inspection" },
    { title: mo.status === "DISPUTED" ? "Settlement disputed" : "Settlement proposed", subtitle: mo.status === "DISPUTED" ? `"${mo.tenant_response}"` : "Itemised deductions shared with tenant" },
    { title: "Tenant accepted", subtitle: "Both sides agree on the numbers" },
    { title: "Completed", subtitle: mo.completed_at ? `Refund recorded ${fmtDate(mo.completed_at)}` : "Refund paid, agreement closed, unit vacant" },
  ].map((s, i) => ({ ...s, done: i < idx || mo.status === "COMPLETED", active: i === idx && mo.status !== "COMPLETED" }));
};

export const SettlementSummary = ({ held, deductions, dues, refund, isLease }: { held: number; deductions: number; dues: number; refund: number; isLease?: boolean }) => (
  <Card>
    <KeyValue label={isLease ? "Lease amount held" : "Deposit held"} value={money(held)} />
    <KeyValue label="Deductions (charges)" value={`− ${money(deductions)}`} valueColor={colors.danger} />
    <KeyValue label={isLease ? "Pending dues" : "Pending rent & dues"} value={`− ${money(dues)}`} valueColor={colors.danger} />
    <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
    <Row between>
      <T v="title">{refund >= 0 ? "Refund to tenant" : "Tenant owes"}</T>
      <T v="h2" color={refund >= 0 ? colors.success : colors.danger}>{money(Math.abs(refund))}</T>
    </Row>
  </Card>
);

const CHARGE_CATS = ["PAINTING", "CLEANING", "REPAIRS", "DAMAGES", "KEY_REPLACEMENT", "UTILITIES", "PEST_CONTROL", "OTHER"] as const;

// ── Move-outs ──────────────────────────────────────────────────────────────
export const MoveOutsScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<"OPEN" | "ALL">("OPEN");
  const q = useLoad(() => Owner.moveOuts(tab === "OPEN" ? { status: "OPEN" } : undefined), [tab]);
  return (
    <Screen header={<Header title="Move-outs" />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <Segmented value={tab} onChange={setTab} options={[{ label: "In progress", value: "OPEN" }, { label: "All", value: "ALL" }]} />
      <View style={{ height: 14 }} />
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload}>
        {!q.data?.length ? <EmptyState icon="exit-outline" title="No move-outs" message="When a tenant gives notice or a lease ends, you'll manage inspection and the refund settlement here." /> : (
          <ListCard>
            {q.data.map((m: any) => (
              <ListItem key={m.id} icon="exit-outline" iconTone={m.status === "DISPUTED" ? "danger" : m.status === "COMPLETED" ? "success" : "warning"}
                title={m.tenant_name} subtitle={`${m.property_name} · ${m.unit_number} · out ${fmtDate(m.planned_move_out_date)}`}
                right={<Badge status={m.status} small />} onPress={() => navigation.navigate("MoveOutDetail", { id: m.id })} />
            ))}
          </ListCard>
        )}
      </Loadable>
    </Screen>
  );
};

export const MoveOutDetailScreen = ({ route, navigation }: any) => {
  const { id } = route.params;
  const q = useLoad(() => Owner.moveOut(id), [id]);
  const mo = q.data;
  const [charges, setCharges] = useState<{ category: string; description: string; amount: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [ackOpen, setAckOpen] = useState(false);
  const [inspection, setInspection] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [refundRef, setRefundRef] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!mo) return;
    const existing = (mo.charges || []).map((c: any) => ({ category: c.category, description: c.description, amount: String(c.amount) }));
    // First settlement: start from the painting estimate agreed in the lease.
    if (!existing.length && mo.lease?.painting_charge > 0 && ["REQUESTED", "ACKNOWLEDGED"].includes(mo.status)) {
      existing.push({ category: "PAINTING", description: "Painting (as per agreed estimate)", amount: String(mo.lease.painting_charge) });
    }
    setCharges(existing);
    setNotes(mo.inspection_notes || "");
  }, [mo?.id, mo?.status]);

  const editable = mo && ["REQUESTED", "ACKNOWLEDGED", "SETTLEMENT_PROPOSED", "DISPUTED"].includes(mo.status);
  const deductions = charges.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const held = mo?.live?.deposit_held ?? 0;
  const dues = mo?.live?.pending_dues ?? 0;
  const refund = held - deductions - dues;

  const run = async (fn: () => Promise<any>, msg: string) => {
    setBusy(true);
    try { await fn(); haptic.success(); toast.success(msg); q.reload(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const propose = () => {
    const clean = charges.filter((c) => Number(c.amount) > 0).map((c) => ({ category: c.category, description: c.description || titleCase(c.category), amount: Number(c.amount) }));
    run(() => Owner.proposeSettlement(id, { charges: clean, inspection_notes: notes || null }), "Settlement sent to tenant for review");
  };

  return (
    <Screen header={<Header title="Move-out" subtitle={mo?.lease ? `${mo.lease.tenant_name} · Unit ${mo.lease.unit_number}` : undefined} />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload} skeleton="detail">
        {mo && (
          <>
            <GradientCard colorsList={mo.status === "DISPUTED" ? gradients.sunset : gradients.hero}>
              <Row between><T v="overline" color="#BFD7F5">Planned move-out</T><Badge status={mo.status} /></Row>
              <T v="h1" color="#fff" style={{ marginTop: 6 }}>{fmtDate(mo.planned_move_out_date)}</T>
              <T v="small" color="rgba(226,232,255,0.8)">Notice on {fmtDate(mo.notice_date)}{mo.reason ? ` · "${mo.reason}"` : ""}</T>
              {mo.short_notice && <View style={{ marginTop: 10 }}><Badge label="Shorter than notice / lock-in period" tone="warning" icon="warning" /></View>}
            </GradientCard>

            {mo.status === "DISPUTED" && <Notice tone="danger" title="Tenant disputed the settlement" message={mo.tenant_response} style={{ marginTop: 14 }} />}

            {["SETTLEMENT_PROPOSED", "ACCEPTED", "DISPUTED", "COMPLETED"].includes(mo.status) && (
              <Button title="Download settlement statement (PDF)" variant="secondary" icon="download-outline" size="md" style={{ marginTop: 14 }}
                onPress={() => downloadPdf(`/owner/move-outs/${id}/pdf`, `settlement-${mo.lease?.lease_number || id}.pdf`).catch((e) => toast.error(errorMessage(e)))} />
            )}
            <SectionHeader title="Progress" />
            <Card><Timeline items={moveTimeline(mo)} /></Card>

            {mo.status === "REQUESTED" && (
              <Button title="Acknowledge & schedule inspection" icon="calendar-outline" onPress={() => setAckOpen(true)} style={{ marginTop: 16 }} />
            )}

            {editable && (
              <>
                <SectionHeader title="Charges before vacating" action="+ Add charge" onAction={() => setCharges((c) => [...c, { category: "PAINTING", description: "", amount: "" }])} />
                {!charges.length && <Notice tone="info" message="Add painting, cleaning, repairs or other deductions found during inspection. Leave empty for a full refund." style={{ marginBottom: 12 }} />}
                {charges.map((c, i) => (
                  <Card key={i} style={{ marginBottom: 10 }}>
                    <Row between style={{ marginBottom: 8 }}>
                      <View style={{ flex: 1 }}><SelectField value={c.category} onChange={(v) => setCharges((a) => a.map((x, k) => (k === i ? { ...x, category: v } : x)))} options={CHARGE_CATS.map((x) => ({ label: titleCase(x), value: x }))} /></View>
                      <IconButton icon="trash-outline" size={36} color={colors.danger} bg={colors.dangerSoft} onPress={() => setCharges((a) => a.filter((_, k) => k !== i))} />
                    </Row>
                    <Field label="What for" value={c.description} onChangeText={(t) => setCharges((a) => a.map((x, k) => (k === i ? { ...x, description: t } : x)))} placeholder="e.g. Repaint living room walls" />
                    <AmountField label="Amount" value={c.amount} onChange={(v) => setCharges((a) => a.map((x, k) => (k === i ? { ...x, amount: v } : x)))} />
                  </Card>
                ))}
                <Field label="Inspection notes (shared with tenant)" value={notes} onChangeText={setNotes} multiline />
                <SettlementSummary held={held} deductions={deductions} dues={dues} refund={refund} isLease={mo.lease?.agreement_type === "LEASE"} />
                <Button title={mo.status === "SETTLEMENT_PROPOSED" || mo.status === "DISPUTED" ? "Send revised settlement" : "Send settlement to tenant"} icon="paper-plane-outline" onPress={propose} loading={busy} style={{ marginTop: 14 }} />
              </>
            )}

            {mo.status === "ACCEPTED" && (
              <>
                <SectionHeader title="Agreed settlement" />
                <SettlementSummary held={mo.deposit_held} deductions={mo.total_deductions} dues={mo.pending_dues} refund={mo.refund_amount} isLease={mo.lease?.agreement_type === "LEASE"} />
                <Notice tone="success" message="The tenant accepted. Pay the refund, then complete the move-out to close the agreement and free the unit." style={{ marginTop: 12 }} />
                <Button title="Complete move-out" variant="success" icon="checkmark-done" onPress={() => setCompleteOpen(true)} style={{ marginTop: 14 }} />
              </>
            )}

            {mo.status === "COMPLETED" && (
              <>
                <SectionHeader title="Final settlement" />
                <SettlementSummary held={mo.deposit_held} deductions={mo.total_deductions} dues={mo.pending_dues} refund={mo.refund_amount} isLease={mo.lease?.agreement_type === "LEASE"} />
                {mo.refund_reference && <Notice tone="success" message={`Refund reference: ${mo.refund_reference}`} style={{ marginTop: 12 }} />}
              </>
            )}

            {!!mo.charges?.length && !editable && (
              <>
                <SectionHeader title="Itemised charges" />
                <ListCard>{mo.charges.map((c: any) => <ListItem key={c.id} icon="pricetag-outline" title={c.description} subtitle={titleCase(c.category)} right={<T v="bodyStrong">{money(c.amount)}</T>} />)}</ListCard>
              </>
            )}

            {["REQUESTED", "ACKNOWLEDGED"].includes(mo.status) && (
              <Button title="Withdraw move-out" variant="ghost" onPress={async () => { if (await confirm({ title: "Withdraw this move-out?", message: "The agreement continues as normal.", confirm: "Withdraw", danger: true })) run(() => Owner.cancelMoveOut(id), "Move-out withdrawn"); }} style={{ marginTop: 18 }} />
            )}

            <Sheet visible={ackOpen} onClose={() => setAckOpen(false)} title="Acknowledge notice" footer={<Button title="Acknowledge" onPress={() => { setAckOpen(false); run(() => Owner.acknowledgeMoveOut(id, { inspection_date: inspection }), "Tenant notified"); }} />}>
              <DateField label="Inspection date (optional)" value={inspection} onChange={setInspection} min={today()} />
            </Sheet>
            <Sheet visible={completeOpen} onClose={() => setCompleteOpen(false)} title="Complete move-out"
              footer={<Button title="Close agreement" variant="success" loading={busy} onPress={() => { setCompleteOpen(false); run(() => Owner.completeMoveOut(id, { refund_reference: refundRef || null }), "Lease closed. Unit is vacant."); }} />}>
              <Notice tone="info" message={`We'll adjust pending dues against the ${mo?.lease?.agreement_type === "LEASE" ? "lease amount" : "deposit"}, record deductions and the refund in the ledger, end the agreement and mark the unit vacant.`} style={{ marginBottom: 14 }} />
              <Field label="Refund reference (UTR / cheque)" value={refundRef} onChangeText={setRefundRef} />
            </Sheet>
          </>
        )}
      </Loadable>
    </Screen>
  );
};

// ── Maintenance ────────────────────────────────────────────────────────────
export const OwnerMaintenanceScreen = ({ navigation }: any) => {
  const [status, setStatus] = useState("OPEN");
  const q = useLoad(() => Owner.maintenance({ status: status || undefined }), [status]);
  return (
    <Screen header={<Header title="Repair requests" />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <ChipGroup value={status} onChange={setStatus} options={[{ label: "Open", value: "OPEN" }, { label: "Resolved", value: "RESOLVED" }, { label: "Closed", value: "CLOSED" }, { label: "All", value: "" }]} />
      <View style={{ height: 14 }} />
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload}>
        {!q.data?.length ? <EmptyState icon="construct-outline" title="Nothing to fix" message="Repair requests from your tenants appear here." /> : (
          <ListCard>
            {q.data.map((m: any) => (
              <ListItem key={m.id} icon="construct-outline" iconTone={m.priority === "URGENT" ? "danger" : m.priority === "HIGH" ? "warning" : "info"}
                title={m.title} subtitle={`${m.tenant_name} · ${m.property_name} ${m.unit_number} · ${timeAgo(m.created_at)}`}
                right={<Badge status={m.status} small />} onPress={() => navigation.navigate("OwnerMaintenanceDetail", { id: m.id })} />
            ))}
          </ListCard>
        )}
      </Loadable>
    </Screen>
  );
};

export const OwnerMaintenanceDetailScreen = ({ route }: any) => {
  const { id } = route.params;
  const q = useLoad(() => Owner.maintenanceItem(id), [id]);
  const m = q.data;
  const [status, setStatus] = useState<string>("IN_PROGRESS");
  const [message, setMessage] = useState("");
  const [cost, setCost] = useState("");
  const [borne, setBorne] = useState<"OWNER" | "TENANT">("OWNER");
  const [bill, setBill] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (m) setStatus(m.status === "OPEN" ? "IN_PROGRESS" : m.status === "IN_PROGRESS" ? "RESOLVED" : m.status); }, [m?.status]);
  const save = async () => {
    setSaving(true);
    try {
      await Owner.updateMaintenance(id, { status, message: message || null, cost: cost ? Number(cost) : undefined, cost_borne_by: cost ? borne : undefined, bill_tenant: bill && borne === "TENANT" });
      toast.success("Update sent to tenant"); setMessage(""); q.reload();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Screen header={<Header title={m?.ticket_number || "Request"} />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload} skeleton="detail">
        {m && (
          <>
            <Card>
              <Row gap={8}><Badge status={m.status} /><Badge status={m.priority} label={titleCase(m.priority)} /><Badge label={titleCase(m.category)} tone="neutral" /></Row>
              <T v="h2" style={{ marginTop: 10 }}>{m.title}</T>
              <T v="body" style={{ marginTop: 6 }}>{m.description}</T>
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
              <KeyValue label="Tenant" value={`${m.tenant_name}${m.tenant_phone ? ` · ${m.tenant_phone}` : ""}`} />
              <KeyValue label="Unit" value={`${m.property_name} · ${m.unit_number}`} />
              {m.preferred_visit_date && <KeyValue label="Preferred visit" value={fmtDate(m.preferred_visit_date)} />}
              {m.cost != null && <KeyValue label="Cost" value={`${money(m.cost)} · ${titleCase(m.cost_borne_by)}`} />}
              {m.rating && <KeyValue label="Tenant rating" value={"★".repeat(m.rating)} valueColor={colors.warning} />}
            </Card>
            {!!m.image_urls?.length && (
              <ScrollView horizontal style={{ marginTop: 14 }} contentContainerStyle={{ gap: 10 }} showsHorizontalScrollIndicator={false}>
                {m.image_urls.map((u: string) => <Image key={u} source={{ uri: fileUrl(u)! }} style={st.photo} />)}
              </ScrollView>
            )}
            <SectionHeader title="Activity" />
            <Card><Timeline items={m.updates.map((u: any) => ({ title: u.message, subtitle: `${u.user_name || "System"}${u.status ? ` · ${titleCase(u.status)}` : ""}`, time: timeAgo(u.created_at), done: true }))} /></Card>
            {m.status !== "CLOSED" && (
              <>
                <SectionHeader title="Update tenant" />
                <Card>
                  <View style={{ marginBottom: 14 }}><ChipGroup value={status} onChange={setStatus} options={[{ label: "In progress", value: "IN_PROGRESS" }, { label: "Resolved", value: "RESOLVED" }, { label: "Can't fix", value: "REJECTED" }]} /></View>
                  <Field label="Message" value={message} onChangeText={setMessage} multiline placeholder="e.g. Electrician visiting tomorrow 10–12" />
                  {status === "RESOLVED" && (
                    <>
                      <AmountField label="Repair cost (optional)" value={cost} onChange={setCost} />
                      {!!cost && (
                        <>
                          <View style={{ marginBottom: 12 }}><Segmented value={borne} onChange={setBorne} options={[{ label: "I'll pay", value: "OWNER" }, { label: "Tenant pays", value: "TENANT" }]} /></View>
                          {borne === "TENANT" && <Row between style={{ marginBottom: 14 }}><T v="title">Raise invoice to tenant</T><Toggle value={bill} onChange={setBill} /></Row>}
                        </>
                      )}
                    </>
                  )}
                  <Button title="Send update" icon="send" onPress={save} loading={saving} size="md" />
                </Card>
              </>
            )}
          </>
        )}
      </Loadable>
    </Screen>
  );
};

// ── Notices / announcements ────────────────────────────────────────────────
export const AnnouncementsScreen = () => {
  const q = useLoad(() => Owner.announcements(), []);
  const props = useLoad(() => Owner.properties(), []);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ property_id: "", title: "", body: "", priority: "NORMAL" });
  const [saving, setSaving] = useState(false);
  const send = async () => {
    if (f.title.trim().length < 3 || f.body.trim().length < 5) return toast.error("Add a title and message");
    setSaving(true);
    try { await Owner.createAnnouncement({ ...f, property_id: f.property_id || null }); toast.success("Notice sent"); setOpen(false); setF({ property_id: "", title: "", body: "", priority: "NORMAL" }); q.reload(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Screen header={<Header title="Notices" right={<IconButton icon="add" bg={colors.primary} color="#fff" onPress={() => setOpen(true)} />} />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload}>
        {!q.data?.length ? <EmptyState icon="megaphone-outline" title="No notices yet" message="Send building updates — water cuts, maintenance, rule changes — to all your tenants at once." action="Send a notice" onAction={() => setOpen(true)} /> : (
          q.data.map((a: any, i: number) => (
            <FadeIn key={a.id} delay={i * 40}>
              <Card style={{ marginBottom: 12 }}>
                <Row between><Badge label={a.property_name || "All properties"} tone="primary" small />{a.priority === "IMPORTANT" && <Badge label="Important" tone="danger" small />}</Row>
                <T v="h3" style={{ marginTop: 8 }}>{a.title}</T>
                <T v="body" style={{ marginTop: 4 }}>{a.body}</T>
                <Row between style={{ marginTop: 10 }}>
                  <T v="caption">{fmtDateTime(a.created_at)}</T>
                  <Tap onPress={async () => { if (await confirm({ title: "Delete notice?", danger: true, confirm: "Delete" })) { await Owner.deleteAnnouncement(a.id); q.reload(); } }}>
                    <T v="caption" color={colors.danger} style={{ fontFamily: fonts.bold }}>Delete</T>
                  </Tap>
                </Row>
              </Card>
            </FadeIn>
          ))
        )}
      </Loadable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="New notice" footer={<Button title="Send to tenants" icon="megaphone" onPress={send} loading={saving} />}>
        <SelectField label="Send to" value={f.property_id} onChange={(v) => setF({ ...f, property_id: v })}
          options={[{ label: "All my tenants", value: "" }, ...(props.data || []).map((p: any) => ({ label: p.name, value: p.id }))]} />
        <Field label="Title" value={f.title} onChangeText={(t) => setF({ ...f, title: t })} placeholder="Water supply off on Sunday" />
        <Field label="Message" value={f.body} onChangeText={(t) => setF({ ...f, body: t })} multiline />
        <Row between><T v="title">Mark as important</T><Toggle value={f.priority === "IMPORTANT"} onChange={(v) => setF({ ...f, priority: v ? "IMPORTANT" : "NORMAL" })} /></Row>
      </Sheet>
    </Screen>
  );
};

const st = StyleSheet.create({
  photo: { width: 140, height: 110, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
});

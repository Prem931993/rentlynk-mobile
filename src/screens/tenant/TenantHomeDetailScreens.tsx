import { callPhone, openLink, openWhatsApp, sendEmail } from "../../utils/links";
import React, { useState } from "react";
import { Dimensions, Image, Linking, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header, Screen } from "../../components/Screen";
import { Badge, Button, Card, EmptyState, FadeIn, IconBubble, IconButton, IconName, KeyValue, ListItem, Notice, Row, SectionHeader, Segmented, T, Tap } from "../../components/ui";
import { DateField, Field } from "../../components/Inputs";
import { ListCard, Timeline } from "../../components/Domain";
import { Loadable } from "../../components/States";
import { confirm, toast } from "../../components/Feedback";
import { colors, fonts, gradients, radius } from "../../theme";
import { Tenant } from "../../api/endpoints";
import { errorMessage, fileUrl } from "../../api/client";
import { useLoad } from "../../utils/useLoad";
import { addDays, daysUntil, fmtDate, fmtDateTime, money, monthYear, period, timeAgo, titleCase, today } from "../../utils/format";
import { appendFile, downloadPdf, pickDocument, pickImage, PickedFile } from "../../utils/files";
import { haptic } from "../../utils/haptics";
import { JoinHomeCard } from "./TenantHomeScreen";
import { moveTimeline, SettlementSummary } from "../owner/OpsScreens";

const { width } = Dimensions.get("window");

// ── My home ────────────────────────────────────────────────────────────────
export const MyHomeScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const q = useLoad(() => Tenant.lease().catch((e) => { if (e?.response?.status === 404) return null; throw e; }), []);
  const l = q.data;
  const [tab, setTab] = useState<"lease" | "bills" | "deposit" | "docs">("lease");
  const [ack, setAck] = useState(false);
  const isL = l?.agreement_type === "LEASE";
  const heldWord = isL ? "lease amount" : "deposit";
  const monthly = l ? (isL ? 0 : Number(l.rent_amount)) + Number(l.maintenance_charge || 0) : 0;

  const acknowledge = async () => {
    setAck(true);
    try { await Tenant.acknowledgeLease(); haptic.success(); toast.success("Agreement terms acknowledged"); q.reload(); } catch (e) { toast.error(errorMessage(e)); } finally { setAck(false); }
  };
  const upload = async () => {
    try {
      const f = await pickDocument();
      if (!f) return;
      const form = new FormData();
      await appendFile(form, "file", f);
      form.append("title", f.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Document");
      form.append("category", "ID_PROOF");
      await Tenant.uploadDocument(form);
      toast.success("Shared with your owner"); q.reload();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  if (!q.loading && !l && !q.error) {
    return (
      <Screen header={<Header back={false} title="My home" />}>
        <EmptyState icon="home-outline" title="No home linked yet" message="Ask your owner to add you, or enter the invite code they shared." />
        <JoinHomeCard onJoined={q.reload} />
      </Screen>
    );
  }

  const image = l?.images?.[0] ? fileUrl(l.images[0]) : fileUrl(l?.property_cover);
  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 240 }}>
          {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} /> : <LinearGradient colors={gradients.emerald} style={StyleSheet.absoluteFill} />}
          <LinearGradient colors={["rgba(6,78,59,0.35)", "rgba(11,16,38,0.85)"]} style={StyleSheet.absoluteFill} />
          {l && (
            <View style={{ position: "absolute", left: 20, right: 20, bottom: 40 }}>
              <Badge status={l.status} />
              <T v="h1" color="#fff" style={{ marginTop: 8 }}>{l.property_name}</T>
              <T v="small" color="rgba(255,255,255,0.85)">Unit {l.unit_number} · {l.address}, {l.city}</T>
            </View>
          )}
        </View>
        <View style={st.body}>
          <Loadable loading={q.loading} error={q.error} onRetry={q.reload} skeleton="detail">
            {l && (
              <>
                {!l.tenant_acknowledged_at && (
                  <Notice tone="warning" title={isL ? "Please review your lease" : "Please review your rental agreement"} message={isL ? "Check the lease amount, period, notice and terms below, then confirm." : "Check the rent, deposit, notice period and terms below, then confirm."} style={{ marginBottom: 14 }} />
                )}
                {l.upcoming_rent && daysUntil(l.upcoming_rent.effective_date) <= 45 && (
                  <Notice tone="info" icon="trending-up" title="Rent revision coming up" style={{ marginBottom: 14 }}
                    message={`As per your rental agreement, rent changes from ${money(l.rent_amount)} to ${money(l.upcoming_rent.amount)} on ${fmtDate(l.upcoming_rent.effective_date)}.`} />
                )}
                {isL ? (
                  <Row gap={10}>
                    <Card style={st.mini}><T v="caption">Lease</T><T v="h3">{money(l.deposit.held, { compact: true })}</T></Card>
                    <Card style={st.mini}><T v="caption">Ends</T><T v="h3" numberOfLines={1}>{monthYear(l.end_date)}</T></Card>
                    <Card style={st.mini}><T v="caption">Refund est.</T><T v="h3" color={colors.success}>{money(l.deposit_health?.refund_estimate ?? l.deposit.held, { compact: true })}</T></Card>
                  </Row>
                ) : (
                  <Row gap={10}>
                    <Card style={st.mini}><T v="caption">Rent</T><T v="h3">{money(l.rent_amount)}</T></Card>
                    <Card style={st.mini}><T v="caption">Due on</T><T v="h3">{l.rent_due_day}<T v="caption"> monthly</T></T></Card>
                    <Card style={st.mini}><T v="caption">Deposit</T><T v="h3">{money(l.deposit.held, { compact: true })}</T></Card>
                  </Row>
                )}
                <View style={{ marginTop: 16 }}>
                  <Segmented value={tab} onChange={setTab} options={[{ label: "Terms", value: "lease" }, { label: "Bills", value: "bills" }, { label: isL ? "Amount" : "Deposit", value: "deposit" }, { label: "Docs", value: "docs" }]} />
                </View>

                {tab === "lease" && (
                  <>
                    <Card style={{ marginTop: 14 }}>
                      <KeyValue icon="document-text-outline" label="Agreement" value={`${isL ? "Lease" : "Monthly rental"} · ${l.lease_number}`} />
                      <KeyValue icon="calendar-outline" label="Period" value={`${fmtDate(l.start_date)} → ${l.end_date ? fmtDate(l.end_date) : "Open-ended"}`} />
                      {isL && <KeyValue icon="wallet-outline" label="Lease amount" value={money(l.security_deposit)} />}
                      <KeyValue icon="build-outline" label="Maintenance" value={l.maintenance_charge > 0 ? `${money(l.maintenance_charge)}/mo` : "None"} />
                      {monthly > 0 && <KeyValue icon="time-outline" label="Grace period" value={`${l.grace_period_days} days`} />}
                      {monthly > 0 && <KeyValue icon="trending-up-outline" label="Late fee" value={l.late_fee_per_day ? `${money(l.late_fee_per_day)}/day` : "None"} />}
                      <KeyValue icon="exit-outline" label="Notice period" value={`${l.notice_period_days} days`} />
                      <KeyValue icon="lock-closed-outline" label="Lock-in" value={l.lock_in_months ? `${l.lock_in_months} months` : "None"} />
                      <KeyValue icon="flash-outline" label="Electricity" value={titleCase(l.electricity_billing)} />
                      <KeyValue icon="water-outline" label="Water" value={titleCase(l.water_billing)} />
                      {!isL && <KeyValue icon="trending-up-outline" label="Yearly increase" value={l.escalation_type === "PERCENT" ? `${l.escalation_value}%` : l.escalation_type === "FIXED" ? money(l.escalation_value) : "None"} />}
                      {!!l.painting_charge && <KeyValue icon="color-palette-outline" label="Painting at move-out" value={`≈ ${money(l.painting_charge)}`} />}
                    </Card>
                    {l.agreement_terms && (<><SectionHeader title="Agreement terms" /><Card><T v="body">{l.agreement_terms}</T></Card></>)}
                    {l.house_rules && (<><SectionHeader title="House rules" /><Card><T v="body">{l.house_rules}</T></Card></>)}
                    {!!(l.property_amenities?.length || l.unit_amenities?.length) && (
                      <>
                        <SectionHeader title="Amenities" />
                        <Row wrap gap={8}>{[...(l.unit_amenities || []), ...(l.property_amenities || [])].map((a: string) => <Badge key={a} label={a} tone="success" icon="checkmark" />)}</Row>
                      </>
                    )}
                    <SectionHeader title="Your owner" />
                    <Card>
                      <T v="title">{l.owner.name}</T>
                      <T v="caption">{l.owner.email}</T>
                      <Row gap={10} style={{ marginTop: 12 }}>
                        {l.owner.phone && <View style={{ flex: 1 }}><Button title="Call" icon="call" size="sm" variant="secondary" onPress={() => callPhone(l.owner.phone)} /></View>}
                        <View style={{ flex: 1 }}><Button title="Email" icon="mail" size="sm" variant="secondary" onPress={() => sendEmail(l.owner.email)} /></View>
                      </Row>
                    </Card>
                    {!l.tenant_acknowledged_at && <Button title="I've reviewed the terms" icon="checkmark-done" onPress={acknowledge} loading={ack} style={{ marginTop: 18 }} />}
                    {l.status === "ACTIVE" && <Button title="Give notice / move out" variant="ghost" icon="exit-outline" onPress={() => navigation.navigate("MoveOut")} style={{ marginTop: 12 }} />}
                  </>
                )}

                {tab === "bills" && (
                  <>
                    <SectionHeader title="Electricity & utility bills" />
                    {l.utility_bills?.length ? (
                      <ListCard>
                        {l.utility_bills.map((b: any) => (
                          <ListItem key={b.id} icon={b.type === "ELECTRICITY" ? "flash-outline" : b.type === "WATER" ? "water-outline" : "flame-outline"} iconTone="warning"
                            title={`${period(b.bill_month, b.bill_year)} · ${money(b.amount)}`} subtitle={`${b.label}${b.status === "PENDING" ? " · added to that month's invoice" : ""}`}
                            onPress={() => b.file_url && openLink(fileUrl(b.file_url)!)} right={b.file_url ? <T v="small" color={colors.primary} style={{ fontFamily: fonts.bold }}>View</T> : undefined} />
                        ))}
                      </ListCard>
                    ) : <EmptyState icon="flash-outline" title="No bills yet" message={l.electricity_billing === "METERED" ? `Your owner uploads the electricity bill ${l.electricity_cycle_months > 1 ? `every ${l.electricity_cycle_months} months` : "monthly"} — ${monthly > 0 ? "it's added to your invoice for that month." : "you'll get it as a bill to pay in the app."}` : "Utility bills added by your owner will appear here."} />}
                  </>
                )}

                {tab === "deposit" && (
                  <>
                    <Card style={{ marginTop: 14 }}>
                      <Row between>
                        <View><T v="caption">Held by owner</T><T v="h2" color={colors.success}>{money(l.deposit.held)}</T></View>
                        <View style={{ alignItems: "flex-end" }}><T v="caption">Agreed</T><T v="h3">{money(l.deposit.agreed)}</T></View>
                      </Row>
                      {l.deposit.pending > 0 && <Notice tone="warning" message={`${money(l.deposit.pending)} of your ${heldWord} is still to be paid.`} style={{ marginTop: 12 }} />}
                      <T v="caption" style={{ marginTop: 12 }}>{isL
                        ? `Your lease amount is refunded when the lease ends${l.end_date ? ` (${fmtDate(l.end_date)})` : ""}. Only itemised deductions you agree to — such as painting or damages — and unpaid bills are taken out.`
                        : "Your deposit is refundable. Any deductions at move-out must be itemised and agreed by you. See the Rental & Deposit Policy in Help."}</T>
                    </Card>
                    {l.deposit_health && l.deposit_health.dues > 0 && (
                      <Notice tone={l.deposit_health.at_risk ? "danger" : "warning"} style={{ marginTop: 12 }}
                        title={l.deposit_health.at_risk ? `Your ${heldWord} is almost used up` : "Unpaid dues reduce your refund"}
                        message={`Unpaid dues of ${money(l.deposit_health.dues)}${l.deposit_health.painting ? ` plus the painting estimate of ${money(l.deposit_health.painting)}` : ""} leave ${money(Math.max(0, l.deposit_health.cover))} of your ${heldWord}. Clear your bills to protect your refund.`}
                        action="Pay now" onAction={() => navigation.navigate("Pay")} />
                    )}
                    <SectionHeader title={isL ? "Lease amount history" : "Deposit history"} />
                    {l.deposit.ledger.length ? (
                      <ListCard>
                        {l.deposit.ledger.map((d: any) => (
                          <ListItem key={d.id} icon={d.type === "RECEIVED" ? "arrow-up-circle-outline" : d.type === "REFUND" ? "arrow-down-circle-outline" : "remove-circle-outline"}
                            iconTone={d.type === "RECEIVED" ? "primary" : d.type === "REFUND" ? "success" : "danger"}
                            title={d.description || titleCase(d.type)} subtitle={`${titleCase(d.type)} · ${fmtDate(d.transaction_date)}`}
                            right={<T v="bodyStrong">{money(d.amount)}</T>} />
                        ))}
                      </ListCard>
                    ) : <EmptyState icon="wallet-outline" title="No entries yet" />}
                  </>
                )}

                {tab === "docs" && (
                  <>
                    <SectionHeader title="Documents" action={l.status !== "ENDED" ? "+ Share" : undefined} onAction={upload} />
                    {l.documents.length ? (
                      <ListCard>
                        {l.documents.map((d: any) => (
                          <ListItem key={d.id} icon={d.mime_type === "application/pdf" ? "document-outline" : "image-outline"} title={d.title}
                            subtitle={`${titleCase(d.category)} · ${fmtDate(d.created_at)}`} onPress={() => d.url && openLink(fileUrl(d.url)!)} />
                        ))}
                      </ListCard>
                    ) : <EmptyState icon="folder-open-outline" title="No documents yet" message="Your agreement and other files appear here. You can share your ID proof with your owner securely." action="Share a document" onAction={upload} />}
                  </>
                )}
              </>
            )}
          </Loadable>
        </View>
      </ScrollView>
    </Screen>
  );
};

// ── Maintenance ────────────────────────────────────────────────────────────
const CATS: { value: string; label: string; icon: IconName }[] = [
  { value: "PLUMBING", label: "Plumbing", icon: "water-outline" }, { value: "ELECTRICAL", label: "Electrical", icon: "flash-outline" },
  { value: "APPLIANCE", label: "Appliance", icon: "tv-outline" }, { value: "CARPENTRY", label: "Carpentry", icon: "hammer-outline" },
  { value: "PAINTING", label: "Painting", icon: "color-palette-outline" }, { value: "PEST_CONTROL", label: "Pests", icon: "bug-outline" },
  { value: "CLEANING", label: "Cleaning", icon: "sparkles-outline" }, { value: "SECURITY", label: "Locks", icon: "key-outline" },
  { value: "INTERNET", label: "Internet", icon: "wifi-outline" }, { value: "OTHER", label: "Other", icon: "ellipsis-horizontal" },
];

export const TenantMaintenanceScreen = ({ navigation }: any) => {
  const q = useLoad(() => Tenant.maintenance(), []);
  const open = (q.data || []).filter((m: any) => ["OPEN", "IN_PROGRESS"].includes(m.status));
  const past = (q.data || []).filter((m: any) => !["OPEN", "IN_PROGRESS"].includes(m.status));
  const row = (m: any) => (
    <ListItem key={m.id} icon={(CATS.find((c) => c.value === m.category)?.icon || "construct-outline") as IconName} iconTone={m.status === "RESOLVED" || m.status === "CLOSED" ? "success" : m.priority === "URGENT" ? "danger" : "info"}
      title={m.title} subtitle={`${m.ticket_number} · ${timeAgo(m.created_at)}`} right={<Badge status={m.status} small />} onPress={() => navigation.navigate("TenantMaintenanceDetail", { id: m.id })} />
  );
  return (
    <Screen header={<Header back={false} title="Requests" right={<IconButton icon="add" bg={colors.primary} color="#fff" onPress={() => navigation.navigate("NewMaintenance")} label="New request" />} />}
      refreshing={q.refreshing} onRefresh={q.refresh}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload}>
        {!q.data?.length ? <EmptyState icon="construct-outline" title="Everything working?" message="If something breaks — a leak, a fan, a lock — report it here with photos and track it until it's fixed." action="Report an issue" onAction={() => navigation.navigate("NewMaintenance")} /> : (
          <>
            {!!open.length && <><T v="overline" style={{ marginBottom: 10 }}>Open</T><ListCard>{open.map(row)}</ListCard></>}
            {!!past.length && <><T v="overline" style={{ marginTop: 20, marginBottom: 10 }}>Past</T><ListCard>{past.map(row)}</ListCard></>}
          </>
        )}
      </Loadable>
    </Screen>
  );
};

export const NewMaintenanceScreen = ({ navigation }: any) => {
  const [category, setCategory] = useState("PLUMBING");
  const [priority, setPriority] = useState("MEDIUM");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [visit, setVisit] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PickedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const add = async (camera: boolean) => {
    try { const imgs = await pickImage({ camera, multiple: !camera }); setPhotos((p) => [...p, ...imgs].slice(0, 4)); } catch (e) { toast.error(errorMessage(e)); }
  };
  const submit = async () => {
    if (title.trim().length < 3) return toast.error("Add a short title");
    if (desc.trim().length < 5) return toast.error("Describe the problem");
    setSaving(true);
    try {
      const form = new FormData();
      form.append("title", title.trim()); form.append("description", desc.trim()); form.append("category", category); form.append("priority", priority);
      if (visit) form.append("preferred_visit_date", visit);
      for (const p of photos) await appendFile(form, "images", p);
      const r = await Tenant.createMaintenance(form);
      haptic.success(); toast.success("Request sent to your owner");
      navigation.replace("TenantMaintenanceDetail", { id: r.id });
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Screen header={<Header title="Report an issue" />} footer={<Button title="Send request" icon="send" onPress={submit} loading={saving} />}>
      <T v="overline" style={{ marginBottom: 10 }}>What's the problem?</T>
      <View style={st.catGrid}>
        {CATS.map((c) => (
          <Tap key={c.value} onPress={() => setCategory(c.value)} style={[st.cat, category === c.value && st.catOn]}>
            <Ionicons name={c.icon} size={22} color={category === c.value ? colors.primary : colors.textSecondary} />
            <T v="caption" style={{ marginTop: 4, color: category === c.value ? colors.primary : colors.textSecondary, fontFamily: fonts.semibold }}>{c.label}</T>
          </Tap>
        ))}
      </View>
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Bathroom tap leaking" />
      <Field label="Details" value={desc} onChangeText={setDesc} multiline placeholder="Where is it, since when, how bad?" />
      <T v="overline" style={{ marginBottom: 10 }}>How urgent?</T>
      <View style={{ marginBottom: 16 }}>
        <Segmented value={priority} onChange={setPriority} options={[{ label: "Low", value: "LOW" }, { label: "Normal", value: "MEDIUM" }, { label: "High", value: "HIGH" }, { label: "Urgent", value: "URGENT" }]} />
      </View>
      <DateField label="Preferred visit date (optional)" value={visit} onChange={setVisit} min={today()} />
      <T v="overline" style={{ marginBottom: 10 }}>Photos ({photos.length}/4)</T>
      <Row gap={10} wrap>
        {photos.map((p, i) => (
          <View key={i}>
            <Image source={{ uri: p.uri }} style={st.photo} />
            <Tap onPress={() => setPhotos((a) => a.filter((_, k) => k !== i))} style={st.photoX}><Ionicons name="close" size={14} color="#fff" /></Tap>
          </View>
        ))}
        {photos.length < 4 && (
          <>
            <Tap onPress={() => add(true)} style={[st.photo, st.addPhoto]}><Ionicons name="camera-outline" size={24} color={colors.primary} /></Tap>
            <Tap onPress={() => add(false)} style={[st.photo, st.addPhoto]}><Ionicons name="images-outline" size={24} color={colors.primary} /></Tap>
          </>
        )}
      </Row>
    </Screen>
  );
};

export const TenantMaintenanceDetailScreen = ({ route }: any) => {
  const { id } = route.params;
  const q = useLoad(() => Tenant.maintenanceItem(id), [id]);
  const m = q.data;
  const [msg, setMsg] = useState("");
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const send = async (close = false) => {
    if (!close && !msg.trim()) return;
    setBusy(true);
    try { await Tenant.commentMaintenance(id, { message: msg.trim() || null, close, rating: close && rating ? rating : undefined }); setMsg(""); toast.success(close ? "Request closed — thanks!" : "Message sent"); q.reload(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Screen header={<Header title={m?.ticket_number || "Request"} />} refreshing={q.refreshing} onRefresh={q.refresh} keyboard>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload} skeleton="detail">
        {m && (
          <>
            <Card>
              <Row gap={8}><Badge status={m.status} /><Badge label={titleCase(m.priority)} status={m.priority} /></Row>
              <T v="h2" style={{ marginTop: 10 }}>{m.title}</T>
              <T v="body" style={{ marginTop: 6 }}>{m.description}</T>
              {m.cost != null && <KeyValue label="Repair cost" value={`${money(m.cost)} · paid by ${m.cost_borne_by === "TENANT" ? "you" : "owner"}`} />}
            </Card>
            {!!m.image_urls?.length && (
              <ScrollView horizontal style={{ marginTop: 14 }} contentContainerStyle={{ gap: 10 }} showsHorizontalScrollIndicator={false}>
                {m.image_urls.map((u: string) => <Image key={u} source={{ uri: fileUrl(u)! }} style={[st.photo, { width: 140, height: 110 }]} />)}
              </ScrollView>
            )}
            <SectionHeader title="Updates" />
            <Card><Timeline items={m.updates.map((u: any) => ({ title: u.message || titleCase(u.status), subtitle: `${u.user_role === "OWNER" ? "Owner" : "You"}${u.status ? ` · ${titleCase(u.status)}` : ""}`, time: timeAgo(u.created_at), done: true }))} /></Card>
            {m.status !== "CLOSED" && (
              <>
                <Field label="Message your owner" value={msg} onChangeText={setMsg} multiline placeholder="Add details or reply…" />
                <Button title="Send message" variant="secondary" icon="chatbubble-outline" onPress={() => send(false)} loading={busy} disabled={!msg.trim()} />
                {m.status === "RESOLVED" && (
                  <Card style={{ marginTop: 18 }}>
                    <T v="title">Is it fixed? Rate the service</T>
                    <Row gap={8} style={{ marginVertical: 12 }}>
                      {[1, 2, 3, 4, 5].map((n) => <Tap key={n} onPress={() => setRating(n)}><Ionicons name={n <= rating ? "star" : "star-outline"} size={32} color={colors.warning} /></Tap>)}
                    </Row>
                    <Button title="Close request" variant="success" icon="checkmark-done" onPress={() => send(true)} loading={busy} />
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </Loadable>
    </Screen>
  );
};

// ── Move-out ───────────────────────────────────────────────────────────────
export const TenantMoveOutScreen = () => {
  const q = useLoad(() => Tenant.moveOut(), []);
  const lease = q.data?.lease;
  const mo = q.data?.move_out;
  const minDate = lease ? addDays(today(), lease.notice_period_days || 0) : today();
  const [date, setDate] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [dispute, setDispute] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<any>, msg: string) => {
    setBusy(true);
    try { await fn(); haptic.success(); toast.success(msg); q.reload(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const give = async () => {
    if (!date) return toast.error("Choose your move-out date");
    const short = date < minDate;
    if (!(await confirm({ title: "Give notice?", message: short ? `This is shorter than your ${lease.notice_period_days}-day notice period. Your owner may charge for the shortfall as per your lease.` : `Your owner will be notified that you plan to move out on ${fmtDate(date)}.`, confirm: "Give notice", danger: short }))) return;
    run(() => Tenant.requestMoveOut({ planned_move_out_date: date, reason: reason || null }), "Notice sent to your owner");
  };

  return (
    <Screen header={<Header title="Move out" />} refreshing={q.refreshing} onRefresh={q.refresh} keyboard>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload} skeleton="detail">
        {!lease ? <EmptyState icon="home-outline" title="No active agreement" /> : !mo || mo.status === "CANCELLED" ? (
          lease.status !== "ACTIVE" ? <Notice tone="info" message="Move-out is available for active leases." /> : (
            <>
              <Card>
                <T v="h3">Planning to move?</T>
                <T v="body" style={{ marginTop: 6 }}>Your agreement has a <T v="bodyStrong">{lease.notice_period_days}-day notice period</T>{lease.lock_in_months ? ` and a ${lease.lock_in_months}-month lock-in` : ""}. The earliest date without shortfall is <T v="bodyStrong">{fmtDate(minDate)}</T>.</T>
              </Card>
              <SectionHeader title="How it works" />
              <Card>
                <Timeline items={[
                  { title: "Give notice", subtitle: "Pick your move-out date", active: true },
                  { title: "Inspection", subtitle: "Your owner checks the home" },
                  { title: "Settlement", subtitle: "Itemised deductions (painting, cleaning, repairs, dues)" },
                  { title: "You accept or dispute", subtitle: "Nothing is final without your say" },
                  { title: lease.agreement_type === "LEASE" ? "Lease amount refund" : "Deposit refund", subtitle: "Recorded in your history" },
                ]} />
              </Card>
              <View style={{ height: 16 }} />
              <DateField label="Move-out date" value={date} onChange={setDate} min={today()} hint={date && date < minDate ? "⚠️ Shorter than your notice period" : undefined} />
              <Field label="Reason (optional)" value={reason} onChangeText={setReason} multiline placeholder="Helps your owner plan" />
              <Button title="Give notice" icon="exit-outline" onPress={give} loading={busy} />
            </>
          )
        ) : (
          <>
            <Card>
              <Row between><T v="overline">Move-out date</T><Badge status={mo.status} /></Row>
              <T v="h1" style={{ marginTop: 6 }}>{fmtDate(mo.planned_move_out_date)}</T>
              {mo.inspection_date && <T v="small">Inspection scheduled {fmtDate(mo.inspection_date)}</T>}
            </Card>
            <SectionHeader title="Progress" />
            <Card><Timeline items={moveTimeline(mo)} /></Card>

            {["SETTLEMENT_PROPOSED", "ACCEPTED", "DISPUTED", "COMPLETED"].includes(mo.status) && (
              <>
                <SectionHeader title="Settlement" />
                <SettlementSummary held={mo.deposit_held} deductions={mo.total_deductions} dues={mo.pending_dues} refund={mo.refund_amount} isLease={lease?.agreement_type === "LEASE"} />
                {!!mo.charges?.length && (
                  <View style={{ marginTop: 12 }}>
                    <ListCard>{mo.charges.map((c: any) => <ListItem key={c.id} icon="pricetag-outline" iconTone="danger" title={c.description} subtitle={titleCase(c.category)} right={<T v="bodyStrong">{money(c.amount)}</T>} />)}</ListCard>
                  </View>
                )}
                {mo.inspection_notes && <Notice tone="info" title="Inspection notes" message={mo.inspection_notes} style={{ marginTop: 12 }} />}
              </>
            )}

            {mo.status === "SETTLEMENT_PROPOSED" && (
              <Card style={{ marginTop: 16 }}>
                <T v="title">Do you agree with this settlement?</T>
                <T v="small" style={{ marginTop: 4, marginBottom: 12 }}>If something looks wrong, dispute it and explain why. Your owner can revise it, and RentLynk can help if you can't agree.</T>
                <Button title="Accept settlement" variant="success" icon="checkmark" onPress={() => run(() => Tenant.respondSettlement(mo.id, { accept: true }), "Settlement accepted")} loading={busy} />
                <View style={{ height: 14 }} />
                <Field label="Or tell your owner what's wrong" value={dispute} onChangeText={setDispute} multiline placeholder="e.g. Painting was already needed when I moved in" />
                <Button title="Dispute" variant="ghost" icon="alert-circle-outline" disabled={dispute.trim().length < 5} onPress={() => run(() => Tenant.respondSettlement(mo.id, { accept: false, response: dispute.trim() }), "Your concern was sent")} />
              </Card>
            )}
            {mo.status === "DISPUTED" && <Notice tone="warning" title="You disputed this settlement" message="Waiting for your owner to review. If you still can't agree, contact RentLynk support from Help." style={{ marginTop: 14 }} />}
            {mo.status === "COMPLETED" && <Notice tone="success" title="All done" message={mo.refund_reference ? `Refund reference: ${mo.refund_reference}` : "Your lease is closed. Thanks for renting with RentLynk!"} style={{ marginTop: 14 }} />}
            {["SETTLEMENT_PROPOSED", "ACCEPTED", "DISPUTED", "COMPLETED"].includes(mo.status) && (
              <Button title="Download settlement statement" variant="secondary" icon="download-outline" size="md" style={{ marginTop: 14 }}
                onPress={() => downloadPdf(`/tenant/move-out/${mo.id}/pdf`, "settlement.pdf").catch((e) => toast.error(errorMessage(e)))} />
            )}
            {["REQUESTED", "ACKNOWLEDGED"].includes(mo.status) && (
              <Button title="Withdraw notice" variant="ghost" style={{ marginTop: 18 }} onPress={async () => { if (await confirm({ title: "Withdraw your notice?", message: "Your lease will continue as normal.", confirm: "Withdraw" })) run(() => Tenant.cancelMoveOut(mo.id), "Notice withdrawn"); }} />
            )}
          </>
        )}
      </Loadable>
    </Screen>
  );
};

export const NoticesScreen = () => {
  const q = useLoad(() => Tenant.notices(), []);
  return (
    <Screen header={<Header title="Notices" />} refreshing={q.refreshing} onRefresh={q.refresh}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload}>
        {!q.data?.length ? <EmptyState icon="megaphone-outline" title="No notices" message="Building updates from your owner will appear here." /> : q.data.map((n: any, i: number) => (
          <FadeIn key={n.id} delay={i * 40}>
            <Card style={{ marginBottom: 12, borderLeftWidth: 4, borderLeftColor: n.priority === "IMPORTANT" ? colors.danger : colors.primary }}>
              <Row between><T v="title" style={{ flex: 1 }}>{n.title}</T>{n.priority === "IMPORTANT" && <Badge label="Important" tone="danger" small />}</Row>
              <T v="body" style={{ marginTop: 6 }}>{n.body}</T>
              <T v="caption" style={{ marginTop: 8 }}>{fmtDateTime(n.created_at)}</T>
            </Card>
          </FadeIn>
        ))}
      </Loadable>
    </Screen>
  );
};

export const JoinHomeScreen = ({ navigation }: any) => (
  <Screen header={<Header title="Join your home" />}>
    <JoinHomeCard onJoined={() => navigation.goBack()} />
    <Notice tone="info" style={{ marginTop: 16 }} message="Your invite code only works with the email address your owner used. Codes expire after 14 days — ask your owner for a new one if needed." />
  </Screen>
);

const st = StyleSheet.create({
  body: { marginTop: -24, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  mini: { flex: 1, paddingVertical: 12 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  cat: { width: (width - 40 - 32) / 5, aspectRatio: 0.95, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  catOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  photo: { width: 76, height: 76, borderRadius: 14, backgroundColor: colors.surfaceAlt },
  addPhoto: { borderWidth: 1.5, borderStyle: "dashed", borderColor: "#BFD7F5", alignItems: "center", justifyContent: "center", backgroundColor: "#F6FAFE" },
  photoX: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
});

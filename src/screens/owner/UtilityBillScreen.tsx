import React, { useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Header, Screen } from "../../components/Screen";
import { Button, Card, ChipGroup, IconButton, Notice, Row, T, Tap } from "../../components/ui";
import { AmountField, DateField, Field, SelectField } from "../../components/Inputs";
import { toast } from "../../components/Feedback";
import { colors, fonts, radius } from "../../theme";
import { Owner } from "../../api/endpoints";
import { errorMessage } from "../../api/client";
import { MONTHS, money, today } from "../../utils/format";
import { appendFile, pickDocument, pickImage, PickedFile } from "../../utils/files";
import { haptic } from "../../utils/haptics";

const isBillMonth = (lease: any, month: number) => {
  if (!lease || Number(lease.electricity_cycle_months) <= 1 || lease.electricity_bill_months === "ALL") return true;
  return lease.electricity_bill_months === "ODD" ? month % 2 === 1 : month % 2 === 0;
};

/** Owner uploads an electricity / utility bill; its amount is added to that month's rent invoice. */
export const AddUtilityBillScreen = ({ navigation, route }: any) => {
  const { leaseId, lease } = route.params;
  const now = new Date();
  // Month options: this month and the next 3, with the lease's next billing month preselected.
  const months = useMemo(() => Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1 + i, 1);
    return { value: `${d.getFullYear()}-${d.getMonth() + 1}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, month: d.getMonth() + 1, year: d.getFullYear() };
  }), []);
  const defaultMonth = months.slice(1).find((m) => isBillMonth(lease, m.month)) || months[1];
  const [type, setType] = useState("ELECTRICITY");
  const [target, setTarget] = useState(defaultMonth.value);
  const [amount, setAmount] = useState("");
  const [prev, setPrev] = useState("");
  const [curr, setCurr] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const units = prev && curr && Number(curr) >= Number(prev) ? Number(curr) - Number(prev) : null;
  const selected = months.find((m) => m.value === target)!;

  const choose = async (src: "camera" | "gallery" | "pdf") => {
    try {
      const f = src === "pdf" ? await pickDocument() : (await pickImage({ camera: src === "camera" }))[0];
      if (f) setFile(f);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const save = async () => {
    if (!(Number(amount) > 0)) return toast.error("Enter the bill amount");
    if (prev && curr && Number(curr) < Number(prev)) return toast.error("Current reading can't be lower than the previous reading");
    setSaving(true);
    try {
      const form = new FormData();
      form.append("type", type);
      form.append("amount", amount);
      form.append("bill_month", String(selected.month));
      form.append("bill_year", String(selected.year));
      if (prev) form.append("previous_reading", prev);
      if (curr) form.append("current_reading", curr);
      if (from) form.append("period_from", from);
      if (to) form.append("period_to", to);
      if (notes.trim()) form.append("notes", notes.trim());
      if (file) await appendFile(form, "bill", file);
      const r: any = await Owner.addUtilityBill(leaseId, form);
      haptic.success();
      toast.success(r.mode === "ADDED" ? "Added to the rent invoice — your tenant was notified" : r.mode === "SEPARATE" ? "That month was already paid, so a separate bill was raised" : `Saved — it will be added to the ${selected.label} rent invoice`);
      navigation.goBack();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <Screen header={<Header title="Add bill" subtitle={lease ? `${lease.tenant_name} · Unit ${lease.unit_number}` : undefined} />}
      footer={<Button title={`Add ${amount ? money(Number(amount)) : "bill"} to ${selected.label} rent`} icon="flash" onPress={save} loading={saving} />}>
      <View style={{ marginBottom: 16 }}>
        <ChipGroup value={type} onChange={setType} options={[{ label: "Electricity", value: "ELECTRICITY", icon: "flash-outline" }, { label: "Water", value: "WATER", icon: "water-outline" }, { label: "Gas", value: "GAS", icon: "flame-outline" }, { label: "Other", value: "OTHER" }]} />
      </View>

      <T v="overline" style={{ marginBottom: 10 }}>Bill copy</T>
      {file ? (
        <Card style={{ marginBottom: 16 }}>
          <Row gap={12}>
            {file.type.startsWith("image") ? <Image source={{ uri: file.uri }} style={st.preview} /> : <View style={[st.preview, { alignItems: "center", justifyContent: "center" }]}><Ionicons name="document" size={28} color={colors.primary} /></View>}
            <View style={{ flex: 1 }}><T v="title" numberOfLines={1}>{file.name}</T><T v="caption">Your tenant can view this bill</T></View>
            <IconButton icon="close" size={34} onPress={() => setFile(null)} bg={colors.surfaceAlt} />
          </Row>
        </Card>
      ) : (
        <Row gap={10} style={{ marginBottom: 16 }}>
          {([["camera-outline", "Photo", "camera"], ["images-outline", "Gallery", "gallery"], ["document-attach-outline", "PDF", "pdf"]] as const).map(([icon, label, src]) => (
            <Tap key={src} onPress={() => choose(src)} style={st.upload}>
              <Ionicons name={icon} size={24} color={colors.primary} />
              <T v="caption" style={{ marginTop: 6, color: colors.text, fontFamily: fonts.semibold }}>{label}</T>
            </Tap>
          ))}
        </Row>
      )}

      <AmountField label="Bill amount" value={amount} onChange={setAmount} />
      {type === "ELECTRICITY" && (
        <>
          <Row gap={12}>
            <View style={{ flex: 1 }}><Field label="Previous reading" keyboardType="decimal-pad" value={prev} onChangeText={setPrev} /></View>
            <View style={{ flex: 1 }}><Field label="Current reading" keyboardType="decimal-pad" value={curr} onChangeText={setCurr} /></View>
          </Row>
          {units != null && <Notice tone="info" icon="speedometer-outline" message={`${units} units consumed${Number(amount) > 0 && units > 0 ? ` · ${money(Number(amount) / units, { decimals: true })} per unit` : ""}`} style={{ marginTop: -6, marginBottom: 16 }} />}
        </>
      )}
      <Row gap={12}>
        <View style={{ flex: 1 }}><DateField label="Bill period from" value={from} onChange={setFrom} max={today()} /></View>
        <View style={{ flex: 1 }}><DateField label="To" value={to} onChange={setTo} min={from || undefined} max={today()} /></View>
      </Row>
      <SelectField label="Add to rent for" value={target} onChange={setTarget}
        options={months.map((m) => ({ value: m.value, label: m.label, subtitle: isBillMonth(lease, m.month) ? "Billing month" : undefined }))} />
      <Field label="Note (optional)" value={notes} onChangeText={setNotes} placeholder="e.g. Includes common-area share" />
      <Notice tone="info" message={`If the ${selected.label} rent invoice exists and is unpaid, the bill is added right away. If it isn't created yet, it's added automatically when it is. If that month is already paid, a separate bill is raised.`} />
    </Screen>
  );
};

const st = StyleSheet.create({
  upload: { flex: 1, height: 86, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#C7D2FE", backgroundColor: "#FAFAFF", alignItems: "center", justifyContent: "center" },
  preview: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.surfaceAlt },
});

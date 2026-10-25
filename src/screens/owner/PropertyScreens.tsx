import React, { useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header, Screen } from "../../components/Screen";
import { Badge, Button, Card, ChipGroup, EmptyState, FadeIn, IconButton, KeyValue, ListItem, Notice, Row, SectionHeader, Segmented, T, Tap } from "../../components/ui";
import { AmountField, Field, SearchBar, SelectField } from "../../components/Inputs";
import { PropertyCard } from "../../components/Domain";
import { Loadable } from "../../components/States";
import { confirm, toast } from "../../components/Feedback";
import { colors, fonts, radius, shadow } from "../../theme";
import { Owner } from "../../api/endpoints";
import { errorMessage, fieldErrors, fileUrl } from "../../api/client";
import { useLoad } from "../../utils/useLoad";
import { fmtDate, money, titleCase } from "../../utils/format";
import { appendFile, pickImage } from "../../utils/files";

const PROPERTY_TYPES = ["APARTMENT", "HOUSE", "VILLA", "COMMERCIAL", "SHOP", "OTHER"] as const;
const AMENITIES = ["Lift", "Power backup", "Parking", "CCTV", "Security", "Gym", "Swimming pool", "Garden", "Water purifier", "Wi-Fi", "Club house", "Pet friendly"];

export const PropertiesScreen = ({ navigation }: any) => {
  const [search, setSearch] = useState("");
  const q = useLoad(() => Owner.properties(), []);
  const list = (q.data || []).filter((p: any) => !search || `${p.name} ${p.city} ${p.address}`.toLowerCase().includes(search.toLowerCase()));
  const totals = (q.data || []).reduce((a: any, p: any) => ({ units: a.units + p.total_units, occ: a.occ + p.occupied_units, rent: a.rent + p.monthly_rent }), { units: 0, occ: 0, rent: 0 });
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}
      header={<Header back={false} title="Properties" right={<IconButton icon="add" bg={colors.primary} color="#fff" onPress={() => navigation.navigate("PropertyForm")} label="Add property" />} />}>
      {!!q.data?.length && (
        <Row gap={10} style={{ marginBottom: 16 }}>
          <Card style={st.miniStat}><T v="caption">Properties</T><T v="h3">{q.data.length}</T></Card>
          <Card style={st.miniStat}><T v="caption">Occupied</T><T v="h3">{totals.occ}/{totals.units}</T></Card>
          <Card style={st.miniStat}><T v="caption">Rent / mo</T><T v="h3" numberOfLines={1} adjustsFontSizeToFit>{money(totals.rent, { compact: true })}</T></Card>
        </Row>
      )}
      {(q.data?.length || 0) > 2 && <SearchBar value={search} onChange={setSearch} placeholder="Search by name or city" />}
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload}>
        {!list.length ? (
          <EmptyState icon="business-outline" title={search ? "No matches" : "No properties yet"} message={search ? "Try a different search." : "Add your first property to start managing units, tenants and rent."}
            action={search ? undefined : "Add property"} onAction={() => navigation.navigate("PropertyForm")} />
        ) : list.map((p: any, i: number) => (
          <FadeIn key={p.id} delay={i * 60}><PropertyCard p={p} onPress={() => navigation.navigate("PropertyDetail", { id: p.id })} /></FadeIn>
        ))}
      </Loadable>
    </Screen>
  );
};

export const PropertyDetailScreen = ({ navigation, route }: any) => {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const q = useLoad(() => Owner.property(id), [id]);
  const p = q.data;
  const [filter, setFilter] = useState<"ALL" | "OCCUPIED" | "VACANT">("ALL");
  const [uploading, setUploading] = useState(false);
  const units = (p?.units || []).filter((u: any) => filter === "ALL" || (filter === "VACANT" ? u.status !== "OCCUPIED" : u.status === "OCCUPIED"));

  const addPhoto = async () => {
    try {
      const [img] = await pickImage();
      if (!img) return;
      setUploading(true);
      const form = new FormData();
      await appendFile(form, "image", img);
      await Owner.addPropertyImage(id, form);
      toast.success("Photo added");
      q.reload();
    } catch (e) { toast.error(errorMessage(e)); } finally { setUploading(false); }
  };
  const remove = async () => {
    if (!(await confirm({ title: "Delete this property?", message: "Properties with past agreements are archived so records are kept.", confirm: "Delete", danger: true }))) return;
    try { await Owner.deleteProperty(id); toast.success("Done"); navigation.goBack(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const cover = fileUrl(p?.cover_url);
  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 260 }}>
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} /> : <LinearGradient colors={["#4F46E5", "#7C3AED"]} style={StyleSheet.absoluteFill} />}
          <LinearGradient colors={["rgba(11,16,38,0.45)", "transparent", "rgba(11,16,38,0.85)"]} style={StyleSheet.absoluteFill} />
          <Row between style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16 }}>
            <IconButton icon="chevron-back" onPress={() => navigation.goBack()} bg="rgba(255,255,255,0.9)" label="Back" />
            <Row gap={8}>
              <IconButton icon={uploading ? "hourglass-outline" : "camera-outline"} onPress={addPhoto} bg="rgba(255,255,255,0.9)" label="Add photo" />
              <IconButton icon="create-outline" onPress={() => navigation.navigate("PropertyForm", { property: p })} bg="rgba(255,255,255,0.9)" label="Edit" />
            </Row>
          </Row>
          {p && (
            <View style={{ position: "absolute", left: 20, right: 20, bottom: 40 }}>
              <Badge label={titleCase(p.type)} tone="primary" />
              <T v="h1" color="#fff" style={{ marginTop: 8 }}>{p.name}</T>
              <T v="small" color="rgba(255,255,255,0.85)">{p.address}, {p.city}</T>
            </View>
          )}
        </View>
        <View style={st.body}>
          <Loadable loading={q.loading} error={q.error} onRetry={q.reload} skeleton="detail">
            {p && (
              <>
                <Row gap={10}>
                  <Card style={st.miniStat}><T v="caption">Units</T><T v="h3">{p.stats.total_units}</T></Card>
                  <Card style={st.miniStat}><T v="caption">Occupied</T><T v="h3" color={colors.success}>{p.stats.occupied}</T></Card>
                  <Card style={st.miniStat}><T v="caption">Rent / mo</T><T v="h3" numberOfLines={1} adjustsFontSizeToFit>{money(p.stats.monthly_rent, { compact: true })}</T></Card>
                </Row>
                {p.image_urls?.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }} contentContainerStyle={{ gap: 10 }}>
                    {p.image_urls.map((u: string) => <Image key={u} source={{ uri: fileUrl(u)! }} style={st.thumb} />)}
                  </ScrollView>
                )}
                <SectionHeader title={`Units (${p.units.length})`} action="+ Add unit" onAction={() => navigation.navigate("UnitForm", { propertyId: p.id })} />
                <Segmented value={filter} onChange={setFilter} options={[{ label: "All", value: "ALL" }, { label: "Occupied", value: "OCCUPIED" }, { label: "Available", value: "VACANT" }]} />
                <View style={{ marginTop: 12, gap: 10 }}>
                  {!units.length && <EmptyState icon="grid-outline" title="No units here" message="Add flats, rooms or shops to this property." action="Add unit" onAction={() => navigation.navigate("UnitForm", { propertyId: p.id })} />}
                  {units.map((u: any) => (
                    <Tap key={u.id} onPress={() => navigation.navigate("UnitDetail", { id: u.id })} style={[st.unit, shadow(1)]}>
                      <View style={[st.unitBadge, { backgroundColor: u.status === "OCCUPIED" ? colors.successSoft : u.status === "RESERVED" ? colors.infoSoft : colors.surfaceAlt }]}>
                        <T v="title" color={u.status === "OCCUPIED" ? colors.success : u.status === "RESERVED" ? colors.info : colors.textSecondary}>{u.unit_number}</T>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <T v="title">{u.tenant_name || (u.status === "RESERVED" ? "Invite pending" : u.status === "MAINTENANCE" ? "Under maintenance" : "Available")}</T>
                        <T v="caption">{[u.unit_type, u.bedrooms != null ? `${u.bedrooms} bed` : null, u.area_sqft ? `${u.area_sqft} sq ft` : null, titleCase(u.furnishing)].filter(Boolean).join(" · ")}</T>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <T v="bodyStrong">{u.rent_amount > 0 ? money(u.rent_amount) : `${money(u.security_deposit, { compact: true })} lease`}</T>
                        {u.lease_status === "NOTICE" ? <Badge label="On notice" tone="warning" small /> : <Badge status={u.status} small />}
                      </View>
                    </Tap>
                  ))}
                </View>
                {!!p.amenities?.length && (
                  <>
                    <SectionHeader title="Amenities" />
                    <Row wrap gap={8}>{p.amenities.map((a: string) => <Badge key={a} label={a} tone="neutral" icon="checkmark" />)}</Row>
                  </>
                )}
                {p.house_rules && (
                  <>
                    <SectionHeader title="House rules" />
                    <Card><T v="body">{p.house_rules}</T></Card>
                  </>
                )}
                <Button title="Delete property" variant="ghost" icon="trash-outline" onPress={remove} style={{ marginTop: 28 }} />
              </>
            )}
          </Loadable>
        </View>
      </ScrollView>
    </Screen>
  );
};

export const PropertyFormScreen = ({ navigation, route }: any) => {
  const existing = route.params?.property;
  const [f, setF] = useState<any>({
    name: existing?.name || "", address: existing?.address || "", city: existing?.city || "", state: existing?.state || "", pincode: existing?.pincode || "",
    type: existing?.type || "APARTMENT", description: existing?.description || "", house_rules: existing?.house_rules || "", amenities: existing?.amenities || [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (v: any) => { setF((s: any) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };
  const toggleAmenity = (a: string) => set("amenities")(f.amenities.includes(a) ? f.amenities.filter((x: string) => x !== a) : [...f.amenities, a]);

  const save = async () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = "Enter a property name";
    if (f.address.trim().length < 5) e.address = "Enter the full address";
    if (f.city.trim().length < 2) e.city = "Enter the city";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      if (existing) { await Owner.updateProperty(existing.id, f); toast.success("Property updated"); navigation.goBack(); }
      else { const p = await Owner.createProperty(f); toast.success("Property added. Now add its units."); navigation.replace("PropertyDetail", { id: p.id }); }
    } catch (err) { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <Screen header={<Header title={existing ? "Edit property" : "Add property"} />} footer={<Button title={existing ? "Save changes" : "Add property"} onPress={save} loading={saving} />}>
      <T v="overline" style={{ marginBottom: 10 }}>Type</T>
      <View style={{ marginBottom: 18 }}><ChipGroup value={f.type} onChange={set("type")} options={PROPERTY_TYPES.map((t) => ({ label: titleCase(t), value: t }))} /></View>
      <Field label="Property name" icon="business-outline" placeholder="e.g. Sunshine Apartments" value={f.name} onChangeText={set("name")} error={errors.name} />
      <Field label="Address" icon="location-outline" placeholder="Building, street, area" value={f.address} onChangeText={set("address")} error={errors.address} multiline />
      <Row gap={12}>
        <View style={{ flex: 1 }}><Field label="City" value={f.city} onChangeText={set("city")} error={errors.city} /></View>
        <View style={{ flex: 1 }}><Field label="PIN code" value={f.pincode} onChangeText={set("pincode")} keyboardType="number-pad" error={errors.pincode} /></View>
      </Row>
      <Field label="State" value={f.state} onChangeText={set("state")} />
      <T v="overline" style={{ marginBottom: 10 }}>Amenities</T>
      <Row wrap gap={8} style={{ marginBottom: 18 }}>
        {AMENITIES.map((a) => (
          <Tap key={a} onPress={() => toggleAmenity(a)} style={[st.amen, f.amenities.includes(a) && st.amenOn]}>
            <T v="small" color={f.amenities.includes(a) ? colors.primary : colors.textSecondary} style={{ fontFamily: fonts.semibold }}>{f.amenities.includes(a) ? "✓ " : ""}{a}</T>
          </Tap>
        ))}
      </Row>
      <Field label="Description (optional)" value={f.description} onChangeText={set("description")} multiline placeholder="What makes this place great?" />
      <Field label="House rules (optional)" value={f.house_rules} onChangeText={set("house_rules")} multiline placeholder="Quiet hours, visitors, pets…" hint="Tenants see these on their home screen." />
    </Screen>
  );
};

export const UnitFormScreen = ({ navigation, route }: any) => {
  const { propertyId, unit } = route.params;
  const [f, setF] = useState<any>({
    unit_number: unit?.unit_number || "", unit_type: unit?.unit_type || "", floor: unit?.floor?.toString() || "", bedrooms: unit?.bedrooms?.toString() || "",
    bathrooms: unit?.bathrooms?.toString() || "", area_sqft: unit?.area_sqft?.toString() || "", rent_amount: unit?.rent_amount?.toString() || "",
    security_deposit: unit?.security_deposit?.toString() || "", maintenance_charge: unit?.maintenance_charge?.toString() || "", furnishing: unit?.furnishing || "UNFURNISHED",
    description: unit?.description || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (v: any) => { setF((s: any) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };
  const num = (v: string) => (v === "" ? null : Number(v));

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.unit_number.trim()) e.unit_number = "Enter a unit number or name";
    if (!(Number(f.rent_amount) > 0) && !(Number(f.security_deposit) > 0)) e.rent_amount = "Enter the monthly rent (or a lease amount below)";
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = {
      unit_number: f.unit_number.trim(), unit_type: f.unit_type || null, floor: num(f.floor), bedrooms: num(f.bedrooms), bathrooms: num(f.bathrooms),
      area_sqft: num(f.area_sqft), rent_amount: Number(f.rent_amount), security_deposit: Number(f.security_deposit || 0),
      maintenance_charge: Number(f.maintenance_charge || 0), furnishing: f.furnishing, description: f.description || null,
    };
    setSaving(true);
    try {
      if (unit) await Owner.updateUnit(unit.id, body); else await Owner.createUnit(propertyId, body);
      toast.success(unit ? "Unit updated" : "Unit added");
      navigation.goBack();
    } catch (err) { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <Screen header={<Header title={unit ? "Edit unit" : "Add unit"} />} footer={<Button title={unit ? "Save changes" : "Add unit"} onPress={save} loading={saving} />}>
      <Row gap={12}>
        <View style={{ flex: 1 }}><Field label="Unit no. / name" placeholder="101" value={f.unit_number} onChangeText={set("unit_number")} error={errors.unit_number} /></View>
        <View style={{ flex: 1 }}><Field label="Type" placeholder="2BHK" value={f.unit_type} onChangeText={set("unit_type")} /></View>
      </Row>
      <Row gap={12}>
        <View style={{ flex: 1 }}><Field label="Floor" keyboardType="number-pad" value={f.floor} onChangeText={set("floor")} /></View>
        <View style={{ flex: 1 }}><Field label="Bedrooms" keyboardType="number-pad" value={f.bedrooms} onChangeText={set("bedrooms")} /></View>
        <View style={{ flex: 1 }}><Field label="Baths" keyboardType="number-pad" value={f.bathrooms} onChangeText={set("bathrooms")} /></View>
      </Row>
      <Field label="Area (sq ft)" keyboardType="number-pad" value={f.area_sqft} onChangeText={set("area_sqft")} icon="resize-outline" />
      <T v="overline" style={{ marginBottom: 10 }}>Furnishing</T>
      <View style={{ marginBottom: 18 }}>
        <ChipGroup value={f.furnishing} onChange={set("furnishing")} options={[{ label: "Unfurnished", value: "UNFURNISHED" }, { label: "Semi", value: "SEMI_FURNISHED" }, { label: "Fully", value: "FULLY_FURNISHED" }]} />
      </View>
      <T v="overline" style={{ marginBottom: 10 }}>Default terms</T>
      <AmountField label="Monthly rent" value={f.rent_amount} onChange={set("rent_amount")} error={errors.rent_amount} hint="Leave empty if this unit is only given on lease" />
      <AmountField label="Security deposit / lease amount" value={f.security_deposit} onChange={set("security_deposit")} hint="Rental: usually 2–3 months' rent. Lease: the lump-sum lease amount." />
      <AmountField label="Monthly maintenance" value={f.maintenance_charge} onChange={set("maintenance_charge")} />
      <Field label="Description (optional)" multiline value={f.description} onChangeText={set("description")} />
    </Screen>
  );
};

export const UnitDetailScreen = ({ navigation, route }: any) => {
  const { id } = route.params;
  const q = useLoad(() => Owner.unit(id), [id]);
  const u = q.data;
  const live = u?.leases?.find((l: any) => ["ACTIVE", "NOTICE", "UPCOMING"].includes(l.status));
  const setStatus = async (status: string) => {
    try { await Owner.updateUnit(id, { status }); toast.success("Unit updated"); q.reload(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const remove = async () => {
    if (!(await confirm({ title: "Delete this unit?", confirm: "Delete", danger: true }))) return;
    try { await Owner.deleteUnit(id); toast.success("Unit deleted"); navigation.goBack(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <Screen header={<Header title={u ? `Unit ${u.unit_number}` : "Unit"} subtitle={u?.property_name} right={u ? <IconButton icon="create-outline" onPress={() => navigation.navigate("UnitForm", { unit: u, propertyId: u.property_id })} /> : undefined} />}
      refreshing={q.refreshing} onRefresh={q.refresh}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload} skeleton="detail">
        {u && (
          <>
            <Card>
              <Row between>{u.rent_amount > 0 ? <T v="h3">{money(u.rent_amount)}<T v="caption"> / month</T></T> : <T v="h3">{money(u.security_deposit)}<T v="caption"> lease</T></T>}<Badge status={u.status} /></Row>
              <View style={{ marginTop: 10 }}>
                <KeyValue label="Deposit" value={money(u.security_deposit)} />
                <KeyValue label="Maintenance" value={money(u.maintenance_charge)} />
                <KeyValue label="Layout" value={[u.unit_type, u.bedrooms != null && `${u.bedrooms} bed`, u.bathrooms != null && `${u.bathrooms} bath`].filter(Boolean).join(" · ") || "—"} />
                <KeyValue label="Area" value={u.area_sqft ? `${u.area_sqft} sq ft` : "—"} />
                <KeyValue label="Furnishing" value={titleCase(u.furnishing)} />
              </View>
            </Card>

            {live ? (
              <Card style={{ marginTop: 14 }} onPress={() => navigation.navigate("LeaseDetail", { id: live.id })}>
                <Row between><T v="overline">{live.agreement_type === "LEASE" ? "Current lease" : "Current rental"}</T><Badge status={live.status} small /></Row>
                <T v="h3" style={{ marginTop: 8 }}>{live.tenant_name}</T>
                <T v="caption">{live.lease_number} · since {fmtDate(live.start_date)}</T>
              </Card>
            ) : u.pending_invites?.length ? (
              <Notice tone="info" style={{ marginTop: 14 }} title="Invite pending" message={`Waiting for ${u.pending_invites[0].tenant_email} to join (code ends …${u.pending_invites[0].code_hint}).`} action="Manage invitations" onAction={() => navigation.navigate("Invitations")} />
            ) : u.status !== "MAINTENANCE" ? (
              <Button title="Add tenant to this unit" icon="person-add-outline" onPress={() => navigation.navigate("CreateLease", { unitId: u.id })} style={{ marginTop: 14 }} />
            ) : null}

            {!live && (
              <Button title={u.status === "MAINTENANCE" ? "Mark as available" : "Mark under maintenance"} variant="secondary" icon="construct-outline"
                onPress={() => setStatus(u.status === "MAINTENANCE" ? "VACANT" : "MAINTENANCE")} style={{ marginTop: 10 }} />
            )}

            {!!u.leases?.length && (
              <>
                <SectionHeader title="Tenant history" />
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                  {u.leases.map((l: any) => (
                    <ListItem key={l.id} icon="document-text-outline" title={l.tenant_name} subtitle={`${fmtDate(l.start_date)} → ${l.end_date ? fmtDate(l.end_date) : "ongoing"} · ${l.agreement_type === "LEASE" ? `Lease ${money(l.security_deposit, { compact: true })}` : `${money(l.rent_amount)}/mo`}`}
                      right={<Badge status={l.status} small />} onPress={() => navigation.navigate("LeaseDetail", { id: l.id })} />
                  ))}
                </Card>
              </>
            )}
            {!u.leases?.length && <Button title="Delete unit" variant="ghost" icon="trash-outline" onPress={remove} style={{ marginTop: 24 }} />}
          </>
        )}
      </Loadable>
    </Screen>
  );
};

const st = StyleSheet.create({
  miniStat: { flex: 1, paddingVertical: 12 },
  body: { marginTop: -24, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  thumb: { width: 110, height: 80, borderRadius: 14, backgroundColor: colors.surfaceAlt },
  unit: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: "#EDF0F6" },
  unitBadge: { minWidth: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  amen: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  amenOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});

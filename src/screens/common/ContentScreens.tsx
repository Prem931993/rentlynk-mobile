import React from "react";
import { View } from "react-native";
import { Header, Screen } from "../../components/Screen";
import { Markdown } from "../../components/Markdown";
import { Loadable } from "../../components/States";
import { Badge, Card, ListItem, Row, T } from "../../components/ui";
import { Public, Auth } from "../../api/endpoints";
import { useLoad } from "../../utils/useLoad";
import { fmtDate, fmtDateTime, titleCase } from "../../utils/format";
import { colors } from "../../theme";
import { useSettingsStore } from "../../stores/settingsStore";

export const LegalScreen = ({ route }: any) => {
  const { slug } = route.params;
  const q = useLoad(() => Public.legalDoc(slug), [slug]);
  return (
    <Screen header={<Header title={q.data?.title || "Document"} />}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload} skeleton="detail">
        {q.data && (
          <>
            <Row gap={8} style={{ marginBottom: 16 }}>
              <Badge label={`Version ${q.data.version}`} tone="primary" />
              <T v="caption">Published {fmtDate(q.data.published_at)}</T>
            </Row>
            <Card><Markdown content={q.data.content || ""} /></Card>
          </>
        )}
      </Loadable>
    </Screen>
  );
};

export const CmsScreen = ({ route }: any) => {
  const { slug, title } = route.params;
  const q = useLoad(() => Public.cms(slug), [slug]);
  return (
    <Screen header={<Header title={q.data?.title || title || "Help"} />}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload} skeleton="detail">
        {q.data && <Card><Markdown content={q.data.content} skipTitle /></Card>}
      </Loadable>
    </Screen>
  );
};

export const HelpScreen = ({ navigation }: any) => {
  const s = useSettingsStore();
  return (
    <Screen header={<Header title="Help & legal" />}>
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListItem icon="help-buoy-outline" title="Help & FAQs" subtitle="Payments, invites, deposits and more" onPress={() => navigation.navigate("Cms", { slug: "help-faq" })} />
        <ListItem icon="people-outline" title="Community guidelines" onPress={() => navigation.navigate("Cms", { slug: "rental-guidelines" })} />
      </Card>
      <T v="overline" style={{ marginTop: 24, marginBottom: 10 }}>Legal</T>
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListItem icon="document-text-outline" title="Terms & Conditions" onPress={() => navigation.navigate("Legal", { slug: "terms-conditions" })} />
        <ListItem icon="finger-print-outline" title="Privacy Policy" onPress={() => navigation.navigate("Legal", { slug: "privacy-policy" })} />
        <ListItem icon="home-outline" title="Rental & Deposit Policy" onPress={() => navigation.navigate("Legal", { slug: "rental-policy" })} />
        <ListItem icon="checkmark-done-outline" title="My consent history" subtitle="What you agreed to, and when" onPress={() => navigation.navigate("Consents")} />
      </Card>
      <T v="overline" style={{ marginTop: 24, marginBottom: 10 }}>Contact</T>
      <Card>
        <T v="title">{s.companyName} Support</T>
        <T v="small" style={{ marginTop: 4 }}>{s.supportEmail}{s.supportPhone ? `  ·  ${s.supportPhone}` : ""}</T>
      </Card>
    </Screen>
  );
};

export const ConsentHistoryScreen = () => {
  const q = useLoad(() => Auth.myConsents(), []);
  return (
    <Screen header={<Header title="Consent history" />}>
      <Loadable loading={q.loading} error={q.error} onRetry={q.reload}>
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {(q.data || []).map((c: any) => (
            <ListItem key={c.id} icon="checkmark-circle" iconTone="success" title={`${c.title} · v${c.version}`}
              subtitle={`Accepted ${fmtDateTime(c.accepted_at)} · ${titleCase(c.context)}`} />
          ))}
        </Card>
        <View style={{ marginTop: 16 }}><T v="caption" color={colors.textMuted}>We keep a record of each policy version you accept, as required for transparency.</T></View>
      </Loadable>
    </Screen>
  );
};

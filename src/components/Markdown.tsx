import React from "react";
import { Text, View } from "react-native";
import { colors, fonts } from "../theme";

/** Minimal, safe Markdown renderer for legal and help content (headings, lists, bold, italics). */
const inline = (text: string, key: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**")) return <Text key={`${key}-${i}`} style={{ fontFamily: fonts.bold, color: colors.text }}>{p.slice(2, -2)}</Text>;
    if (p.startsWith("_") && p.endsWith("_")) return <Text key={`${key}-${i}`} style={{ fontStyle: "italic", color: colors.textMuted }}>{p.slice(1, -1)}</Text>;
    return <Text key={`${key}-${i}`}>{p}</Text>;
  });
};

export const Markdown = ({ content, skipTitle }: { content: string; skipTitle?: boolean }) => {
  const lines = content.replace(/\r/g, "").split("\n");
  const out: React.ReactNode[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) return;
    if (line.startsWith("# ")) {
      if (!skipTitle) out.push(<Text key={i} style={{ fontFamily: fonts.extrabold, fontSize: 24, color: colors.text, marginBottom: 8 }}>{line.slice(2)}</Text>);
      return;
    }
    if (line.startsWith("## ")) {
      out.push(<Text key={i} style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.text, marginTop: 18, marginBottom: 6 }}>{line.slice(3)}</Text>);
      return;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (bullet || numbered) {
      out.push(
        <View key={i} style={{ flexDirection: "row", marginBottom: 6, paddingLeft: 4 }}>
          <Text style={{ fontFamily: fonts.bold, color: colors.primary, width: 20 }}>{numbered ? `${numbered[1]}.` : "•"}</Text>
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textSecondary }}>{inline(bullet ? bullet[1] : numbered![2], `l${i}`)}</Text>
        </View>
      );
      return;
    }
    out.push(<Text key={i} style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textSecondary, marginBottom: 10 }}>{inline(line, `p${i}`)}</Text>);
  });
  return <View>{out}</View>;
};

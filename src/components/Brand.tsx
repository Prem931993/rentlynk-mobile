import React from "react";
import { View, Text } from "react-native";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop, Circle } from "react-native-svg";
import { colors, fonts } from "../theme";

/** RentLynk mark: a house roof whose door is formed by two interlocking links. */
export const LogoMark = ({ size = 64, light = false }: { size?: number; light?: boolean }) => {
  // Unique gradient id per instance: on web, SVG ids are document-global.
  const gid = "lg" + React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <SvgGradient id={gid} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#6366F1" />
        <Stop offset="1" stopColor="#8B5CF6" />
      </SvgGradient>
    </Defs>
    <Rect x="0" y="0" width="64" height="64" rx="18" fill={light ? "#FFFFFF" : `url(#${gid})`} />
    <Path d="M14 31 L32 16 L50 31" stroke={light ? colors.primary : "#FFFFFF"} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Rect x="21" y="30" width="12" height="18" rx="6" stroke={light ? colors.primary : "#FFFFFF"} strokeWidth={4.5} fill="none" />
    <Rect x="31" y="30" width="12" height="18" rx="6" stroke={light ? colors.violet : "#C7D2FE"} strokeWidth={4.5} fill="none" />
    <Circle cx="47" cy="17" r="3.2" fill={light ? colors.success : "#34D399"} />
  </Svg>
  );
};

export const Wordmark = ({ size = 28, color = colors.text }: { size?: number; color?: string }) => (
  <Text style={{ fontFamily: fonts.extrabold, fontSize: size, color, letterSpacing: -0.8 }}>
    Rent<Text style={{ color: color === "#FFFFFF" || color === "#fff" ? "#A5B4FC" : colors.primary }}>Lynk</Text>
  </Text>
);

export const LogoLockup = ({ size = 40, color = colors.text }: { size?: number; color?: string }) => (
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    <LogoMark size={size} />
    <View style={{ width: 10 }} />
    <Wordmark size={size * 0.62} color={color} />
  </View>
);

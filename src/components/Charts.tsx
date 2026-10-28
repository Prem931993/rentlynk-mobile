import React, { useEffect, useRef, useState } from "react";
import { Animated, View, Text } from "react-native";
import Svg, { Circle, Rect, Text as SvgText, G } from "react-native-svg";
import { colors, fonts } from "../theme";
import { MONTHS_SHORT, money } from "../utils/format";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Grouped bars: billed vs collected per month. */
export const CollectionChart = ({ data, height = 170 }: { data: { month: number; billed: number; collected: number }[]; height?: number }) => {
  const [w, setW] = useState(0);
  const grow = useRef(new Animated.Value(0)).current;
  const [g, setG] = useState(0);
  useEffect(() => {
    const id = grow.addListener(({ value }) => setG(value));
    Animated.timing(grow, { toValue: 1, duration: 800, useNativeDriver: false }).start();
    return () => grow.removeListener(id);
  }, [data]);
  const max = Math.max(1, ...data.map((d) => Math.max(d.billed, d.collected)));
  const chartH = height - 28;
  const slot = w / Math.max(1, data.length);
  const bw = Math.min(14, slot / 3.2);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={height}>
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <Rect key={p} x={0} y={chartH - chartH * p} width={w} height={1} fill={colors.border} />
          ))}
          {data.map((d, i) => {
            const cx = slot * i + slot / 2;
            const hb = (d.billed / max) * (chartH - 8) * g;
            const hc = (d.collected / max) * (chartH - 8) * g;
            return (
              <G key={i}>
                <Rect x={cx - bw - 2} y={chartH - hb} width={bw} height={hb} rx={bw / 2.5} fill="#BFD7F5" />
                <Rect x={cx + 2} y={chartH - hc} width={bw} height={hc} rx={bw / 2.5} fill={colors.primary} />
                <SvgText x={cx} y={height - 6} fontSize={11} fontFamily={fonts.semibold} fill={colors.textMuted} textAnchor="middle">
                  {MONTHS_SHORT[d.month - 1]}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      )}
      <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
        <Legend color="#BFD7F5" label="Billed" />
        <Legend color={colors.primary} label="Collected" />
        <Text style={{ marginLeft: "auto", fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted }}>Peak {money(max, { compact: true })}</Text>
      </View>
    </View>
  );
};

const Legend = ({ color, label }: { color: string; label: string }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{label}</Text>
  </View>
);

/** Animated progress ring with centred label. */
export const Ring = ({ value, size = 92, stroke = 10, color = colors.success, track = "rgba(255,255,255,0.18)", label, sub, labelColor = "#fff" }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; label?: string; sub?: string; labelColor?: string;
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: Math.max(0, Math.min(1, value)), duration: 900, useNativeDriver: false }).start(); }, [value]);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={a.interpolate({ inputRange: [0, 1], outputRange: [c, 0] })} />
      </Svg>
      {label && <Text style={{ fontFamily: fonts.extrabold, fontSize: size * 0.22, color: labelColor }}>{label}</Text>}
      {sub && <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: labelColor, opacity: 0.75 }}>{sub}</Text>}
    </View>
  );
};

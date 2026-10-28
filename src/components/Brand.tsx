import React from "react";
import { Image, Text, View } from "react-native";
import { colors, fonts } from "../theme";

const MARK = require("../../assets/brand/logo-mark.png");

/**
 * RentLynk mark: house roof with two linked chain rings.
 * `tile` puts it on a white rounded square (same look as the app icon), for dark backgrounds.
 */
export const LogoMark = ({ size = 64, tile = false }: { size?: number; tile?: boolean }) =>
  tile ? (
    <View style={{ width: size, height: size, borderRadius: size * 0.24, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
      <Image source={MARK} style={{ width: size * 0.78, height: size * 0.78 }} resizeMode="contain" />
    </View>
  ) : (
    <Image source={MARK} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="RentLynk" />
  );

/** "Rent" in brand blue, "Lynk" in brand green. On dark backgrounds pass color="#FFFFFF". */
export const Wordmark = ({ size = 28, color = colors.primaryDark }: { size?: number; color?: string }) => {
  const onDark = color === "#FFFFFF" || color === "#fff";
  return (
    <Text style={{ fontFamily: fonts.extrabold, fontSize: size, color, letterSpacing: -0.8 }}>
      Rent<Text style={{ color: onDark ? colors.secondaryBright : colors.secondary }}>Lynk</Text>
    </Text>
  );
};

export const LogoLockup = ({ size = 40, color = colors.primaryDark }: { size?: number; color?: string }) => (
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    <LogoMark size={size} tile={color === "#FFFFFF" || color === "#fff"} />
    <View style={{ width: 10 }} />
    <Wordmark size={size * 0.62} color={color} />
  </View>
);

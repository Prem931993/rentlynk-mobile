import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import {
  useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { SplashOverlay } from "./src/screens/boot/SplashOverlay";
import { ConfirmHost, ToastHost } from "./src/components/Feedback";
import { useAuth } from "./src/stores/authStore";
import { useSettingsStore } from "./src/stores/settingsStore";
import { Public } from "./src/api/endpoints";
import { colors } from "./src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Web build only: hide the browser's own password-reveal / clear buttons (we draw our own).
if (Platform.OS === "web" && typeof document !== "undefined") {
  const css = document.createElement("style");
  css.textContent = "input::-ms-reveal,input::-ms-clear{display:none}input,textarea{outline:none}";
  document.head.appendChild(css);
}

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary } };

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  });
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    bootstrap();
    Public.settings().then((s: any) => useSettingsStore.getState().set({
      currency: s.general?.currency || "INR", symbol: s.general?.currency_symbol || "₹", companyName: s.general?.company_name || "RentLynk",
      supportEmail: s.general?.support_email || "", supportPhone: s.general?.support_phone || "", tagline: s.branding?.tagline || "Renting, simplified.", country: s.general?.country || "India",
    })).catch(() => {});
  }, []);

  // Hand over from the static native splash to the animated one as soon as fonts are ready.
  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync().catch(() => {}); }, [fontsLoaded]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.ink }} />;

  const ready = status !== "booting";
  return (
    <SafeAreaProvider>
      <StatusBar style={splashDone ? "dark" : "light"} />
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
      <ToastHost />
      <ConfirmHost />
      {!splashDone && <SplashOverlay ready={ready} onDone={() => setSplashDone(true)} />}
    </SafeAreaProvider>
  );
}

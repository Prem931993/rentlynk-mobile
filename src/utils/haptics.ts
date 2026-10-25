import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const on = Platform.OS !== "web";
export const haptic = {
  tap: () => on && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  select: () => on && Haptics.selectionAsync().catch(() => {}),
  success: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};

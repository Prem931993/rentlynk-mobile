import React, { createContext, useCallback, useContext, useRef } from "react";
import { Keyboard, Platform, ScrollView, View } from "react-native";

/**
 * Keeps the focused input visible above the keyboard (works in Expo Go — no native module).
 * Scroll containers provide `scrollToNode`; inputs call it with their wrapper view on focus.
 */
type ScrollToNode = (node: React.ComponentRef<typeof View> | null) => void;
const FormScrollContext = createContext<ScrollToNode | null>(null);

export const useFormScroll = () => useContext(FormScrollContext);

export const useScrollToNode = (offset = 120) => {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollToNode = useCallback<ScrollToNode>((node) => {
    const run = () => {
      const scroll = scrollRef.current as any;
      if (!scroll || !node) return;
      const inner = scroll.getInnerViewRef?.() ?? scroll.getInnerViewNode?.();
      if (!inner) return;
      (node as any).measureLayout(inner, (_x: number, y: number) => {
        scroll.scrollTo({ y: Math.max(0, y - offset), animated: true });
      }, () => {});
    };
    // Wait for the keyboard to finish opening (and the layout to shrink) before scrolling.
    if (Platform.OS === "web") return;
    let done = false;
    const go = () => { if (done) return; done = true; sub.remove(); run(); };
    const sub = Keyboard.addListener("keyboardDidShow", () => setTimeout(go, 30));
    setTimeout(go, 500); // keyboard already open (moving between fields)
  }, [offset]);
  return { scrollRef, scrollToNode };
};

export const FormScrollProvider = ({ value, children }: { value: ScrollToNode; children: React.ReactNode }) => (
  <FormScrollContext.Provider value={value}>{children}</FormScrollContext.Provider>
);

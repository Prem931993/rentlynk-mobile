import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { errorMessage } from "../api/client";

/** Loads data on mount, re-fetches quietly whenever the screen regains focus, supports pull-to-refresh. */
export function useLoad<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (mode: "initial" | "refresh" | "silent") => {
    if (mode === "refresh") setRefreshing(true);
    try {
      const d = await fnRef.current();
      setData(d);
      setError(null);
    } catch (e) {
      if (mode !== "silent" || !data) setError(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => { setLoading(true); run("initial"); }, deps);

  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return; }
    run("silent");
  }, deps));

  return { data, setData, loading, refreshing, error, reload: () => run("silent"), refresh: () => run("refresh") };
}

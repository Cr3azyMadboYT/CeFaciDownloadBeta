import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { rpc, type RpcClient } from "../../shared/contracts";
export const backend = createClient(
  "https://vqrmwuarjjntusfbqprx.supabase.co",
  "sb_publishable_DWl1cra4FE1Dxgc2hwtGrA_0LwP5B4O",
  {
    auth: {
      storage: AsyncStorage,
      storageKey: "cefaci-business-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === "web",
    },
  },
);
if (Platform.OS !== "web")
  AppState.addEventListener("change", (s) =>
    s === "active"
      ? backend.auth.startAutoRefresh()
      : backend.auth.stopAutoRefresh(),
  );
export const call = <T>(name: string, args: Record<string, unknown> = {}) =>
  rpc<T>(backend as unknown as RpcClient, name, args);
export function live(venue: string, refresh: () => void) {
  const c = backend
    .channel("business-" + venue)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "outing_events",
        filter: "venue_id=eq." + venue,
      },
      refresh,
    )
    .subscribe((s) => {
      if (s === "SUBSCRIBED") refresh();
    });
  const timer = setInterval(refresh, 15000);
  const state = AppState.addEventListener("change", (s) => {
    if (s === "active") refresh();
  });
  return () => {
    clearInterval(timer);
    state.remove();
    void backend.removeChannel(c);
  };
}

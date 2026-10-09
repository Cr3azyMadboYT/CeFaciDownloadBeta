import "react-native-url-polyfill/auto";
import {authStorage} from './auth-storage';
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { rpc, type RpcClient } from "../../shared/contracts";
import {publishSecurityFailure} from '../../shared/security-events';
export const backend = createClient(
  "https://vqrmwuarjjntusfbqprx.supabase.co",
  "sb_publishable_DWl1cra4FE1Dxgc2hwtGrA_0LwP5B4O",
  {
    auth: {
      storage: authStorage,
      storageKey: "cefaci-business-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
);
if (Platform.OS !== "web")
  AppState.addEventListener("change", (s) =>
    s === "active"
      ? backend.auth.startAutoRefresh()
      : backend.auth.stopAutoRefresh(),
  );
export const call = async <T>(name: string, args: Record<string, unknown> = {}) => {
  try {return await rpc<T>(backend as unknown as RpcClient, name, args);}
  catch(error) {
    if(!name.startsWith('secure_') && error instanceof Error && /securizat|autentific|Nu ai voie|Nu ai acces|echipa localului/i.test(error.message)) publishSecurityFailure('business');
    throw error;
  }
};
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

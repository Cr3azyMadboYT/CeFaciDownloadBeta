import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  BricolageGrotesque_800ExtraBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from "@expo-google-fonts/instrument-sans";
import { Caveat_700Bold } from "@expo-google-fonts/caveat";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { ThemeCtx, zi, noapte } from "../../shared/theme";
import { Bilu } from "../../shared/Bilu";
import {
  RequestScope,
  canFinance,
  canOperate,
  type Dashboard,
  type VenueAccess,
} from "../../shared/contracts";
import { backend, call, live } from "./backend";
import { Card, Txt, Button, Row } from "./ui";
import { BusinessEntry, BusinessOnboarding, OwnershipDisputes } from "./onboarding";
import { BusinessHelp } from "./support";
import {
  Today,
  Reservations,
  Scanner,
  Finances,
  Offers,
  Profile,
  Team,
  Statistics,
  type ScreenProps,
  type Action,
} from "./screens";
function Workspace({ session }: { session: Session }) {
  const wide = useWindowDimensions().width >= 920;
  const [venues, V] = useState<VenueAccess[]>([]),
    [venue, S] = useState(""),
    [data, D] = useState<Dashboard | null>(null),
    [tab, T] = useState("Azi"),
    [busy, B] = useState(false),
    [message, M] = useState(""),
    [loaded, L] = useState(false),
    [onboarding, Onboarding] = useState(false);
  const [helpBeforeAccess, HelpBeforeAccess] = useState(false);
  const scope = useRef(new RequestScope()),
    request = useRef(0),
    action = useRef(false),
    accessRequest = useRef(0);
  const loadVenues = useCallback(async () => {
    const valid = scope.current.capture(), n = ++accessRequest.current;
    M("");
    try {
      const rows = await call<VenueAccess[]>("biz_my_venues");
      if (valid() && n === accessRequest.current) {
        V(rows);
        S((current) => rows.some((v) => v.venue_id === current) ? current : rows[0]?.venue_id ?? "");
      }
    } catch (e) {
      if (valid() && n === accessRequest.current)
        M(e instanceof Error ? e.message : "Nu am putut verifica accesul. Reîncearcă online.");
    } finally {
      if (valid() && n === accessRequest.current) L(true);
    }
  }, []);
  useEffect(() => {
    scope.current.invalidate();
    void loadVenues();
    return () => {
      scope.current.invalidate();
    };
  }, [session.user.id, loadVenues]);
  const refresh = useCallback(async () => {
    if (!venue) return;
    const valid = scope.current.capture(),
      n = ++request.current;
    try {
      const next = await call<Dashboard>("biz_dashboard_v2", {
        p_venue: venue,
      });
      if (valid() && n === request.current) {
        D(next);
        V((rows) => rows.map((v) => v.venue_id === venue ? { ...v, role: next.role } : v));
      }
    } catch (e) {
      if (valid() && n === request.current) {
        D(null);
        M(e instanceof Error ? e.message : "Nu am putut actualiza localul.");
      }
    }
  }, [venue]);
  useEffect(() => {
    // No selection yet: do not invalidate the initial access-list request.
    if (!venue) return;
    scope.current.invalidate();
    D(null);
    M("");
    B(false);
    action.current = false;
    T("Azi");
    void refresh();
    return live(venue, () => void refresh());
  }, [venue, refresh]);
  const act: Action = async (work, success) => {
    if (action.current) return;
    const valid = scope.current.capture();
    action.current = true;
    B(true);
    M("");
    try {
      await work();
      if (valid()) {
        M(success ?? "Salvat.");
        await refresh();
      }
    } catch (e) {
      if (valid())
        M(
          e instanceof Error
            ? e.message
            : "Operațiunea nu a reușit. Reîncearcă online.",
        );
    } finally {
      if (valid()) {
        action.current = false;
        B(false);
      }
    }
  };
  const signOut = async () => {
    scope.current.invalidate();
    D(null);
    V([]);
    B(false);
    action.current = false;
    const { error } = await backend.auth.signOut({ scope: "local" });
    if (error) {
      M("Ieșirea nu s-a încheiat. Reîncearcă online: " + error.message);
      throw error;
    }
  };
  const items = [
    "Azi",
    ...(data && canOperate(data.role) ? ["Rezervări"] : []),
    "Scanner",
    ...(data && canFinance(data.role)
      ? ["Oferte", "Financiar", "Statistici", "Profil", "Echipă", "Evenimente"]
      : []),
    "Ajutor",
  ];
  useEffect(() => {
    if (!items.includes(tab)) T("Azi");
  }, [data?.role, tab]);
  const selected = venues.find((v) => v.venue_id === venue);
  const nav = (
    <View
      style={{
        backgroundColor: "#0E1440",
        padding: wide ? 20 : 12,
        gap: 16,
        width: wide ? 248 : undefined,
      }}
    >
      <Txt big style={{ color: "#fff", fontSize: 26 }}>
        CeFaci <Txt style={{ color: "#FFD43B", fontSize: 14 }}>Business</Txt>
      </Txt>
      <View style={{ gap: 8 }}>
        {venues.map((v) => (
          <Button
            key={v.venue_id}
            label={`${v.name} · ${v.role}`}
            secondary={v.venue_id !== venue}
            onPress={() => {
              if (v.venue_id === venue) {
                void refresh();
                return;
              }
              scope.current.invalidate();
              D(null);
              S(v.venue_id);
            }}
          />
        ))}
      </View>
      <ScrollView
        horizontal={!wide}
        contentContainerStyle={{
          gap: 8,
          flexDirection: wide ? "column" : "row",
        }}
      >
        {items.map((item) => (
          <Button
            key={item}
            label={item}
            nav
            secondary={item !== tab}
            onPress={() => T(item)}
          />
        ))}
      </ScrollView>
      {wide && (
        <View style={{ alignItems: "center", marginTop: 20 }}>
          <Bilu mood="up" size={105} still />
        </View>
      )}
      <Button
        label="Revendică sau adaugă un local"
        secondary
        onPress={() => Onboarding(true)}
      />
      <Button
        label="Ieși din cont"
        secondary
        onPress={() => void signOut().catch((e) => M(e instanceof Error ? e.message : "Ieșirea nu s-a încheiat. Reîncearcă."))}
      />
    </View>
  );
  if (!loaded)
    return (
      <ActivityIndicator accessibilityLabel="Verific accesul la localuri" />
    );
  if ((!venues.length || onboarding) && helpBeforeAccess)
    return <ScrollView contentContainerStyle={{padding: 20, gap: 20, maxWidth: 760, width: "100%", alignSelf: "center"}}>
      <Button label="Înapoi la cererile Business" secondary onPress={() => HelpBeforeAccess(false)} />
      <BusinessHelp key={session.user.id + ":onboarding"} userId={session.user.id} />
    </ScrollView>;
  if (!venues.length || onboarding)
    return <BusinessOnboarding
      session={session}
      accessError={message}
      onRefreshAccess={loadVenues}
      onSignOut={signOut}
      onBack={venues.length ? () => Onboarding(false) : undefined}
      onHelp={() => HelpBeforeAccess(true)}
    />;
  const p: ScreenProps = data ? { venue, data, act, busy } : (null as any);
  const content = tab === "Ajutor" ? <BusinessHelp key={venue + ":" + session.user.id} userId={session.user.id} venue={data ? venue : undefined} /> : data ? (
    tab === "Azi" ? (
      <Today {...p} />
    ) : tab === "Rezervări" ? (
      <Reservations {...p} />
    ) : tab === "Scanner" ? (
      <Scanner {...p} />
    ) : tab === "Financiar" ? (
      <Finances {...p} />
    ) : tab === "Oferte" ? (
      <Offers {...p} />
    ) : tab === "Profil" ? (
      <Profile {...p} />
    ) : tab === "Echipă" ? (
      <Team {...p} />
    ) : tab === "Statistici" ? (
      <Statistics {...p} />
    ) : (
      <Card title="Evenimente și bilete">
        <Txt>
          Vânzarea de bilete și încasarea plăților așteaptă configurarea
          circuitului de plată și fiscal. Nu poți vinde bilete din această
          versiune.
        </Txt>
      </Card>
    )
  ) : (
    <Card title="Verific accesul">
      <Txt>{message || "Se actualizează datele localului…"}</Txt>
      <Button label="Reîncearcă" onPress={() => void refresh()} />
    </Card>
  );
  return (
    <View style={{ flex: 1, flexDirection: wide ? "row" : "column" }}>
      {nav}
      <ScrollView
        key={venue + ":" + session.user.id}
        contentContainerStyle={{
          padding: wide ? 32 : 16,
          gap: 20,
          width: "100%",
          maxWidth: 1240,
          alignSelf: "center",
        }}
      >
        <Row>
          <View style={{ flex: 1 }}>
            <Txt muted>
              {selected?.name} · {data?.role ?? selected?.role}
            </Txt>
            <Txt big>{tab}</Txt>
          </View>
          <Button
            label="Actualizează"
            secondary
            disabled={busy}
            onPress={() => void refresh()}
          />
        </Row>
        {!!message && data && (
          <Card>
            <Txt>{message}</Txt>
          </Card>
        )}
        {data?.role === "proprietar" && <OwnershipDisputes key={venue + ":" + session.user.id} venue={venue} />}
        <View key={tab + ":" + data?.role} style={{ gap: 20 }}>
          {content}
        </View>
      </ScrollView>
    </View>
  );
}
export default function App() {
  const [fonts] = useFonts({
    BricolageGrotesque_800ExtraBold,
    BricolageGrotesque_700Bold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    Caveat_700Bold,
  });
  const [session, S] = useState<Session | null>(null),
    [ready, R] = useState(false),
    [theme, T] = useState<"zi" | "noapte">("zi");
  useEffect(() => {
    void AsyncStorage.getItem("business-theme").then((v) => {
      if (v === "noapte") T(v);
    }).catch(() => { /* Theme preference is optional when local storage is unavailable. */ });
    let changed = false;
    const { data } = backend.auth.onAuthStateChange((_event, next) => {
      changed = true;
      S(next);
      R(true);
    });
    void backend.auth.getSession().then(({ data }) => {
      if (!changed) {
        S(data.session);
        R(true);
      }
    }).catch(() => { if (!changed) R(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  const t = theme === "zi" ? zi : noapte;
  return (
    <SafeAreaProvider>
      <ThemeCtx.Provider value={{ t, name: theme, set: T }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
          <StatusBar style={t.dark ? "light" : "dark"} />
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              alignItems: "flex-end",
            }}
          >
            <Button
              label={t.dark ? "Mod zi" : "Mod noapte"}
              secondary
              onPress={() => {
                const n = t.dark ? "zi" : "noapte";
                T(n);
                void AsyncStorage.setItem("business-theme", n).catch(() => {});
              }}
            />
          </View>
          {!fonts || !ready ? (
            <ActivityIndicator accessibilityLabel="Se încarcă CeFaci Business" />
          ) : session ? (
            <Workspace key={session.user.id} session={session} />
          ) : (
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
            >
              <BusinessEntry />
            </ScrollView>
          )}
        </SafeAreaView>
      </ThemeCtx.Provider>
    </SafeAreaProvider>
  );
}

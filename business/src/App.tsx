import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  AppState,
  Platform,
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
import { BusinessSecurityGate } from "./security";
import { BusinessTutorial } from "./tutorial";
import { BusinessPrivacy } from "./privacy";
import { useSecureAccess } from "../../shared/use-secure-access";
import { securitySessionKey } from "../../shared/security-mfa";
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
function Workspace({ session, hasAccess, checkAccess, logout }: { session: Session; hasAccess: boolean; checkAccess: () => Promise<void>; logout: () => Promise<void> }) {
  const wide = useWindowDimensions().width >= 920;
  const [tourReplay, TourReplay] = useState(0), [tourHighlight, TourHighlight] = useState<string | null>(null);
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
    if (!hasAccess) { V([]); S(""); L(true); await checkAccess(); return; }
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
  }, [hasAccess, checkAccess]);
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
    await logout();
  };
  const items = [
    "Azi",
    ...(data && canOperate(data.role) ? ["Rezervări"] : []),
    "Scanner",
    ...(data && canFinance(data.role)
      ? ["Oferte", "Financiar", "Statistici", "Profil", "Echipă", "Evenimente"]
      : []),
    "Ajutor", "Confidențialitate",
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
          <View key={item} style={tourHighlight === item ? {borderWidth: 2, borderColor: "#FFD43B", borderRadius: 16} : undefined}><Button
            key={item}
            label={item}
            nav
            secondary={item !== tab}
            onPress={() => T(item)}
          /></View>
        ))}
      </ScrollView>
      {wide && (
        <View style={{ alignItems: "center", marginTop: 20 }}>
          <Bilu mood="up" size={105} still />
        </View>
      )}
      <Button label="Tur cu Bilu" secondary onPress={() => TourReplay(v => v + 1)} />
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
  if (!venues.length || onboarding) return <View style={{flex: 1}}>
    <Button label="Tur cu Bilu" secondary onPress={() => TourReplay(v => v + 1)} />
    {helpBeforeAccess ? <ScrollView contentContainerStyle={{padding: 20, gap: 20, maxWidth: 760, width: "100%", alignSelf: "center"}}>
      <Button label="Înapoi la cererile Business" secondary onPress={() => HelpBeforeAccess(false)} />
      <BusinessHelp key={session.user.id + ":onboarding"} userId={session.user.id} />
    </ScrollView> : <BusinessOnboarding session={session} accessError={message} onRefreshAccess={loadVenues} onSignOut={signOut} onBack={venues.length ? () => Onboarding(false) : undefined} onHelp={() => HelpBeforeAccess(true)} />}
    <BusinessTutorial userId={session.user.id} role="applicant" availableTabs={["Cereri","Ajutor"]} replayToken={tourReplay} onNavigate={tab => HelpBeforeAccess(tab === "Ajutor")} />
  </View>;
  const p: ScreenProps = data ? { venue, data, act, busy } : (null as any);
  const content = tab === "Confidențialitate" ? <BusinessPrivacy identity={securitySessionKey(session)}/> : tab === "Ajutor" ? <BusinessHelp key={venue + ":" + session.user.id} userId={session.user.id} venue={data ? venue : undefined} /> : data ? (
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
      {data && <BusinessTutorial userId={session.user.id} role={data.role} venueId={venue} availableTabs={items} replayToken={tourReplay} onNavigate={T} onHighlight={TourHighlight} />}
    </View>
  );
}
export default function App() {
  const [privacyOpen, PrivacyOpen] = useState(false);
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
  const security = useSecureAccess(session?.user.id ?? "", "business", call, session ? securitySessionKey(session) : '');
  const logout = async () => { security.lock(); try { await call("secure_session_close", {p_scope: "business"}); } finally { const {error} = await backend.auth.signOut({scope: "local"}); if (error) throw error; } };
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => {if (state === "active") void security.check();});
    if (Platform.OS !== "web") return () => listener.remove();
    const activity = () => security.activity(), focus = () => void security.check();
    window.addEventListener("pointerdown", activity); window.addEventListener("keydown", activity); window.addEventListener("focus", focus);
    return () => {listener.remove();window.removeEventListener("pointerdown", activity);window.removeEventListener("keydown", activity);window.removeEventListener("focus", focus);};
  }, [security.activity, security.check]);
  const t = theme === "zi" ? zi : noapte;
  return (
    <SafeAreaProvider>
      <ThemeCtx.Provider value={{ t, name: theme, set: T }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} onTouchStart={security.activity}>
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
          {privacyOpen && fonts && ready ? <ScrollView contentContainerStyle={{padding: 20, gap: 20, maxWidth: 900, width: '100%', alignSelf: 'center'}}><Button label="Înapoi la Business" secondary onPress={() => PrivacyOpen(false)}/><BusinessPrivacy identity={session ? securitySessionKey(session) : ''}/></ScrollView> : !fonts || !ready ? (
            <ActivityIndicator accessibilityLabel="Se încarcă CeFaci Business" />
          ) : session ? (
            security.error || !security.identity ? <Card><Txt big>Verificăm accesul…</Txt><Txt>{security.error || "Verificăm contul și rolul tău."}</Txt><Button label="Verifică din nou" onPress={() => void security.check()}/><Button label="Ieși din cont" secondary onPress={() => void logout().catch(() => {})}/></Card> : security.identity.business_access && !security.active ? <BusinessSecurityGate session={session} forcedChallenge={security.forcedChallenge} onVerified={security.verified} onLogout={logout}/> : <Workspace key={session.user.id + ":" + security.identity.business_access} session={session} hasAccess={security.active} checkAccess={security.check} logout={logout} />
          ) : (
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
            >
              <BusinessEntry />
            </ScrollView>
          )}
          {!privacyOpen && fonts && ready && <View style={{paddingHorizontal: 16, paddingVertical: 6}}><Button label="Termeni · Confidențialitate · Datele mele" secondary onPress={() => PrivacyOpen(true)}/></View>}
        </SafeAreaView>
      </ThemeCtx.Provider>
    </SafeAreaProvider>
  );
}

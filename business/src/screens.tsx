import { useEffect, useState, useRef } from "react";
import { View, Platform } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { CameraScanner } from "../../shared/CameraScanner";
import { Card, Txt, Button, Field, Row, Toggle, Empty, ask, ROLE_NAME } from "./ui";
import { call } from "./backend";
import { financePeriod, whole } from "./validation";
import {
  money,
  canFinance,
  canOperate,
  type Dashboard,
  type Reservation,
  type Finance,
  type Role,
  type Settings,
} from "../../shared/contracts";
import { showTime, localTime, bucharestTime } from "../../shared/time";
import { useTheme } from "../../shared/theme";
export type Action = (
  work: () => Promise<unknown>,
  success?: string,
) => Promise<void>;
export interface ScreenProps {
  venue: string;
  data: Dashboard;
  act: Action;
  busy: boolean;
  /** Deschide alt tab (de pe Azi spre Intrări). */
  go?: (tab: string) => void;
}
function ReservationCard({
  r,
  act,
  busy,
}: {
  r: Reservation;
  act: Action;
  busy: boolean;
}) {
  const [at, setAt] = useState(localTime(new Date(r.at)));
  return (
    <Card title={`${r.name ?? "Grup"} · ${r.people} persoane`}>
      <Txt>
        {showTime(r.at)} · {r.status}
      </Txt>
      <Txt muted>
        {r.kids} copii sub 12 ani. {r.note}
      </Txt>
      {r.response_due_at && r.status === "cerută" && (
        <Txt muted>Răspunde până la {showTime(r.response_due_at)}</Txt>
      )}
      {r.status === "propusă" && (
        <Txt muted>
          Ora este ținută pentru client până la{" "}
          {showTime(r.proposal_expires_at!)}.
        </Txt>
      )}
      {r.status === "cerută" && (
        <>
          <Row>
            <Button
              label="Confirmă"
              disabled={busy}
              onPress={() =>
                void act(
                  () =>
                    call("reservation_decide_v2", {
                      p_id: r.id,
                      p_action: "confirm",
                    }),
                  "Rezervare confirmată.",
                )
              }
            />
            <Button
              label="Refuză"
              secondary
              disabled={busy}
              onPress={async () =>
                (await ask("Refuzi cererea?", "Clientul primește refuzul imediat.", "Refuză")) &&
                void act(
                  () =>
                    call("reservation_decide_v2", {
                      p_id: r.id,
                      p_action: "decline",
                    }),
                  "Cerere refuzată.",
                )
              }
            />
          </Row>
          <Field
            label="Altă oră București (AAAA-LL-ZZ HH:MM)"
            value={at}
            onChange={setAt}
          />
          <Button
            label="Propune ora · 15 minute pentru răspuns"
            secondary
            disabled={busy}
            onPress={() =>
              void act(
                () =>
                  call("reservation_decide_v2", {
                    p_id: r.id,
                    p_action: "propose",
                    p_at: bucharestTime(at),
                  }),
                "Propunerea a ajuns la grup.",
              )
            }
          />
        </>
      )}
    </Card>
  );
}
export function Reservations({ data, act, busy }: ScreenProps) {
  return (
    <>
      <Card title="Programul rezervărilor">
        <Txt muted>
          Locurile sunt verificate pe interval și durată. Pentru minimum opt
          persoane confirmi manual. Rezervările la telefon sau pe site rămân
          externe.
        </Txt>
        <Txt>
          Capacitate {data.settings.capacity} · durată {data.settings.duration}{" "}
          minute
        </Txt>
      </Card>
      {!data.requests.length && (
        <Card>
          <Empty />
        </Card>
      )}
      {data.requests.map((r) => (
        <ReservationCard key={r.id} r={r} act={act} busy={busy} />
      ))}
    </>
  );
}
export function Today(p: ScreenProps) {
  const { data } = p;
  return (
    <>
      <Card title="Ce se întâmplă azi">
        <Row>
          <Txt big>
            {((n) => n + (n === 1 ? " cerere" : " cereri"))(data.requests.filter((r) => r.status === "cerută").length)}
          </Txt>
          <Txt big>
            {data.visits.filter((v) => !v.closed_at).length} de închis
          </Txt>
        </Row>
        <Txt muted>
          Zi financiară {data.day} · cuvântul zilei: {data.word}
        </Txt>
        <Txt>
          {data.settings.paused
            ? "Local în pauză"
            : data.settings.on
              ? "Primim rezervări prin CeFaci"
              : "Rezervările noi sunt oprite"}
        </Txt>
      </Card>
      {canOperate(data.role) &&
        data.requests
          .filter((r) => r.status === "cerută" || r.status === "propusă")
          .map((r) => (
            <ReservationCard key={r.id} r={r} act={p.act} busy={p.busy} />
          ))}
      <Card title="Intrări CeFaci">
        <Txt>
          {((n) => (n === 1 ? "1 intrare" : n + " intrări"))(data.visits.length)} azi și ieri
          {data.visits.some((v) => !v.closed_at) ? ` · ${data.visits.filter((v) => !v.closed_at).length} așteaptă bonul` : ""}
        </Txt>
        <Txt muted>
          Gășcile venite din CeFaci, bonurile lor și cei 10% pentru CeFaci sunt la „Intrări”. Acolo scanezi biletul
          clientului și faci poză notei.
        </Txt>
        {p.go && <Button label="Deschide Intrări" onPress={() => p.go!("Intrări")} />}
      </Card>
    </>
  );
}
export function Scanner({ venue, data, act, busy }: ScreenProps) {
  const [camera, C] = useState(false),
    [ticket, T] = useState(""),
    [table, M] = useState(""),
    [result, S] = useState<any>(null);
  const scanRequest = useRef(0);
  useEffect(() => () => { scanRequest.current++; }, [venue]);
  const scan = (code: string) => {
    if (busy) return;
    const n = ++scanRequest.current;
    S(null);
    C(false);
    // a ticket bought in CeFaci (Evenimente și bilete): its own check, once per ticket
    if (code.trim().startsWith("CFB1.")) {
      void act(async () => {
        const r = await call<any>("biz_ticket_scan", { p_venue: venue, p_code: code.trim() });
        if (n === scanRequest.current) S({ ...r, ticket: true });
      }, "Biletul a fost verificat.");
      return;
    }
    void act(async () => {
      const r = await call("biz_scan_v2", {
        p_venue: venue,
        p_ticket: code.trim(),
        p_table: table.trim() || null,
      });
      if (n === scanRequest.current) S(r);
    }, "Sosirea este înregistrată.");
  };
  return (
    <>
      <Card title="Scanează biletul grupului">
        <Txt muted>
          Tot aici scanezi și biletele la evenimente cumpărate în CeFaci.
          Biletul este comun participanților. Scanările repetate arată aceeași
          sosire. Camera funcționează pe web prin HTTPS. Pentru poza notei,
          folosește „Intrări” → „Scanează biletul clientului”.
        </Txt>
        <Field label="Masa (opțional)" value={table} onChange={M} />
        <Button
          label="Deschide camera"
          disabled={busy}
          onPress={() => C(true)}
        />
        {camera && <CameraScanner onScan={scan} onClose={() => C(false)} />}
        <Field label="Codul biletului" value={ticket} onChange={T} />
        <Button
          label="Verifică biletul"
          secondary
          disabled={busy || !ticket.trim()}
          onPress={() => scan(ticket)}
        />
      </Card>
      {result?.ticket && (
        <Card title={result.ok ? "Poate intra" : "Biletul a fost deja folosit"} tint={result.ok ? undefined : "#FFE4DE"}>
          <Txt big>{result.type} · {result.name}</Txt>
          <Txt>{result.event}{result.test ? " · bilet de TEST" : ""}</Txt>
          <Txt muted>
            {result.ok
              ? `Au intrat ${result.inside} din ${result.sold}.`
              : `Folosit la ${new Date(result.used_at).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}. Nu-l lăsa să intre a doua oară.`}
          </Txt>
        </Card>
      )}
      {result && !result.ticket && (
        <Card title={`${result.name ?? "Grup"} · ${result.people} persoane`}>
          <Txt big>−{result.discount}%</Txt>
          <Txt>
            {result.scope === "eligible_consumption"
              ? `Doar consumul a ${result.discount_people} persoane Drop.`
              : "Întreaga notă eligibilă a grupului."}
          </Txt>
          <Txt muted>
            Fără cumul. Cuvânt: {result.word}.{" "}
            {result.table ? `Masa ${result.table}.` : ""}
          </Txt>
        </Card>
      )}
    </>
  );
}
export function Finances({ venue, data: dashboard, act, busy }: ScreenProps) {
  const request = useRef(0);
  const [from, F] = useState(localTime().slice(0, 7) + "-01"),
    [to, T] = useState(localTime().slice(0, 10)),
    [data, S] = useState<Finance | null>(null),
    [error, E] = useState("");
  const selectedPeriod = useRef({ from, to });
  useEffect(() => {
    let active = true;
    const n = ++request.current;
    void call<Finance>("biz_finance_v2", {
      p_venue: venue,
      p_from: selectedPeriod.current.from,
      p_to: selectedPeriod.current.to,
    })
      .then((v) => {
        if (active && n === request.current) { S(v); E(""); }
      })
      .catch((e) => {
        if (active && n === request.current) { S(null); E(e instanceof Error ? e.message : "Financiarul nu s-a actualizat. Reîncearcă online."); }
      });
    return () => {
      active = false;
      request.current++;
    };
  }, [venue, dashboard]);
  return (
    <>
      {!!error && <Card><Txt>{error}</Txt></Card>}
      {data && (
        <Card title="Rămas localului" tint="#FFD43B">
          <Txt big style={{ color: "#0E1440", fontSize: 38, lineHeight: 46 }}>
            {money(data.remaining)}
          </Txt>
          <Txt style={{ color: "#0E1440" }}>
            Încasări după reduceri minus comisionul CeFaci
          </Txt>
          {data.partial && (
            <Txt style={{ color: "#0E1440" }}>
              Total parțial: {data.missing} vizite fără sume/închidere,{" "}
              {data.blocked} calcule neconfirmate. Nu afișăm un net final.
            </Txt>
          )}
        </Card>
      )}
      <Card title="Perioada">
        <Field label="De la (AAAA-LL-ZZ)" value={from} onChange={F} />
        <Field label="Până la (AAAA-LL-ZZ)" value={to} onChange={T} />
        <Button
          label="Vezi financiarul"
          disabled={busy}
          onPress={() =>
            void act(async () => {
              const period = financePeriod(from, to);
              selectedPeriod.current = period;
              const n = ++request.current;
              S(null);
              E("");
              const result = await call<Finance>("biz_finance_v2", {
                  p_venue: venue,
                  p_from: from,
                  p_to: to,
                });
              if (n === request.current) S(result);
            })
          }
        />
      </Card>
      {data && (
        <>
          <Card title="Încasări și reduceri">
            <Txt big>{money(data.revenue)} încasări</Txt>
            <Txt>{money(data.discounts)} reduceri acordate</Txt>
            <Txt muted>
              Reducerea este deja inclusă în suma plătită de client.
            </Txt>
          </Card>
          <Card title="Comision CeFaci · 10% din bonuri">
            <Txt big>{money(data.fee)}</Txt>
            <Txt muted>
              În perioada gratuită: ai fi plătit {money(data.would_pay)}.
              Valoare informativă, fără datorie.
            </Txt>
            <Txt muted>
              Facturarea și colectarea plăților nu sunt configurate. Nu sunt
              emise documente fiscale din această aplicație.
            </Txt>
          </Card>
          <Card title="Intrările perioadei">
            {!data.lines.length && <Empty />}
            {data.lines.map((l) => (
              <View key={l.visit} style={{ gap: 4 }}>
                <Txt>
                  #{l.no} · {l.day} · {l.receipts} {l.receipts === 1 ? "bon" : "bonuri"} · {money(l.bill)} →{" "}
                  {l.free
                    ? `ai fi plătit ${money(l.would_pay)} (lună gratuită)`
                    : `CeFaci ${Math.round(l.calculation.rate * 100)}% = ${money(l.fee)}`}
                </Txt>
                {!l.receipts && <Txt muted>Fără bon: nu se plătește nimic.</Txt>}
              </View>
            ))}
            <Txt muted>
              10% din bonurile necontestate ale fiecărei intrări. Bonurile contestate rămân în afara calculului
              până le verifică echipa CeFaci.
            </Txt>
          </Card>
        </>
      )}
    </>
  );
}
function WeeklyHours({
  value,
  onChange,
  plus = false,
}: {
  value: any[];
  onChange: (v: any[]) => void;
  plus?: boolean;
}) {
  const names = [
    "Luni",
    "Marți",
    "Miercuri",
    "Joi",
    "Vineri",
    "Sâmbătă",
    "Duminică",
  ];
  return (
    <>
      {names.map((name, i) => {
        const rows = value.map((r, index) => ({ r, index })).filter(({ r }) => r.day === i + 1);
        const add = () => onChange([...value, {
          day: i + 1, from: "10:00", to: "23:00", ...(plus ? { pct: 15 } : {}),
        }]);
        return (
          <View key={name} style={{ gap: 8 }}>
            <Toggle label={name} value={rows.length > 0}
              onChange={(enabled) => enabled ? add() : onChange(value.filter((r) => r.day !== i + 1))} />
            {rows.map(({ r, index }, interval) => {
              const prefix = rows.length > 1 ? `${name} interval ${interval + 1}` : name;
              const put = (field: string, v: unknown) => onChange(value.map((rule, n) => n === index ? { ...rule, [field]: v } : rule));
              return <View key={index} style={{ gap: 8 }}>
                <Row>
                  <Field label={`${prefix} de la`} value={r.from} onChange={(v) => put("from", v)} />
                  <Field label={`${prefix} până la`} value={r.to} onChange={(v) => put("to", v)} />
                  {plus && <Field label={`${prefix} reducere %`} numeric value={String(r.pct)} onChange={(v) => put("pct", v)} />}
                </Row>
                {rows.length > 1 && <Button label={`Șterge ${prefix.toLowerCase()}`} secondary onPress={() => onChange(value.filter((_, n) => n !== index))} />}
              </View>;
            })}
            {!!rows.length && <Button label={`Adaugă interval ${name.toLowerCase()}`} secondary onPress={add} />}
          </View>
        );
      })}
    </>
  );
}
export function Offers({ venue, data, act, busy }: ScreenProps) {
  const program = data.plus_program;
  const initialPct = program ? (program.next ? program.next.pct : program.base_pct) : 15;
  const initialSchedule = Array.isArray(program?.next?.schedule)
    ? program.next.schedule : program?.current_schedule ?? [];
  const [pct, P] = useState(initialPct),
    [schedule, S] = useState<any[]>(initialSchedule),
    [title, T] = useState(""),
    [free, F] = useState("10"),
    [plus, Q] = useState("20"),
    [seats, N] = useState("12"),
    [minutes, D] = useState("120"),
    [min, M] = useState("1"),
    [at, A] = useState(""),
    [adult, E] = useState(true),
    [only, O] = useState(false),
    [edit, J] = useState<string | null>(null);
  const dirty = useRef(false);
  const programSignature = JSON.stringify([initialPct, initialSchedule]);
  useEffect(() => {
    if (!dirty.current) { P(initialPct); S(initialSchedule); }
  }, [programSignature]);
  const key = useRef("drop:" + Date.now() + ":" + Math.random());
  return (
    <>
      <Card title="Program Plus">
        <Txt>
          Astăzi {data.plus_program?.current_pct ?? 0}% ·{" "}
          {data.plus_program?.today_off ? "oprit azi" : "activ"} ·{" "}
          {data.plus_program?.off_days_this_month ?? 0}/4 zile oprite
        </Txt>
        {data.plus_program?.next && (
          <Txt muted>
            De la {data.plus_program.next.effective_date}:{" "}
            {data.plus_program.next.pct ?? 0}%
          </Txt>
        )}
        <Row>
          {[null, 10, 15, 20].map((n) => (
            <Button
              key={n ?? "off"}
              label={n === null ? "Bază oprită" : `${n}%`}
              secondary={n !== pct}
              onPress={() => { dirty.current = true; P(n); }}
            />
          ))}
        </Row>
        <Txt muted>
          Intervale opționale: procentul din interval înlocuiește baza. În afara
          lor se aplică baza. O valoare de 0 oprește Plus în acel interval.
        </Txt>
        <WeeklyHours plus value={schedule} onChange={(v) => { dirty.current = true; S(v); }} />
        <Button
          label="Salvează pentru mâine"
          disabled={busy}
          onPress={() =>
            void act(
              async () => {
                await call("biz_plus_v2", {
                  p_venue: venue,
                  p_pct: pct,
                  p_schedule: schedule.map((r) => ({ ...r, pct: whole(String(r.pct), "Reducere în interval", 0, 20) })),
                });
                dirty.current = false;
              },
              "Programul intră în vigoare mâine, în București.",
            )
          }
        />
        <Button
          label="Oprește Plus doar azi"
          secondary
          disabled={busy || data.plus_program?.today_off}
          onPress={async () =>
            (await ask("Oprești Plus azi?", "Folosește una din cele 4 zile pe lună și nu se mai poate porni azi.", "Oprește azi")) &&
            void act(
              () => call("biz_plus_off_today", { p_venue: venue }),
              "Plus oprit astăzi. Vizitele deja înregistrate își păstrează drepturile.",
            )
          }
        />
        <Txt muted>Înainte de 16:00, maximum patru zile distincte pe lună.</Txt>
      </Card>
      <Card title={edit ? "Editează oferta viitoare" : "Un Live Drop nou"}>
        <Field label="Oferta" value={title} onChange={T} />
        <Row>
          <Field label="Reducere Free (10–15%)" numeric value={free} onChange={F} />
          <Field label="Reducere Plus (15–30%, cu ≥5 peste Free)" numeric value={plus} onChange={Q} />
        </Row>
        <Row>
          <Field
            label="Locuri totale (4–40)"
            numeric
            value={seats}
            onChange={N}
          />
          <Field label="Grup minim (1–6)" numeric value={min} onChange={M} />
          <Field
            label="Durată în minute"
            numeric
            value={minutes}
            onChange={D}
          />
        </Row>
        <Field
          label="Ora București; lasă gol pentru acum"
          value={at}
          onChange={A}
        />
        <Toggle
          label="Doar persoane de minimum 18 ani"
          value={adult}
          onChange={E}
        />
        <Toggle
          label="Doar clienți noi prin CeFaci în ultimele 12 luni"
          value={only}
          onChange={O}
        />
        <Txt muted>
          Maximum șase locuri pe revendicare, 12 ore de oferte pe săptămână și
          două ore între oferte. Fără tutun sau vape.
        </Txt>
        <Button
          label={edit ? "Salvează oferta" : "Publică Live Drop"}
          disabled={busy || !title.trim()}
          onPress={() =>
            void act(async () => {
              const t = title.trim(), pctAll = whole(free, "Reducere Free", 10, 15), pctPlus = whole(plus, "Reducere Plus", 15, 30);
              if (t.length < 3 || t.length > 60) throw new Error("Numele ofertei are între 3 și 60 de caractere.");
              if (pctPlus < pctAll + 5) throw new Error("Reducerea Plus e cu cel puțin 5 puncte peste cea Free.");
              await call("drop_create_v2", {
                p_venue: venue,
                p_title: t,
                p_all: pctAll,
                p_plus: pctPlus,
                p_seats: whole(seats, "Locuri totale", 4, 40),
                p_minutes: whole(minutes, "Durată", 15, 240),
                p_min: whole(min, "Grup minim", 1, 6),
                p_at: at ? bucharestTime(at) : null,
                p_adult: adult,
                p_new: only,
                p_key: key.current,
                p_edit: edit,
              });
              T("");
              J(null);
              key.current = "drop:" + Date.now() + ":" + Math.random();
            }, "Live Drop salvat.")
          }
        />
      </Card>
      {data.drops.map((d) => (
        <Card key={d.id} title={d.title}>
          <Txt>
            Free −{d.pct_all}% · Plus −{d.pct_plus}% · {d.taken ?? 0}/{d.seats}{" "}
            locuri
          </Txt>
          <Txt muted>
            {showTime(d.starts_at)} — {showTime(d.ends_at)}
          </Txt>
          {new Date(d.starts_at).getTime() > Date.now() && !d.taken && (
            <Button
              label="Editează oferta"
              secondary
              disabled={busy}
              onPress={() => {
                J(d.id);
                T(d.title);
                F(String(d.pct_all));
                Q(String(d.pct_plus));
                N(String(d.seats));
                M(String(d.min_group));
                D(
                  String(
                    Math.round(
                      (new Date(d.ends_at).getTime() -
                        new Date(d.starts_at).getTime()) /
                        60000,
                    ),
                  ),
                );
                A(localTime(new Date(d.starts_at)));
                E(d.adult);
                O(d.new_only);
              }}
            />
          )}
          <Button
            label="Oprește oferta"
            secondary
            disabled={busy}
            onPress={async () =>
              (await ask("Oprești oferta?", "Nu mai apare clienților. Claim-urile valabile rămân.", "Oprește")) &&
              void act(
                () => call("drop_stop", { p_id: d.id }),
                "Oferta este oprită. Claim-urile valabile sunt păstrate.",
              )
            }
          />
        </Card>
      ))}
    </>
  );
}
export function Profile({ venue, data, act, busy }: ScreenProps) {
  const [c, S] = useState<Settings>(data.settings),
    [capacity, C] = useState(String(data.settings.capacity)),
    [duration, D] = useState(String(data.settings.duration)),
    [auto, A] = useState(String(data.settings.auto));
  const update = (p: Partial<Settings>) => S({ ...c, ...p });
  return (
    <>
      <Card title="Profilul localului">
        <Txt>
          {data.partner.firm ?? "Partener CeFaci"}
          {data.partner.cui ? ` · CUI ${data.partner.cui}` : ""}
        </Txt>
        <Txt muted>
          Rol activ: {data.role}. Editează numai localul selectat.
        </Txt>
        <Row>
          {(["required", "recommended", "none"] as const).map((mode, i) => (
            <Button
              key={mode}
              label={["Rezervări obligatorii", "Recomandate", "Nenecesare"][i]}
              secondary={c.mode !== mode}
              onPress={() => update({ mode })}
            />
          ))}
        </Row>
        <Toggle
          label="Primim rezervări noi prin CeFaci"
          value={c.on}
          onChange={(on) => update({ on })}
        />
        <Toggle
          label="Pauză generală pentru planuri noi"
          value={c.paused}
          onChange={(paused) => update({ paused })}
        />
        <Txt muted>
          Obligatorii + oprite: ascuns pentru planuri noi. Recomandate + oprite:
          clientul poate merge direct. Istoricul și beneficiile revendicate
          rămân accesibile.
        </Txt>
        <Field
          label="Capacitate persoane"
          numeric
          value={capacity}
          onChange={C}
        />
        <Field
          label="Durată rezervare (minute)"
          numeric
          value={duration}
          onChange={D}
        />
        <Field
          label="Auto-confirmare până la (maximum 7)"
          numeric
          value={auto}
          onChange={A}
        />
        <WeeklyHours value={c.hours} onChange={(hours) => update({ hours })} />
        <Button
          label="Salvează setările"
          disabled={busy}
          onPress={() =>
            void act(
              () =>
                call("biz_settings_v2", {
                  p_venue: venue,
                  p_mode: c.mode,
                  p_on: c.on,
                  p_paused: c.paused,
                  p_capacity: whole(capacity, "Capacitate", 0, 5000),
                  p_duration: whole(duration, "Durată", 30, 480),
                  p_auto: whole(auto, "Auto-confirmare", 0, 7),
                  p_hours: c.hours,
                }),
              "Setări salvate.",
            )
          }
        />
      </Card>
      {data.token && (
        <Card title="Codul localului pentru sosire">
          <View style={{ alignItems: "center" }}>
            <QRCode value={data.token} size={200} />
          </View>
          <Txt muted>
            Printează codul și expune-l în local. Clientul îl scanează cu
            verificarea locației.
          </Txt>
          {Platform.OS === "web" && (
            <Button
              label="Printează"
              secondary
              onPress={() => window.print()}
            />
          )}
        </Card>
      )}
    </>
  );
}
export function Team({ venue, data, act, busy }: ScreenProps) {
  const [rows, S] = useState<any[]>([]),
    [username, U] = useState(""),
    [role, R] = useState<Role>("receptie"),
    [error, E] = useState("");
  const request = useRef(0);
  const load = async () => {
    const n = ++request.current;
    try {
      const rows = await call<any[]>("biz_team", { p_venue: venue });
      if (n === request.current) { S(rows); E(""); }
    } catch (e) {
      if (n === request.current) {
        S([]);
        E(e instanceof Error ? e.message : "Echipa nu s-a actualizat. Reîncearcă online.");
      }
    }
  };
  useEffect(() => {
    void load();
    return () => { request.current++; };
  }, [venue, data]);
  return (
    <>
      <Card title="Echipa localului">
        {!!error && <Txt>{error}</Txt>}
        <Button label="Reîncarcă echipa" secondary disabled={busy} onPress={() => void load()} />
        <Txt muted>
          Persoana folosește același cont CeFaci. Recepția lucrează cu rezervări
          și sosiri; scanarea doar cu sosiri. Revocarea se aplică imediat pe
          server.
        </Txt>
        <Field label="Username CeFaci" value={username} onChange={U} />
        <Row>
          {(["manager", "receptie", "scanare"] as Role[])
            .filter(
              (r) =>
                data.role === "proprietar" ||
                r === "receptie" ||
                r === "scanare",
            )
            .map((r) => (
              <Button
                key={r}
                label={ROLE_NAME[r] ?? r}
                secondary={r !== role}
                onPress={() => R(r)}
              />
            ))}
        </Row>
        <Button
          label="Adaugă / schimbă rolul"
          disabled={busy || !username.trim()}
          onPress={() =>
            void act(async () => {
              await call("biz_team_set", {
                p_venue: venue,
                p_username: username,
                p_role: role,
              });
              await load();
            }, "Echipă actualizată.")
          }
        />
      </Card>
      {rows.map((r) => (
        <Card key={r.user_id} title={`@${r.username}`}>
          <Txt>
            {r.first_name} · {ROLE_NAME[r.role] ?? r.role} · {r.active ? "activ" : "revocat"}
          </Txt>
          {r.active &&
            r.role !== "proprietar" &&
            (data.role === "proprietar" || r.role !== "manager") && (
              <Button
                label="Revocă accesul"
                secondary
                disabled={busy}
                onPress={async () =>
                  (await ask("Revoci accesul lui @" + r.username + "?", "Nu mai poate folosi Business pentru acest local.", "Revocă")) &&
                  void act(async () => {
                    await call("biz_team_set", {
                      p_venue: venue,
                      p_username: r.username,
                      p_role: "scos",
                    });
                    await load();
                  }, "Acces revocat.")
                }
              />
            )}
        </Card>
      ))}
    </>
  );
}
export function Statistics({ data }: ScreenProps) {
  return (
    <Card title="Ultimele 30 de zile">
      <Txt big>{data.statistics.visits} vizite</Txt>
      <Txt>{data.statistics.people} persoane cu număr confirmat</Txt>
      <Txt>{data.statistics.reservations} cereri de rezervare</Txt>
      <Txt>{data.statistics.unclosed} vizite rămase de închis</Txt>
      <Txt muted>
        Date reale din localul selectat. Grupurile contestate nu intră în
        numărul confirmat.
      </Txt>
    </Card>
  );
}

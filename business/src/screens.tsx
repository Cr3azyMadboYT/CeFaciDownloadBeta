import { useEffect, useState, useRef } from "react";
import { View, Platform } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { CameraScanner } from "../../shared/CameraScanner";
import { Card, Txt, Button, Field, Row, Toggle, Empty } from "./ui";
import { call } from "./backend";
import { amount } from "./amount";
import {
  money,
  canFinance,
  canOperate,
  type Dashboard,
  type Reservation,
  type Visit,
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
              onPress={() =>
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
function CloseVisit({
  v,
  act,
  busy,
  role,
}: {
  v: Visit;
  act: Action;
  busy: boolean;
  role: Role;
}) {
  const [open, setOpen] = useState(false),
    [people, P] = useState(String(v.count?.people ?? v.people)),
    [adults, A] = useState(String(v.count?.adults ?? v.people)),
    [drop, D] = useState(
      String(v.count?.drop_adults ?? Math.min(v.people, v.drop_limit ?? 0)),
    ),
    [bill, B] = useState(v.bill === null ? "" : String(v.bill)),
    [discount, R] = useState(""),
    [reason, S] = useState(""),
    [reply, V] = useState("");
  return (
    <Card title={`${v.name ?? "Grup"} · ${v.people} persoane`}>
      <Txt>
        {showTime(v.at!)} · {v.kind}
        {v.table ? ` · masa ${v.table}` : ""}
      </Txt>
      <Txt style={{ fontSize: 20 }}>
        −{v.discount ?? 0}% {v.plus ? "Plus" : ""}
      </Txt>
      <Txt muted>
        {v.scope === "eligible_consumption"
          ? `Aplică numai consumului celor ${v.discount_people} persoane Drop, pe produse sau bon separat.`
          : "O singură reducere pentru întreaga notă eligibilă, fără cumul."}
      </Txt>
      <Txt>
        {v.closed_at ? "Închisă" : "De închis"}
        {v.count
          ? ` · număr ${v.count.state === "confirmed" ? "confirmat" : v.count.state === "awaiting" ? "așteaptă clientul" : "contestat"}`
          : ""}
      </Txt>
      {v.benefit && (
        <>
          <Txt>
            Reducere sesizată:{" "}
            {v.benefit.state === "pending"
              ? "în verificare"
              : v.benefit.state === "upheld"
                ? "refuz confirmat"
                : "închisă"}
          </Txt>
          <Txt muted>{v.benefit.reason}</Txt>
          {canFinance(role) && v.benefit.state === "pending" && (
            <>
              <Field label="Răspunsul localului" value={reply} onChange={V} />
              <Button
                label="Trimite răspunsul la sesizare"
                secondary
                disabled={busy || reply.trim().length < 5}
                onPress={() =>
                  void act(
                    () =>
                      call("biz_benefit_reply_v2", {
                        p_visit: v.id,
                        p_reply: reply,
                      }),
                    "Răspuns salvat pentru verificarea CeFaci.",
                  )
                }
              />
            </>
          )}
        </>
      )}
      {canFinance(role) && v.bill !== null && (
        <Txt>
          Încasare {money(v.bill)} ·{" "}
          {v.source === "bon" ? "bon verificat" : "declarată de local"}
        </Txt>
      )}
      {canOperate(role) && (
        <Button
          label={
            open
              ? "Ascunde închiderea"
              : v.closed_at
                ? "Revizuiește numărul"
                : "Închide vizita"
          }
          secondary
          onPress={() => setOpen(!open)}
        />
      )}{" "}
      {open && (
        <>
          <Field
            label="Persoane prezente (inclusiv copiii)"
            numeric
            value={people}
            onChange={P}
          />
          <Field
            label="Persoane de minimum 12 ani"
            numeric
            value={adults}
            onChange={A}
          />
          <Field
            label="Persoane de minimum 12 ani eligibile Drop"
            numeric
            value={drop}
            onChange={D}
          />
          <Txt muted>
            O reducere refuzată nejustificat se raportează separat; păstrează
            eligibilitatea sursei. Numărul redus cere confirmarea grupului.
          </Txt>
          <Field
            label="Încasare după reduceri (lei)"
            numeric
            value={bill}
            onChange={B}
          />
          <Field
            label="Reducere efectivă acordată (lei)"
            numeric
            value={discount}
            onChange={R}
          />
          {v.source === "bon" && (
            <Txt muted>
              Bonul verificat păstrează prioritatea asupra sumei manuale.
            </Txt>
          )}
          <Field
            label="Motivul unui număr diferit"
            value={reason}
            onChange={S}
          />
          <Button
            label="Salvează închiderea"
            disabled={busy}
            onPress={() =>
              void act(
                () =>
                  call("biz_close_v2", {
                    p_visit: v.id,
                    p_people: Number(people),
                    p_adults: Number(adults),
                    p_drop_adults: Number(drop),
                    p_bill: amount(bill),
                    p_discount: amount(discount),
                    p_reason: reason || null,
                  }),
                "Vizită salvată. Un număr neconfirmat rămâne în afara facturării.",
              )
            }
          />
        </>
      )}
    </Card>
  );
}
export function Today(p: ScreenProps) {
  const { data } = p;
  return (
    <>
      <Card title="Ce se întâmplă azi">
        <Row>
          <Txt big>
            {data.requests.filter((r) => r.status === "cerută").length} cereri
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
      {!data.visits.length && (
        <Card>
          <Empty text="Nu există sosiri înregistrate în ziua curentă sau precedentă." />
        </Card>
      )}
      {data.visits.map((v) => (
        <CloseVisit
          key={v.id}
          v={v}
          act={p.act}
          busy={p.busy}
          role={data.role}
        />
      ))}
    </>
  );
}
export function Scanner({ venue, data, act, busy }: ScreenProps) {
  const [camera, C] = useState(false),
    [ticket, T] = useState(""),
    [table, M] = useState(""),
    [result, S] = useState<any>(null);
  const scan = (code: string) => {
    C(false);
    void act(async () => {
      const r = await call("biz_scan_v2", {
        p_venue: venue,
        p_ticket: code.trim(),
        p_table: table.trim() || null,
      });
      S(r);
    }, "Sosirea este înregistrată.");
  };
  return (
    <>
      <Card title="Scanează biletul grupului">
        <Txt muted>
          Biletul este comun participanților. Scanările repetate arată aceeași
          sosire. Camera funcționează pe web prin HTTPS.
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
      {result && (
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
export function Finances({ venue, act, busy }: ScreenProps) {
  const request = useRef(0);
  const [from, F] = useState(localTime().slice(0, 7) + "-01"),
    [to, T] = useState(localTime().slice(0, 10)),
    [data, S] = useState<Finance | null>(null);
  useEffect(() => {
    let active = true;
    const n = ++request.current;
    void call<Finance>("biz_finance_v2", {
      p_venue: venue,
      p_from: from,
      p_to: to,
    })
      .then((v) => {
        if (active && n === request.current) S(v);
      })
      .catch(() => {});
    return () => {
      active = false;
      request.current++;
      S(null);
    };
  }, [venue]);
  return (
    <>
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
              const n = ++request.current;
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
          <Card title="Comision CeFaci">
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
          <Card title="Detaliile calculului">
            {!data.lines.length && <Empty />}
            {data.lines.map((l) => (
              <View key={l.visit} style={{ gap: 6 }}>
                <Txt>
                  {l.day} · {l.kind} · {money(l.fee)}{" "}
                  {l.free ? "(gratuit contractual)" : ""}
                </Txt>
                <Txt muted>
                  {l.calculation.drop_billable}{" "}
                  × {l.calculation.drop_unit} lei Drop; {l.calculation.reservation_billable} persoane ×{" "}
                  {l.calculation.reservation_unit} lei rezervare, maximum zece taxabile în total. Tarife păstrate la
                  sosire.
                </Txt>
              </View>
            ))}
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
        const r = value.find((x) => x.day === i + 1);
        const put = (field: string, v: any) =>
          onChange([
            ...value.filter((x) => x.day !== i + 1),
            {
              day: i + 1,
              from: r?.from ?? "10:00",
              to: r?.to ?? "23:00",
              ...(plus ? { pct: r?.pct ?? 15 } : {}),
              ...r,
              [field]: v,
            },
          ]);
        return (
          <View key={name} style={{ gap: 8 }}>
            <Toggle
              label={name}
              value={!!r}
              onChange={(v) =>
                onChange(
                  v
                    ? [
                        ...value,
                        {
                          day: i + 1,
                          from: "10:00",
                          to: "23:00",
                          ...(plus ? { pct: 15 } : {}),
                        },
                      ]
                    : value.filter((x) => x.day !== i + 1),
                )
              }
            />
            {r && (
              <Row>
                <Field
                  label={`${name} de la`}
                  value={r.from}
                  onChange={(v) => put("from", v)}
                />
                <Field
                  label={`${name} până la`}
                  value={r.to}
                  onChange={(v) => put("to", v)}
                />
                {plus && (
                  <Field
                    label={`${name} reducere %`}
                    numeric
                    value={String(r.pct)}
                    onChange={(v) => put("pct", Number(v))}
                  />
                )}
              </Row>
            )}
          </View>
        );
      })}
    </>
  );
}
export function Offers({ venue, data, act, busy }: ScreenProps) {
  const [pct, P] = useState(data.plus_program?.current_pct || 15),
    [schedule, S] = useState<any[]>([]),
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
          {[10, 15, 20].map((n) => (
            <Button
              key={n}
              label={`${n}%`}
              secondary={n !== pct}
              onPress={() => P(n)}
            />
          ))}
        </Row>
        <Txt muted>
          Intervale opționale: procentul din interval înlocuiește baza. În afara
          lor se aplică baza. O valoare de 0 oprește Plus în acel interval.
        </Txt>
        <WeeklyHours plus value={schedule} onChange={S} />
        <Button
          label="Salvează pentru mâine"
          disabled={busy}
          onPress={() =>
            void act(
              () =>
                call("biz_plus_v2", {
                  p_venue: venue,
                  p_pct: pct,
                  p_schedule: schedule,
                }),
              "Programul intră în vigoare mâine, în București.",
            )
          }
        />
        <Button
          label="Oprește Plus doar azi"
          secondary
          disabled={busy || data.plus_program?.today_off}
          onPress={() =>
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
          <Field label="Reducere Free (%)" numeric value={free} onChange={F} />
          <Field label="Reducere Plus (%)" numeric value={plus} onChange={Q} />
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
              await call("drop_create_v2", {
                p_venue: venue,
                p_title: title,
                p_all: Number(free),
                p_plus: Number(plus),
                p_seats: Number(seats),
                p_minutes: Number(minutes),
                p_min: Number(min),
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
            onPress={() =>
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
  const [c, S] = useState<Settings>(data.settings);
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
          value={String(c.capacity)}
          onChange={(v) => update({ capacity: Number(v) })}
        />
        <Field
          label="Durată rezervare (minute)"
          numeric
          value={String(c.duration)}
          onChange={(v) => update({ duration: Number(v) })}
        />
        <Field
          label="Auto-confirmare până la (maximum 7)"
          numeric
          value={String(c.auto)}
          onChange={(v) => update({ auto: Number(v) })}
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
                  p_capacity: c.capacity,
                  p_duration: c.duration,
                  p_auto: c.auto,
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
    [role, R] = useState<Role>("receptie");
  const load = async () => S(await call<any[]>("biz_team", { p_venue: venue }));
  useEffect(() => {
    let alive = true;
    void call<any[]>("biz_team", { p_venue: venue }).then((v) => {
      if (alive) S(v);
    });
    return () => {
      alive = false;
    };
  }, [venue]);
  return (
    <>
      <Card title="Echipa localului">
        <Txt muted>
          Persoana folosește același cont CeFaci. Recepția lucrează cu rezervări
          și sosiri; scanarea doar cu sosiri. Revocarea se aplică imediat pe
          server.
        </Txt>
        <Field label="Username CeFaci" value={username} onChange={U} />
        <Row>
          {(["proprietar", "manager", "receptie", "scanare"] as Role[])
            .filter(
              (r) =>
                data.role === "proprietar" ||
                r === "receptie" ||
                r === "scanare",
            )
            .map((r) => (
              <Button
                key={r}
                label={r}
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
            {r.first_name} · {r.role} · {r.active ? "activ" : "revocat"}
          </Txt>
          {r.active &&
            (data.role === "proprietar" ||
              !["proprietar", "manager"].includes(r.role)) && (
              <Button
                label="Revocă accesul"
                secondary
                disabled={busy}
                onPress={() =>
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

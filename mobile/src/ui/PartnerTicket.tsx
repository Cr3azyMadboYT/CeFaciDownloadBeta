import {useEffect,useState} from 'react';
import {View,TextInput} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {CameraScanner} from '../../../shared/CameraScanner';
import type {PlanState,Drop} from '../../../shared/contracts';
import {refreshPartner,requestReservation,proposalAnswer,ticketOf,dropsOf,claimDrop,countAnswer,watchPartner} from '../lib/partner';
import {type Plan,updPlan} from '../lib/plans';
import {useApp} from '../lib/session';
import {checkIn} from '../lib/outing';
import {Big,Muted,T} from './kit';
import {F,useTheme} from './theme';
export function PartnerTicket({plan}:{plan:Plan}){
 const {t}=useTheme();const user=useApp(s=>s.who?.id);const [state,setState]=useState<PlanState|null>(null);const [drops,setDrops]=useState<Drop[]>([]);const [ticket,setTicket]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [camera,setCamera]=useState(false);const [token,setToken]=useState('');const [kids,setKids]=useState('0');const [seats,setSeats]=useState('1');
 useEffect(()=>{let live=true;let seq=0;setState(null);setTicket('');setDrops([]);
  const load=async()=>{const n=++seq;try{const result=await refreshPartner(plan);if(!live||n!==seq)return;setState(result);
    if(result.attendance?.ready){const [q,d]=await Promise.all([ticketOf(result.attendance.plan),dropsOf(result.attendance.plan)]);if(live&&n===seq){setTicket(q.token);setDrops(d);}}
   }catch(e){if(live&&n===seq)setMessage((e as Error).message);}};
  void load();const stop=watchPartner(plan.sid,()=>void load());return()=>{live=false;seq++;stop();};
 },[plan.pid,plan.sid,user]);
 const act=async(work:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);setMessage('');try{await work();const s=await refreshPartner(plan);setState(s);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}};
 const r=state?.reservation;const c=state?.count;
 return <View style={{marginHorizontal:20,marginTop:14,padding:16,gap:12,borderRadius:20,backgroundColor:t.s1,borderColor:t.line,borderWidth:1}}>
  <T style={{fontFamily:F.display,fontSize:20}}>Prin CeFaci</T>
  <Muted>{state?.attendance?.ready?`${state.attendance.people} persoane în grupul final`:`Așteptăm răspunsurile. Termen: ${state?.attendance?.deadline?new Date(state.attendance.deadline).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'}):'30 de minute de la trimitere'}.`}</Muted>
  {r&&<T>{`Rezervare ${r.status} · ${new Date(r.at).toLocaleString('ro-RO')}`}</T>}
  {(!r||['expirată','anulată','refuzată'].includes(r.status))&&plan.owner!==false&&<>
   <Muted>Copii sub 12 ani, incluși în grup:</Muted><TextInput accessibilityLabel="Copii sub 12 ani" keyboardType="number-pad" value={kids} onChangeText={setKids} style={{color:t.ink,padding:12,borderColor:t.line,borderWidth:1,borderRadius:12}}/>
   <Big label={busy?'Trimit…':'Rezervă pentru noi'} disabled={busy||!state?.attendance?.ready} onPress={()=>void act(async()=>{if(r)updPlan(plan.pid,{reservationAttempt:(plan.reservationAttempt??0)+1});await requestReservation({...plan,reservationAttempt:r?(plan.reservationAttempt??0)+1:plan.reservationAttempt},Number(kids));})}/>
  </>}
  {r?.status==='propusă'&&plan.owner!==false&&<><Muted>{`Acceptă înainte de ${new Date(r.proposal_expires_at!).toLocaleTimeString('ro-RO')}`}</Muted><Big label="Accept ora" disabled={busy} onPress={()=>void act(()=>proposalAnswer(r.id,true))}/><Big label="Refuz propunerea" color={t.s2} ink={t.ink} disabled={busy} onPress={()=>void act(()=>proposalAnswer(r.id,false))}/></>}
  {ticket&&<View style={{alignItems:'center',gap:8}}><QRCode value={ticket} size={160}/><Muted>Biletul grupului pentru scannerul localului</Muted><T selectable>{ticket}</T></View>}
  {drops.length>0&&plan.owner!==false&&!state?.claim&&<><Muted>Locuri Drop (maximum șase, distinct de mărimea grupului):</Muted><TextInput accessibilityLabel="Locuri Drop" value={seats} onChangeText={setSeats} keyboardType="number-pad" style={{color:t.ink,padding:12,borderColor:t.line,borderWidth:1,borderRadius:12}}/>{drops.map(d=><Big key={d.id} label={`${d.title} · −${d.pct}% · ${d.seats} locuri`} disabled={busy} onPress={()=>void act(()=>claimDrop(plan,d.id,Number(seats)))}/>)}</>}
  {state?.claim&&<Muted>{`Drop ${state.claim.status} · ${state.claim.seats} locuri · valabil până la ${new Date(state.claim.expires_at).toLocaleTimeString('ro-RO')}`}</Muted>}
  {!plan.inAt&&<><Big label="Scanează codul localului" disabled={busy} onPress={()=>setCamera(true)}/>{camera&&<CameraScanner onScan={code=>{setCamera(false);void act(async()=>{const result=await checkIn(plan,code);setMessage(result.msg);if(!result.ok)throw new Error(result.msg);});}} onClose={()=>setCamera(false)}/>}<TextInput accessibilityLabel="Codul localului" value={token} onChangeText={setToken} autoCapitalize="none" style={{color:t.ink,padding:12,borderColor:t.line,borderWidth:1,borderRadius:12}}/><Big label="Confirmă sosirea cu codul" disabled={busy||!token.trim()} color={t.s2} ink={t.ink} onPress={()=>void act(async()=>{const result=await checkIn(plan,token.trim());setMessage(result.msg);if(!result.ok)throw new Error(result.msg);})}/></>}
  {state?.visit&&<Muted>{`Reducere ${state.visit.discount_pct??0}% · ${state.visit.discount_scope==='eligible_consumption'?`numai consumul celor ${state.visit.discount_people} persoane Drop, produse sau bon separat`:'întreaga notă eligibilă, fără cumul'}.`}</Muted>}
  {c?.state==='awaiting'&&<><T>{`Localul declară ${c.people} persoane, ${c.adults} de minimum 12 ani și ${c.drop_adults} eligibile Drop. Este corect?`}</T><Big label="Da, confirm numărul" disabled={busy} onPress={()=>void act(()=>countAnswer(c.visit_id,c.version,true))}/><Big label="Nu, contest numărul" disabled={busy} color={t.s2} ink={t.ink} onPress={()=>void act(()=>countAnswer(c.visit_id,c.version,false))}/></>}
  {!!message&&<T accessibilityRole="alert" style={{color:t.coralInk}}>{message}</T>}
 </View>;
}

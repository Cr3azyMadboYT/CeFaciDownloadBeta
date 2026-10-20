// Photos are transient. Authorization and quota precede OCR; a group's receipt is saved before XP.
// Intrarea și bonul (20.10): the receipt is linked to the group's entry (one receipt counted once, separate bills added,
// 10% of the total for CeFaci). `staff: true` = the waiter photographs the bill of an entry at their venue; the answer
// carries the entry (shared/entries.ts Entry) so both apps show „scanat de 3/5” and the total right away.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { parseBon, parseDiscount } from './bon.ts';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 if(req.method!=='POST')return json({error:'Doar POST.'},405);
 const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')??''}}});
 const{data:{user}}=await sb.auth.getUser();if(!user)return json({error:'Intră în cont ca să trimiți bonul.'},401);
 const key=Deno.env.get('VISION_API_KEY');if(!key)return json({error:'Citirea bonurilor nu e pornită încă.'},503);
 let image='',venue='',day='',visit='',staff=false;try{const b=await req.json();image=String(b.image??'');venue=String(b.venue??'').slice(0,80);day=/^\d{4}-\d\d-\d\d$/.test(b.day)?b.day:'';visit=/^[0-9a-f-]{36}$/i.test(b.visit)?b.visit:'';staff=b.staff===true;}catch{return json({error:'Cerere invalidă.'},400);}
 image=image.replace(/^data:image\/\w+;base64,/,'');if(!image||image.length>6_000_000)return json({error:'Poza lipsește sau e prea mare.'},400);
 if(!venue||!day)return json({error:'Actualizează aplicația ca să pui bonul.'},400);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 // Older non-partner outings keep their XP flow. Partner groups must use a common visit identity.
 const{data:partners,error:lookup}=await admin.from('partners').select('venue_id').eq('venue_id',venue).limit(1);
 if(lookup)return json({error:'Nu pot verifica localul acum.'},503);
 if(partners?.length&&!visit)return json({error:'Scanează întâi codul localului din bilet.'},400);
 if(staff&&!visit)return json({error:'Alege intrarea sau scanează biletul clientului.'},400);
 const{data:ready,error:readyError}=staff?await admin.rpc('visit_receipt_staff_ready_v3',{p_user:user.id,p_visit:visit}):visit?await admin.rpc('visit_receipt_ready_v2',{p_user:user.id,p_visit:visit}):await admin.rpc('xp_bill_ready',{p_user:user.id,p_venue:venue,p_day:day});
 if(readyError||!ready?.ok)return staff?json({error:ready?.error??'Nu pot verifica intrarea acum.'},403):json({xp:{gain:0,error:ready?.error??'Nu pot verifica bonul acum.'}});
 if(visit&&ready.venue!==venue)return json({error:'Vizita nu este la localul din bilet.'},400);
 let res:Response;try{res=await fetch('https://vision.googleapis.com/v1/images:annotate',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key},body:JSON.stringify({requests:[{image:{content:image},features:[{type:'DOCUMENT_TEXT_DETECTION'}],imageContext:{languageHints:['ro']}}]}),signal:AbortSignal.timeout(20000)});}catch{return json({error:'Citirea pozei nu a reușit. Reîncearcă.'},502);}
 if(!res.ok)return json({error:'Nu am putut citi poza acum.'},502);
 const data=await res.json();const text:string=data?.responses?.[0]?.fullTextAnnotation?.text??'';if(!text)return json({error:'Nu se vede textul. Fă poza mai de aproape.'},422);
 const bon=parseBon(text);if(!bon.total||!bon.cuiValid||!bon.date||!bon.time)return staff?json({bon,error:'Trebuie să se vadă CUI-ul, data, ora și totalul. Refă poza sau scrie totalul.'},422):json({bon,xp:{gain:0,error:'Trebuie să se vadă CUI-ul, data, ora și totalul.'}});
 let saved:{ok:boolean;visit:string;duplicate:boolean}|null=null;
 if(visit){const r=await admin.rpc('visit_receipt_v3',{p_user:user.id,p_visit:visit,p_cui:bon.cui,p_total:bon.total,p_discount:parseDiscount(text),p_date:bon.date,p_time:bon.time,p_number:bon.number,p_staff:staff});
  if(r.error||!r.data?.ok)return staff?json({bon,error:r.error?.message??'Bonul nu a fost confirmat.'},422):json({bon,xp:{gain:0,error:r.error?.message??'Bonul nu a fost confirmat.'}});saved=r.data;}
 const entry=visit?(await admin.rpc('entry_of_v3',{p_visit:visit})).data:undefined;
 if(staff)return json({bon,receipt:{ok:true,visit,duplicate:!!saved?.duplicate},entry});
 if(!visit){const next=new Date(Date.parse(day+'T12:00:00Z')+864e5).toISOString().slice(0,10);if(bon.date!==day&&bon.date!==next)return json({bon,xp:{gain:0,error:'Bonul e din altă zi.'}});}
 // each member of the group gets the XP once for the same receipt (the receipt itself counts once for the venue)
 const fp=[bon.cui,bon.date,bon.time,bon.total.toFixed(2)].join('|')+(visit?'|'+user.id:'');
 const{data:xp,error}=await admin.rpc('xp_bill',{p_user:user.id,p_venue:venue,p_day:day,p_receipt:fp});
 return json({bon,receipt:visit?{ok:true,visit,duplicate:!!saved?.duplicate}:undefined,entry,xp:error?{gain:0,error:'XP-ul nu a fost scris acum.'}:xp});
});

// Evenimente (22.10): the team adds concerts, stand-up, theatre… with the official seller's link. CeFaci sells nothing:
// the link must be https and from a seller on the list (checked here and again on the server). Removable with the
// feature (docs/evenimente.md).
import {useState} from 'react';
import {rpc,type Admin} from './backend';
import {useAction,useData} from './hooks';
import {Card,Empty,Loading,Notice,Tag,date} from './ui';
import {KIND_LABEL,SELLERS,sellerOf,type CfEvent,type EventKind} from '../../src/events/events';
type Row=Omit<CfEvent,'status'>&{status:CfEvent['status']|'draft';clicks:number};
const STATUS:Record<string,string>={draft:'Ciornă (nu se vede)',published:'Publicat',sold_out:'Sold out',postponed:'Amânat',cancelled:'Anulat'};
const local=(iso?:string|null)=>{if(!iso)return '';const d=new Date(iso);const p=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;};
export function Events({admin,refresh}:{admin:Admin;refresh:number}){
 const [selected,setSelected]=useState(''),[localRefresh,setLocal]=useState(0);const s=useData<Row[]>('admin_events',{},refresh+localRefresh);const can=admin.permissions.includes('places.edit');const ev=s.data?.find(e=>e.id===selected);
 return <><p className="lead">Concerte, stand-up, teatru și petreceri. CeFaci doar arată evenimentul: biletul se cumpără la vânzătorul oficial, banii nu trec prin noi. Vânzători acceptați: {Object.values(SELLERS).join(', ')}.</p><div className="filters">{can&&<button className="primary" onClick={()=>setSelected('new')}>Adaugă un eveniment</button>}</div><Loading {...s}/><div className="split"><div className="list">{s.data?.map(e=><button key={e.id} className={'picker-row '+(selected===e.id?'on':'')} onClick={()=>setSelected(e.id)}><span><strong>{e.title}</strong><small>{date(e.starts_at)} · {e.place_name}</small></span><Tag tone={e.status==='published'?'green':e.status==='draft'?'':'coral'}>{STATUS[e.status]}</Tag><small className="muted">{e.clicks} au deschis biletele</small></button>)}{s.data?.length===0&&<Empty>Niciun eveniment încă.</Empty>}</div>{(selected==='new'||ev)&&can&&<EventEdit key={selected} ev={ev} done={()=>{setSelected('');setLocal(v=>v+1);}}/>}</div></>;
}
function EventEdit({ev,done}:{ev?:Row;done:()=>void}){
 const [f,setF]=useState({title:ev?.title||'',kind:ev?.kind||'concert',starts_at:local(ev?.starts_at),ends_at:local(ev?.ends_at),venue_id:ev?.venue_id||'',place_name:ev?.place_name||'',address:ev?.address||'',lat:ev?String(ev.lat):'',lon:ev?String(ev.lon):'',price_from:ev?.price_from!=null?String(ev.price_from):'',price_to:ev?.price_to!=null?String(ev.price_to):'',ticket_url:ev?.ticket_url||'',min_age:ev?.min_age!=null?String(ev.min_age):'',about:ev?.about||'',about_en:ev?.about_en||'',status:ev?.status||'draft'});
 const a=useAction();const set=(k:keyof typeof f)=>(e:{target:{value:string}})=>setF(x=>({...x,[k]:e.target.value}));
 const seller=sellerOf(f.ticket_url);
 const save=async()=>{
  if(f.title.trim().length<3)throw new Error('Scrie titlul evenimentului.');
  if(!f.starts_at)throw new Error('Alege data și ora.');
  if(f.ticket_url&&!seller)throw new Error('Linkul de bilete trebuie să fie https și de la un vânzător oficial din listă.');
  if(['published','postponed'].includes(f.status)&&!seller)throw new Error('Un eveniment publicat are nevoie de linkul vânzătorului oficial.');
  if(!f.venue_id.trim()&&(!f.place_name.trim()||!f.lat||!f.lon))throw new Error('Alege un loc din CeFaci (ID) sau scrie numele și coordonatele.');
  await rpc('admin_event_save',{p_id:ev?.id??null,p:{...f,title:f.title.trim(),starts_at:new Date(f.starts_at).toISOString(),ends_at:f.ends_at?new Date(f.ends_at).toISOString():''}});done();
 };
 return <Card className="detail"><h2>{ev?ev.title:'Un eveniment nou'}</h2><form onSubmit={e=>{e.preventDefault();void a.run(save,'Eveniment salvat.');}}>
  <label>Titlul<input value={f.title} onChange={set('title')} required maxLength={120} placeholder="Subcarpați la Arenele Romane"/></label>
  <label>Felul<select value={f.kind} onChange={set('kind')}>{(Object.keys(KIND_LABEL) as EventKind[]).map(k=><option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
  <div className="form-grid"><label>Începe (ora României)<input type="datetime-local" value={f.starts_at} onChange={set('starts_at')} required/></label><label>Se termină (opțional)<input type="datetime-local" value={f.ends_at} onChange={set('ends_at')}/></label></div>
  <label>Locul din CeFaci (ID, opțional)<input value={f.venue_id} onChange={set('venue_id')} maxLength={60} placeholder="ID-ul din Locuri; atunci numele și coordonatele vin singure"/></label>
  <div className="form-grid"><label>Numele locului<input value={f.place_name} onChange={set('place_name')} maxLength={120}/></label><label>Adresa<input value={f.address} onChange={set('address')} maxLength={200}/></label></div>
  <div className="form-grid"><label>Latitudine<input type="number" step="any" value={f.lat} onChange={set('lat')}/></label><label>Longitudine<input type="number" step="any" value={f.lon} onChange={set('lon')}/></label></div>
  <label>Linkul de bilete (vânzătorul oficial)<input value={f.ticket_url} onChange={set('ticket_url')} maxLength={500} placeholder="https://www.iabilet.ro/…"/></label>{f.ticket_url&&<p className={seller?'muted':'notice danger'}>{seller?'Vânzător: '+seller:'Nu e un vânzător oficial din listă (sau linkul nu e https).'}</p>}
  <div className="form-grid"><label>Preț de la (lei)<input type="number" min="0" value={f.price_from} onChange={set('price_from')}/></label><label>Preț până la (lei)<input type="number" min="0" value={f.price_to} onChange={set('price_to')}/></label></div>
  <label>Vârsta minimă<select value={f.min_age} onChange={set('min_age')}><option value="">Fără limită</option><option value="16">16+</option><option value="18">18+</option></select></label>
  <label>Despre (română, opțional)<textarea value={f.about} onChange={set('about')} maxLength={600}/></label>
  <label>Despre (engleză, opțional)<textarea value={f.about_en} onChange={set('about_en')} maxLength={600}/></label>
  <label>Starea<select value={f.status} onChange={set('status')}>{Object.entries(STATUS).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
  <p className="muted">Anulat sau amânat: lasă evenimentul publicat cu starea nouă, ca oamenii care l-au salvat să afle. Aplicația le spune că banii îi dă înapoi vânzătorul.</p>
  <Notice error={a.error} success={a.success}/><div className="actions"><button className="primary" disabled={a.busy}>Salvează</button><button type="button" onClick={done}>Renunț</button></div>
 </form></Card>;
}

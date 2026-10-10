import {createClient} from '@supabase/supabase-js';
import {publishSecurityFailure} from '../../shared/security-events';
export const supabase = createClient('https://vqrmwuarjjntusfbqprx.supabase.co','sb_publishable_DWl1cra4FE1Dxgc2hwtGrA_0LwP5B4O',{
  auth:{storageKey:'cefaci-admin-auth',storage:window.sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'},
});
export async function rpc<T>(name:string,args:Record<string,unknown>={},signal?:AbortSignal):Promise<T>{
  let request = supabase.rpc(name,args);
  if(signal) request=request.abortSignal(signal);
  const {data,error}=await request;
  if(error) {
    if(!name.startsWith('secure_')&&['42501','28000','PGRST301','PGRST302'].includes(error.code)) publishSecurityFailure('admin');
    throw new Error(error.message||'Nu am putut comunica cu serverul.');
  }
  return data as T;
}
export function message(e:unknown){return e instanceof Error?e.message:'A apărut o problemă. Încearcă din nou.';}
export type Admin = {user_id:string;username:string|null;role:string|null;permissions:string[]};
export type Report = {origin:'support'|'legacy';id:string;kind:string;source:string;title:string;description:string;status:string;version:number;answer:string|null;venue_id:string|null;username:string|null;photo_available:boolean;created_at?:string;submitted_at?:string};
export type PartnerRequest = {id:string;kind:'claim'|'new'|'dispute';status:string;venue_id:string|null;venue_name?:string;applicant_id:string;applicant_username?:string;owner_username?:string;details:Record<string,string>;proof_available:boolean;owner_response?:string;owner_responded_at?:string;deadline?:string;owner_deadline?:string;owner_response_deadline?:string;decision_note?:string;note?:string;submitted_at?:string;version?:number};
export type Place = {id:string;name:string;cat:string;lat:number;lon:number;data:Record<string,unknown>;edit:Record<string,unknown>;status:string;source:string;edited_at:string|null};
export type Partner = {venue_id:string;name:string;firm:string;cui:string;founder:boolean;status:string;price_tier:number;free_until:string;activated_at:string;team:Array<{username:string;role:string}>|null;month:Record<string,unknown>|null;flags:number;noshow:number;unclosed:number};
export type Staff = {user_id:string;username:string;role:string};
export type Journal = {id:string|number;kind?:string;action?:string;at?:string;created_at?:string;username?:string;by_username?:string;actor_username?:string;note?:string;reason?:string;target?:string;venue_id?:string;summary?:string};

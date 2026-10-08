// Shared wire contract; monetary eligibility is calculated by Postgres, never by either client.
export type Role='proprietar'|'manager'|'receptie'|'scanare';
export type ReservationStatus='cerută'|'confirmată'|'refuzată'|'anulată'|'propusă'|'expirată';
export interface Attendance { plan:string;people:number;ready:boolean;deadline:string|null;guests:number }
export interface Reservation {id:string;people:number;kids:number;at:string;status:ReservationStatus;proposal_expires_at:string|null;name?:string;note?:string;response_due_at?:string}
export interface Visit {id:string;people:number;kind:string;discount?:number;discount_pct?:number;scope?:'bill'|'eligible_consumption';discount_scope?:'bill'|'eligible_consumption';discount_people:number;plus:boolean;table?:string;name?:string;at?:string;work_day?:string;day?:string;closed_at?:string|null;outcome:string;bill:number|null;source?:string;count?:Count|null;drop_limit?:number;reservation_limit?:number}
export interface Count {visit_id:string;version:number;people:number;adults:number;drop_adults:number;state:'confirmed'|'awaiting'|'disputed';deadline:string|null;reason?:string}
export interface Claim {id:string;seats:number;expires_at:string;status:string;claimed_pct:number;plus_at_claim:boolean}
export interface PlanState {attendance:Attendance|null;reservation:Reservation|null;claim:Claim|null;visit:Visit|null;count:Count|null}
export interface Partner {venue_id:string;partner:boolean;discoverable:boolean;mode:'required'|'recommended'|'none';reservations_on:boolean;plus_pct:number}
export interface Drop {id:string;title:string;pct:number;seats:number;min_group:number;starts_at:string;ends_at:string;adult:boolean;new_only:boolean;plus:boolean;pct_all?:number;pct_plus?:number;taken?:number}
export interface Settings {mode:Partner['mode'];on:boolean;paused:boolean;capacity:number;duration:number;auto:number;hours:{day:number;from:string;to:string}[]}
export interface Dashboard {role:Role;day:string;word:string;token:string|null;partner:{free_until?:string;price_tier?:number;firm?:string;cui?:string};settings:Settings;requests:Reservation[];visits:Visit[];drops:Drop[];statistics:{visits:number;people:number;unclosed:number;reservations:number};plus_program:{current_pct:number;today_off:boolean;off_days_this_month:number;next:{pct:number|null;schedule:unknown;effective_date:string}|null}|null}
export interface Finance {billing_ready:false;partial:boolean;missing:number;blocked:number;revenue:number;discounts:number;fee:number;remaining:number|null;would_pay:number;visits:number;lines:{visit:string;day:string;kind:string;bill:number;fee:number;free:boolean;would_pay:number;calculation:{reservation_unit:number;drop_unit:number;reservation_limit:number;drop_limit:number;adults:number;drop_adults:number}}[]}
export interface VenueAccess {venue_id:string;name:string;role:Role;status:string}
export interface RpcClient {rpc(name:string,args?:Record<string,unknown>):PromiseLike<{data:unknown;error:{message:string;code?:string}|null}>}
export async function rpc<T>(client:RpcClient,name:string,args:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await client.rpc(name,args); if(error)throw new Error(error.message);return data as T;
}
// Discard results from previous account/venue generations and older overlapping refreshes.
export class RequestScope {private generation=0;invalidate(){this.generation++;}capture(){const n=this.generation;return()=>n===this.generation;}}
export const canFinance=(role:Role)=>role==='proprietar'||role==='manager';
export const canOperate=(role:Role)=>role!=='scanare';
export const money=(value:number|null)=>value===null?'Total parțial':new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON'}).format(value);

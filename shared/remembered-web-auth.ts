import type {Session} from '@supabase/supabase-js';
import {securitySessionKey} from './security-mfa';
export const REMEMBER_WEB_MS=15*24*60*60*1000;
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Receipt={version:1;sessionKey:string;expiresAt:number};
type Status={expiresAt:number;notice:string};
/** Browser persistence is optional; role/MFA authorization remains entirely server-side. */
export class RememberedWebAuth {
 readonly receiptKey:string;
 private desired=false;
 private memory=new Map<string,string>();
 private listeners=new Set<()=>void>();
 private expiryListeners=new Set<()=>void>();
 private status:Status={expiresAt:0,notice:''};
 constructor(readonly authKey:string,readonly scope:'admin'|'business',private session:Store,private persistent:Store,private now=()=>Date.now()){
  this.receiptKey=authKey+'.remember';
  const receipt=this.readReceipt();if(receipt)this.status={expiresAt:receipt.expiresAt,notice:''};
 }
 private read(store:Store,key:string){try{return store.getItem(key);}catch{return null;}}
 private erase(store:Store,key:string){try{store.removeItem(key);}catch{/* Nothing is saved when browser storage is denied. */}}
 private write(store:Store,key:string,value:string){try{store.setItem(key,value);return true;}catch{return false;}}
 private bind(value:string){try{return securitySessionKey(JSON.parse(value) as Session);}catch{return null;}}
 private readReceipt():Receipt|null{
  try{const raw=this.read(this.persistent,this.receiptKey);if(!raw)return null;const r=JSON.parse(raw);if(r.version!==1||typeof r.sessionKey!=='string'||r.sessionKey.length>17000||!Number.isFinite(r.expiresAt)||r.expiresAt>this.now()+REMEMBER_WEB_MS+60000)return null;return r;}catch{return null;}
 }
 private publish(patch:Partial<Status>){this.status={...this.status,...patch};this.listeners.forEach(fn=>fn());}
 getStatus=()=>this.status;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 choose(remember:boolean){this.desired=remember;this.publish({notice:''});}
 onExpiry=(fn:()=>void)=>{this.expiryListeners.add(fn);return()=>{this.expiryListeners.delete(fn);};};
 private expire(){this.removeItem(this.authKey);this.expiryListeners.forEach(fn=>fn());}
 wantsRemember(){return this.desired;}
 getItem=(key:string):string|null=>{
  if(key!==this.authKey)return this.read(this.session,key)??this.memory.get(key)??null;
  const receipt=this.readReceipt(),saved=this.read(this.persistent,key);
  if(saved&&receipt&&receipt.expiresAt>this.now()&&this.bind(saved)===receipt.sessionKey){this.publishIfExpiry(receipt.expiresAt);return saved;}
  // An expired/invalid remembered session must never fall back to an older tab copy.
  if(saved||this.read(this.persistent,this.receiptKey)){
   if(receipt&&receipt.expiresAt<=this.now())this.expire();else this.removeItem(key);return null;
  }
  return this.read(this.session,key)??this.memory.get(key)??null;
 };
 private publishIfExpiry(expiresAt:number){if(this.status.expiresAt!==expiresAt)this.publish({expiresAt});}
 setItem=(key:string,value:string)=>{
  if(key===this.authKey){const r=this.readReceipt();if(r&&r.expiresAt<=this.now()){this.expire();return;}}
  this.memory.set(key,value);
  if(key!==this.authKey){this.write(this.session,key,value);return;}
  const receipt=this.readReceipt();
  if(receipt&&receipt.expiresAt>this.now()&&this.bind(value)===receipt.sessionKey){
   if(this.write(this.persistent,key,value)){this.erase(this.session,key);this.publishIfExpiry(receipt.expiresAt);return;}
   this.disable('Browserul nu permite memorarea contului. Autentificarea rămâne numai în acest tab.');
  }else if(receipt||this.read(this.persistent,key)){
   this.erase(this.persistent,key);this.erase(this.persistent,this.receiptKey);this.publish({expiresAt:0});
  }
  this.write(this.session,key,value);
 };
 removeItem=(key:string)=>{
  this.memory.delete(key);this.erase(this.session,key);this.erase(this.persistent,key);
  if(key===this.authKey){this.desired=false;this.erase(this.persistent,this.receiptKey);this.publish({expiresAt:0});}
 };
 disable(notice=''){
  const value=this.read(this.persistent,this.authKey)??this.read(this.session,this.authKey)??this.memory.get(this.authKey);
  if(value){this.memory.set(this.authKey,value);this.write(this.session,this.authKey,value);}
  this.erase(this.persistent,this.authKey);this.erase(this.persistent,this.receiptKey);this.desired=false;this.publish({expiresAt:0,notice});
 }
 confirm(session:Session,expiresAt:string){
  const deadline=Date.parse(expiresAt),binding=securitySessionKey(session),value=this.read(this.session,this.authKey)??this.memory.get(this.authKey);
  if(!this.desired||!value||this.bind(value)!==binding||!Number.isFinite(deadline)||deadline<=this.now()||deadline>this.now()+REMEMBER_WEB_MS+60000)throw Error('Sesiunea pentru memorare s-a schimbat.');
  const receipt:Receipt={version:1,sessionKey:binding,expiresAt:deadline};
  // Commit metadata last. Never remove the tab session before both writes succeed.
  if(!this.write(this.persistent,this.authKey,value)||!this.write(this.persistent,this.receiptKey,JSON.stringify(receipt))){
   this.disable('Browserul nu permite memorarea contului. Autentificarea rămâne numai în acest tab.');return;
  }
  this.erase(this.session,this.authKey);this.desired=false;this.publish({expiresAt:deadline,notice:''});
 }
}
export async function confirmRememberedLogin(storage:RememberedWebAuth|null,session:Session|null,call:<T>(name:string,args?:Record<string,unknown>)=>Promise<T>){
 if(!storage?.wantsRemember()||!session)return;
 try{const result=await call<{expires_at:string}>('remember_web_session',{p_scope:storage.scope});storage.confirm(session,result.expires_at);}
 catch{storage.disable('Nu am putut activa „Ține-mă minte”. Contul rămâne autentificat numai în acest tab.');}
}
/** Lazy storage access lets browsers that deny persistent storage use this tab only. */
export function browserRememberedAuth(key:string,scope:'admin'|'business'){
 const store=(kind:'sessionStorage'|'localStorage'):Store=>({getItem:k=>window[kind].getItem(k),setItem:(k,v)=>window[kind].setItem(k,v),removeItem:k=>window[kind].removeItem(k)});
 return new RememberedWebAuth(key,scope,store('sessionStorage'),store('localStorage'));
}

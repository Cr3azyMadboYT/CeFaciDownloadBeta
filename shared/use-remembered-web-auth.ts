import {useEffect,useRef,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {securitySessionKey} from './security-mfa';
import type {RememberedWebAuth} from './remembered-web-auth';
/** Expire an open tab too, including after browser sleep; token refresh never resets the deadline. */
export function useRememberedWebAuth(storage:RememberedWebAuth|null,session:Session|null,onExpired:()=>Promise<void>){
 const [state,State]=useState(()=>storage?.getStatus()??{expiresAt:0,notice:''});
 const expiry=useRef(onExpired);expiry.current=onExpired;
 const binding=session?securitySessionKey(session):'';
 useEffect(()=>{if(!storage)return;State(storage.getStatus());return storage.subscribe(()=>State(storage.getStatus()));},[storage]);
 useEffect(()=>{
  if(!storage||!binding||!state.expiresAt)return;
  let done=false;
  const check=()=>{if(done||Date.now()<state.expiresAt)return;done=true;storage.removeItem(storage.authKey);void expiry.current().catch(()=>{/* Server expiry denies dashboard access even if signout request fails. */});};
  const stop=storage.onExpiry(()=>{if(done)return;done=true;void expiry.current().catch(()=>{});});
  const timer=setTimeout(check,Math.max(0,state.expiresAt-Date.now()));
  const changed=()=>{const s=storage.getStatus();if(!s.expiresAt){storage.getItem(storage.authKey);}check();};
  window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);window.addEventListener('storage',changed);check();
  return()=>{done=true;stop();clearTimeout(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);window.removeEventListener('storage',changed);};
 },[storage,binding,state.expiresAt]);
 return state.notice;
}

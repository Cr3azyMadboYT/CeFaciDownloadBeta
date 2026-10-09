import {useEffect,useRef,useState} from 'react';
import {message,rpc} from './backend';
export function useData<T>(name:string,args:Record<string,unknown>={},refresh=0){
  const [state,set]=useState<{data:T|null;loading:boolean;error:string}>({data:null,loading:true,error:''});
  const json=JSON.stringify(args);
  useEffect(()=>{const abort=new AbortController();set({data:null,loading:true,error:''});rpc<T>(name,JSON.parse(json),abort.signal).then(data=>{if(!abort.signal.aborted)set({data,loading:false,error:''});}).catch(e=>{if(!abort.signal.aborted)set({data:null,loading:false,error:message(e)});});return()=>abort.abort();},[name,json,refresh]);
  return state;
}
export function useAction(){
  const active=useRef(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  async function run(fn:()=>Promise<void>,text='Modificarea a fost salvată.'){
    if(busy)return;setBusy(true);setError('');setSuccess('');
    try{await fn();if(active.current)setSuccess(text);}catch(e){if(active.current)setError(message(e));}finally{if(active.current)setBusy(false);}
  }
  return {busy,error,success,run};
}

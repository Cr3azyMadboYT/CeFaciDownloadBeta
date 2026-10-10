// Server-only retention runner. The key must be injected by a private scheduler, never shipped with apps.
import { pathToFileURL } from 'node:url';
const projectUrl = 'https://vqrmwuarjjntusfbqprx.supabase.co';
const safePath = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/proof\.(pdf|jpg|png)$/;
export async function retainBusinessProofs({key, execute=false, fetcher=fetch}) {
  if(!key) throw new Error('Configure CEFACI_RETENTION_SERVICE_KEY in the private server environment.');
  const request=async(path,method,body)=>{
    const r=await fetcher(projectUrl+path,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    if(!r.ok) throw new Error(`Retention operation failed: HTTP ${r.status}.`);
    return r.status===204?null:await r.json();
  };
  const candidates=await request('/rest/v1/rpc/business_proofs_retention_candidates','POST',{});
  if(!Array.isArray(candidates)||candidates.some(c=>!safePath.test(c.path)||!c.request_id||c.path.split('/')[1]!==c.request_id)) throw new Error('Invalid retention candidates; nothing was deleted.');
  if(!execute) return {mode:'dry-run',files:candidates.length};
  // Delete every aged object before acknowledging its request; incomplete deletion remains retryable.
  for(const c of candidates) await request('/storage/v1/object/business-proofs','DELETE',{prefixes:[c.path]});
  for(const id of new Set(candidates.map(c=>c.request_id))) await request('/rest/v1/rpc/business_proof_deleted','POST',{p_id:id});
  return {mode:'execute',files:candidates.length,requests:new Set(candidates.map(c=>c.request_id)).size};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(process.argv.slice(2).some(x=>x!=='--execute')) throw new Error('Only --execute is supported; omitted means dry-run.');
  console.log(JSON.stringify(await retainBusinessProofs({key:process.env.CEFACI_RETENTION_SERVICE_KEY,execute:process.argv.includes('--execute')})));
}

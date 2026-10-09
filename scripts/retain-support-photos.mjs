// Server-only: inject the key in a private scheduler; never import this runner into apps.
import { pathToFileURL } from 'node:url';
const projectUrl='https://vqrmwuarjjntusfbqprx.supabase.co';
const safePath=/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/photo\.(jpg|png)$/;
export async function retainSupportPhotos({key,execute=false,fetcher=fetch}){
 if(!key)throw new Error('Configure CEFACI_RETENTION_SERVICE_KEY in the private server environment.');
 const request=async(path,method,body)=>{const r=await fetcher(projectUrl+path,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Retention operation failed: HTTP ${r.status}.`);return r.status===204?null:await r.json();};
 const candidates=await request('/rest/v1/rpc/support_photos_retention_candidates','POST',{});
 if(!Array.isArray(candidates)||candidates.some(c=>!safePath.test(c.path)||!c.report_id||c.path.split('/')[1]!==c.report_id))throw new Error('Invalid retention candidates; nothing was deleted.');
 if(!execute)return {mode:'dry-run',files:candidates.length};
 for(const c of candidates){await request('/storage/v1/object/support-photos','DELETE',{prefixes:[c.path]});await request('/rest/v1/rpc/support_photo_deleted','POST',{p_id:c.report_id});}
 return {mode:'execute',files:candidates.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.slice(2).some(x=>x!=='--execute'))throw new Error('Only --execute is supported; omitted means dry-run.');console.log(JSON.stringify(await retainSupportPhotos({key:process.env.CEFACI_RETENTION_SERVICE_KEY,execute:process.argv.includes('--execute')})));}

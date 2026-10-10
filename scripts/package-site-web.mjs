import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
process.chdir(root);
if(!fs.existsSync('scripts/generate-legal-pages.mjs'))throw new Error('Lipsește generatorul documentelor legale; pachetul nu poate fi livrat incomplet.');
execFileSync(process.execPath,['scripts/generate-legal-pages.mjs'],{stdio:'inherit'});
const source='website',output='website/dist';
const required=['descopera','confidentialitate','termeni','cookies','business/termeni','admin/reguli','drepturile-tale','securitate','contact','sterge-contul'];
for(const page of required)if(!fs.existsSync(`${source}/${page}/index.html`))throw new Error(`Lipsește pagina /${page}/.`);
fs.mkdirSync(output,{recursive:true});
for(const entry of fs.readdirSync(output))fs.rmSync(path.join(output,entry),{recursive:true,force:true});
function copy(directory,target){
  fs.mkdirSync(target,{recursive:true});
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    if(entry.name==='dist')continue;
    const input=path.join(directory,entry.name),out=path.join(target,entry.name);
    if(entry.isSymbolicLink())throw new Error(`Link simbolic interzis: ${input}`);
    if(entry.isDirectory()){copy(input,out);continue;}
    if(!entry.isFile()||!(/\.(html|css|js|woff2|webp|png|svg)$/.test(entry.name)||entry.name==='.htaccess'||/-OFL\.txt$/.test(entry.name)))throw new Error(`Fișier neașteptat: ${input}`);
    if(/backup|before|\.env|\.sql|\.map$/i.test(input))throw new Error(`Fișier privat sau backup în site: ${input}`);
    if(entry.name.endsWith('.html')){
      const text=fs.readFileSync(input,'utf8');
      if(!/<html[^>]*lang="ro"/.test(text))throw new Error(`Limbă lipsă: ${input}`);
      if(/<script(?![^>]*src=)[^>]*>\s*\S/i.test(text)||/\son[a-z]+\s*=/i.test(text)||/\sstyle\s*=/i.test(text))throw new Error(`Cod inline incompatibil cu CSP: ${input}`);
      if(/<(script|iframe)[^>]+(?:src|href)=["']https?:/i.test(text))throw new Error(`Script/frame extern: ${input}`);
    }
    fs.copyFileSync(input,out);fs.chmodSync(out,0o644);
  }
  fs.chmodSync(target,0o755);
}
copy(source,output);
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
fs.writeFileSync(output+'/version.json',JSON.stringify({app:'CeFaci public site',commit,builtAt:new Date().toISOString(),mode:'pre-commercial beta',analytics:false,payments:false},null,2)+'\n');
fs.writeFileSync(output+'/robots.txt','User-agent: *\nAllow: /\nSitemap: https://cefaci.app/sitemap.xml\n');
fs.writeFileSync(output+'/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+['',...required].map(p=>`  <url><loc>https://cefaci.app/${p?p+'/':''}</loc></url>`).join('\n')+'\n</urlset>\n');
fs.mkdirSync('release',{recursive:true});
fs.rmSync('release/CeFaci-site-web.zip',{force:true});
execFileSync('zip',['-qr','../../release/CeFaci-site-web.zip','.'],{cwd:output});
const digest=createHash('sha256').update(fs.readFileSync('release/CeFaci-site-web.zip')).digest('hex');
fs.writeFileSync('release/CeFaci-site-web-SHA256.txt',digest+'  CeFaci-site-web.zip\n');
console.log(`release/CeFaci-site-web.zip · source ${commit} · sha256 ${digest}`);

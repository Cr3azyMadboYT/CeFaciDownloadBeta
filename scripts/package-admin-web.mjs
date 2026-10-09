import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir='admin/dist';
if(!fs.existsSync(dir+'/index.html')) throw new Error('Construiește Admin înainte de împachetare.');
fs.copyFileSync('admin/public/.htaccess',dir+'/.htaccess');
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
fs.writeFileSync(dir+'/version.json',JSON.stringify({app:'CeFaci Admin',commit,build:new Date().toISOString()}));
fs.writeFileSync(dir+'/manifest.webmanifest',JSON.stringify({name:'CeFaci Admin',short_name:'Admin',lang:'ro',start_url:'/',scope:'/',display:'standalone',background_color:'#E8EBF2',theme_color:'#0E1440'}));
let html=fs.readFileSync(dir+'/index.html','utf8');
if(!html.includes('rel="manifest"')) html=html.replace('</head>','<link rel="manifest" href="/manifest.webmanifest"></head>');
if(!/<html[^>]+lang="ro"/.test(html)) throw new Error('Admin trebuie să declare limba română.');
if(/<script(?![^>]*src=)[^>]*>\s*\S/.test(html)) throw new Error('Admin nu poate include JavaScript inline.');
fs.writeFileSync(dir+'/index.html',html);
function permissions(path){fs.chmodSync(path,0o755);for(const item of fs.readdirSync(path,{withFileTypes:true})){const child=path+'/'+item.name;if(item.isDirectory())permissions(child);else if(item.isFile())fs.chmodSync(child,0o644);else throw new Error('Asset neașteptat: '+child);}}
permissions(dir);
fs.mkdirSync('release',{recursive:true});
fs.rmSync('release/CeFaci-Admin-web.zip',{force:true});
execFileSync('zip',['-qr','../../release/CeFaci-Admin-web.zip','.'],{cwd:dir});
console.log('release/CeFaci-Admin-web.zip · '+commit);

// Simularea cu orașele mari (22.10): aceleași reguli ca scripts/simulare-2027.mjs (10% din bon, fondatorii o lună gratis), București din 2027, Cluj/Timișoara/Iași/Brașov/Constanța din 2028. Rulare: node scripts/simulare-orase.mjs
const RET=[0.70,0.45,0.35,0.30,0.27,0.25,0.24,0.23,0.22,0.21,0.20],ret=k=>RET[Math.min(k,RET.length-1)];
const SEASON=[0.85,0.85,0.95,1,1.05,1.1,1.1,1.0,1.05,1,1,1.2];
const W=52/12, OUT=1.3, GROUP=3, SPEND=101, FEE=GROUP*SPEND*0.95*0.10*0.8*0.98;
// size = oameni noi pe săptămână față de București (75 realist); curated = câte locuri bune are orașul
const CITIES={
 'București+Ilfov':{start:0,size:1,curated:1055,partners:4,season:null},
 'Cluj (+Florești, Apahida)':{start:12,size:0.38,curated:380,partners:2},
 'Timișoara (+Dumbrăvița, Giroc)':{start:14,size:0.24,curated:280,partners:1.5},
 'Iași':{start:16,size:0.25,curated:280,partners:1.5},
 'Brașov (+Poiana, Râșnov)':{start:18,size:0.2,curated:260,partners:1.5},
 'Constanța (+Mamaia, Vama)':{start:16,size:0.22,curated:300,partners:1.5,summer:true},
};
const SUMMER=[0.4,0.4,0.5,0.7,1.2,2.2,3,3,1.6,0.7,0.5,0.6];
function city(c,months,perWeek){
 const signups=perWeek*c.size*W, venues=[];let signed=0;const rows=[];
 for(let m=0;m<months;m++){
  const age=m-c.start; if(age<0){rows.push({rev:0,plus:0,act:0,par:0,cost:0});continue;}
  const sz=c.summer?SUMMER[m%12]:1;
  let act=0;for(let k=0;k<=age;k++)act+=signups*ret(age-k)*(c.summer?SUMMER[(c.start+k)%12]:1);
  const fresh=age<2?(c.start===0?5:3):c.partners; const f=Math.max(0,Math.min(fresh,(c.start===0?20:5)-signed));signed+=f;
  if(f)venues.push({s:age,founder:true,n:f});if(fresh-f)venues.push({s:age,founder:false,n:fresh-f});
  const par=venues.reduce((s,v)=>s+v.n,0), share=Math.min(0.4,par/c.curated*5);
  const ent=act*OUT*SEASON[m%12]*share, per=par?ent/par:0;let rev=0;
  for(const v of venues){const free=v.founder&&age-v.s<1;if(!free)rev+=per*FEE*v.n;let ch=0.02+(per<0.5?0.06:per<1.5?0.03:0);if(v.founder)ch*=0.7;v.n*=1-ch;}
  const plus=age>=3&&par>=15?act*Math.min(0.05,0.004+par*0.0006)*14.05:0;
  // costuri pe oraș nou: drumuri/cazare la semnat (primele 6 luni), marketing local, un om pe teren part-time din luna 4
  const cost=c.start===0?0:(age<6?900:300)+600*c.size/0.25+(age>=3?1500:0)+fresh*30;
  rows.push({rev,plus,act,par,cost,ent});
 }
 return rows;
}
const BASE_COST=m=>2300*(m===0?1:0)+321+((113+20)*1.21)+150; // firmă + server + drum (fără marketing București)
function run(perWeek,mk){
 const months=36, all=Object.entries(CITIES).map(([n,c])=>[n,city(c,months,perWeek)]);
 for(const y of [1,2,3]){
  const r=[];let rev=0,cost=0;
  for(const [n,rows] of all){const s=rows.slice((y-1)*12,y*12);const rv=s.reduce((a,b)=>a+b.rev+b.plus,0),cs=s.reduce((a,b)=>a+b.cost,0);rev+=rv;cost+=cs;r.push([n,Math.round(rv),Math.round(s[11].par),Math.round(s[11].act)]);}
  // costuri comune: firmă, server (crește cu oamenii), Google, marketing București
  let common=0;for(let m=(y-1)*12;m<y*12;m++){const act=all.reduce((a,[,rows])=>a+rows[m].act,0);common+=BASE_COST(m)+mk+Math.max(0,act*OUT*2-1000)/1000*20*4.5*1.21+(act>4000?250*1.21:0);}
  cost+=common;const tax=rev*0.03;
  console.log(`\n${2026+y}: venit ${Math.round(rev)} · cheltuieli ${Math.round(cost)} · profit ${Math.round(rev-cost-tax)} · după dividende ${Math.round((rev-cost-tax)*0.84)}`);
  for(const x of r)console.log('  ',x[0].padEnd(34),'venit',String(x[1]).padStart(7),'· parteneri dec',x[2],'· activi dec',x[3]);
 }
}
console.log('==== REALIST (București 75 oameni noi/săpt) ====');run(75,600);
console.log('\n==== BUN (București 150/săpt) ====');run(150,1200);

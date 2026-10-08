const format=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export const localTime=(d=new Date())=>format.format(d).replace(' ','T');
export const showTime=(iso:string)=>new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));
export function bucharestTime(input:string):string{
 const value=input.trim().replace(' ','T');if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw new Error('Scrie data și ora: AAAA-LL-ZZ HH:MM.');
 const naive=Date.parse(value+'Z');let utc=naive;
 for(let i=0;i<3;i++)utc+=naive-Date.parse(localTime(new Date(utc))+'Z');
 if(localTime(new Date(utc))!==value)throw new Error('Ora nu există în calendarul Bucureștiului. Alege altă oră.');
 return new Date(utc).toISOString();
}

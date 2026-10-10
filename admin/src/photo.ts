/** Bound private attachments before the browser decodes them. Filenames and MIME alone are untrusted. */
export async function validateAttachment(blob:Blob,proof:boolean):Promise<void>{
 if(!blob.size||blob.size>(proof?8:5)*1024*1024)throw new Error('Atașamentul depășește limita permisă.');
 const type=blob.type.split(';')[0],bytes=new Uint8Array(await blob.arrayBuffer()),n=bytes.length;
 if(proof&&type==='application/pdf'){
  if(n<12||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-'||!new TextDecoder().decode(bytes.slice(Math.max(0,n-1024))).includes('%%EOF'))throw new Error('Documentul PDF nu este valid.');
  return;
 }
 let width=0,height=0;
 if(type==='image/png'){
  if(n<45||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)||![73,72,68,82].every((v,i)=>bytes[12+i]===v)||![0,0,0,0,73,69,78,68,174,66,96,130].every((v,i)=>bytes[n-12+i]===v))throw new Error('Imaginea PNG nu este validă.');
  const view=new DataView(bytes.buffer);width=view.getUint32(16);height=view.getUint32(20);
 }else if(type==='image/jpeg'){
  if(n<12||bytes[0]!==255||bytes[1]!==216||bytes[n-2]!==255||bytes[n-1]!==217)throw new Error('Imaginea JPEG nu este validă.');
  let i=2;
  while(i+4<n){if(bytes[i]!==255)throw new Error('Imaginea JPEG nu este validă.');while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===0xDA||marker===0xD9)break;if(marker===0x01||marker>=0xD0&&marker<=0xD7)continue;const length=bytes[i]*256+bytes[i+1];if(length<2||i+length>n)throw new Error('Imaginea JPEG nu este validă.');if([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marker)){if(length<8)throw new Error('Imaginea JPEG nu este validă.');height=bytes[i+3]*256+bytes[i+4];width=bytes[i+5]*256+bytes[i+6];break;}i+=length;}
 }else throw new Error('Fișierul nu are un format sigur de afișat.');
 if(!width||!height||width>4096||height>4096||width*height>16_000_000)throw new Error('Imaginea trebuie să aibă cel mult 4096 pixeli pe latură și 16 megapixeli.');
}

import {jpegInfo} from '../../shared/jpeg';
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
  ({width,height}=jpegInfo(bytes));
 }else throw new Error('Fișierul nu are un format sigur de afișat.');
 if(!width||!height||width>4096||height>4096||width*height>16_000_000)throw new Error('Imaginea trebuie să aibă cel mult 4096 pixeli pe latură și 16 megapixeli.');
}

/** Only the still image is exposed to the preview, never an appended motion video. */
export async function prepareAttachment(blob: Blob, proof: boolean): Promise<Blob> {
 await validateAttachment(blob, proof);
 if (blob.type.split(';')[0] === 'image/jpeg') {
  const info=jpegInfo(new Uint8Array(await blob.arrayBuffer()));
  return blob.slice(0,info.end,'image/jpeg');
 }
 return blob;
}

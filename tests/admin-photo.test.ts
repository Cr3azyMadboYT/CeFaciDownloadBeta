import {expect,it} from 'vitest';
import {validateAttachment} from '../admin/src/photo';
import {prepareAttachment} from '../admin/src/photo';
import fs from 'node:fs';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64'));
it('allows a real small private image and bounded PDF proof',async()=>{await expect(validateAttachment(new Blob([png],{type:'image/png'}),false)).resolves.toBeUndefined();await expect(validateAttachment(new Blob(['%PDF-1.7\nbody\n%%EOF'],{type:'application/pdf'}),true)).resolves.toBeUndefined();});
it('rejects forged MIME and file signatures before a blob URL is rendered',async()=>{for(const blob of [new Blob(['<svg onload="alert(1)"/>'],{type:'image/png'}),new Blob([png],{type:'image/jpeg'}),new Blob(['%PDF-1.7 body'],{type:'application/pdf'}),new Blob([png],{type:'image/svg+xml'})])await expect(validateAttachment(blob,true)).rejects.toThrow();});
it('rejects oversized images and unexpected PDFs on problem reports',async()=>{await expect(validateAttachment(new Blob([new Uint8Array(5*1024*1024+1)],{type:'image/png'}),false)).rejects.toThrow(/limita/);await expect(validateAttachment(new Blob(['%PDF-1.7\nbody\n%%EOF'],{type:'application/pdf'}),false)).rejects.toThrow(/format/);});
it('rejects extreme image dimensions before browser decoding',async()=>{const huge=png.slice();new DataView(huge.buffer).setUint32(16,100000);await expect(validateAttachment(new Blob([huge],{type:'image/png'}),false)).rejects.toThrow(/4096/);});
it('accepts real baseline/progressive JPEGs and strips trailing motion-photo payload',async()=>{
 for(const file of ['baseline.jpg','progressive.jpg']){
  const original=fs.readFileSync('tests/fixtures/attachments/'+file);
  const motion=new Blob([original,new Uint8Array([0,0,0,24]),'ftypmp42 synthetic motion payload'],{type:'image/jpeg'});
  await expect(validateAttachment(motion,true)).resolves.toBeUndefined();
  const prepared=await prepareAttachment(motion,true);
  expect(Buffer.from(await prepared.arrayBuffer())).toEqual(original);
  for(const truncated of [original.subarray(0,10),original.subarray(0,original.length-2)])
   await expect(validateAttachment(new Blob([truncated],{type:'image/jpeg'}),true)).rejects.toThrow(/JPEG/);
 }
});
it('accepts a real one-page PDF and rejects JPEG bytes mislabeled as PDF',async()=>{
 await expect(validateAttachment(new Blob([fs.readFileSync('tests/fixtures/attachments/document.pdf')],{type:'application/pdf'}),true)).resolves.toBeUndefined();
 await expect(validateAttachment(new Blob([fs.readFileSync('tests/fixtures/attachments/baseline.jpg')],{type:'application/pdf'}),true)).rejects.toThrow(/PDF/);
});

it('does not let a later JPEG frame hide oversized earlier dimensions',async()=>{
 const original=new Uint8Array(fs.readFileSync('tests/fixtures/attachments/baseline.jpg'));
 const sof=original.findIndex((v,i)=>v===255&&original[i+1]===0xc0);expect(sof).toBeGreaterThan(0);
 const length=original[sof+2]*256+original[sof+3];const frame=original.slice(sof,sof+2+length);
 const bomb=original.slice();bomb[sof+5]=255;bomb[sof+6]=255;bomb[sof+7]=255;bomb[sof+8]=255;
 const parts=[bomb.slice(0,-2),frame,bomb.slice(-2)];
 await expect(validateAttachment(new Blob(parts,{type:'image/jpeg'}),true)).rejects.toThrow(/4096/);
});

import {expect,it} from 'vitest';
import {partnerValidation} from '../business/src/partner-validation';

const details = {requester_name:'Ana Test',requester_role:'Administrator',firm:'Firma Test SRL',cui:'RO18547290',phone:'+40712345678',venue_name:'Local Test',address:'Strada Test 1',city:'București',category:'Restaurant'};
it('accepts valid claim/new/dispute details and requires the private proof', () => {
  for (const kind of ['claim','new','dispute'] as const) {
    expect(partnerValidation(kind,details,true)).toBe('');
    expect(partnerValidation(kind,details,false)).toContain('documentul justificativ');
  }
});
it('explains the exact field rejected by the backend instead of enabling silent submissions', () => {
  for (const phone of ['test business','07123','0712345678abc','++40712345678'])
    expect(partnerValidation('claim',{...details,phone},true)).toContain('Telefonul');
  for (const cui of ['18547291','123','RO','0123456789'])
    expect(partnerValidation('claim',{...details,cui},true)).toContain('CUI invalid');
  expect(partnerValidation('claim',{...details,requester_role:'x'},true)).toContain('Rolul');
  expect(partnerValidation('claim',{...details,firm:'a'.repeat(121)},true)).toContain('firmei');
  expect(partnerValidation('new',{...details,address:''},true)).toContain('Adresa');
  expect(partnerValidation('claim',{...details,requester_name:'Ana\nTest'},true)).toContain('Numele');
});

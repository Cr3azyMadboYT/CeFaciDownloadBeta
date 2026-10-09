import {describe,it,expect} from 'vitest';
import {adminTutorial,businessTutorial,tutorialKey,TUTORIAL_VERSION} from '../shared/role-tutorials';
describe('role-aware dashboard tutorials',()=>{
 const cases:Record<string,string[]>={fondator:['partners','reports.read','staff.read','partners.read','operations.read','money.read','plus.manage','suggestions.read','users.read','audit.read'],admin:['partners','reports.read','staff.read','partners.read','operations.read','plus.manage','users.read','audit.read'],editor:['reports.read','staff.read','suggestions.read'],moderator:['reports.read','staff.read','users.read'],suport:['reports.read','staff.read','partners.read','operations.read','users.read','plus.manage'],contabil:['staff.read','partners.read','money.read']};
 it.each(Object.entries(cases))('shows only server-authorized guidance for Admin %s',(role,permissions)=>{
  const steps=adminTutorial(role,permissions),tabs=steps.flatMap(s=>s.tab?[s.tab]:[]);
  expect(steps[0].id).toBe('welcome');expect(steps.at(-1)?.id).toBe('finish');
  expect(tabs.includes('finance')).toBe(permissions.includes('money.read'));
  expect(tabs.includes('requests')).toBe(permissions.includes('partners'));
  expect(tabs.includes('journal')).toBe(permissions.includes('audit.read'));
  expect(tabs.includes('plus')).toBe(permissions.includes('plus.manage'));
  expect(tabs.includes('reports')).toBe(permissions.includes('reports.read'));
 });
 it('uses current permissions rather than assumed founder powers',()=>{expect(adminTutorial('fondator',[]).flatMap(s=>s.tab?[s.tab]:[])).toEqual(['home']);});
 it('does not teach hidden Admin pages, even if permissions contain stale names',()=>{expect(adminTutorial('fondator',cases.fondator,['home','reports']).flatMap(s=>s.tab?[s.tab]:[])).toEqual(['home','reports']);});
 it('has no tutorial for unauthorized or unknown roles',()=>{expect(adminTutorial('client',cases.fondator)).toEqual([]);expect(adminTutorial('constructor',cases.fondator)).toEqual([]);expect(businessTutorial('admin',['Azi'])).toEqual([]);});
 const businessTabs=['Azi','Rezervări','Scanner','Oferte','Financiar','Statistici','Profil','Echipă','Ajutor'];
 it.each(['proprietar','manager'])('teaches the real financial/team pages to %s',(role)=>{const tabs=businessTutorial(role,businessTabs).flatMap(s=>s.tab?[s.tab]:[]);expect(tabs).toEqual(businessTabs);});
 it('keeps reception away from money and team guidance',()=>{expect(businessTutorial('receptie',businessTabs).flatMap(s=>s.tab?[s.tab]:[])).toEqual(['Azi','Rezervări','Scanner','Ajutor']);});
 it('limits scanner guidance to its own pages, including shared help',()=>{expect(businessTutorial('scanare',businessTabs).flatMap(s=>s.tab?[s.tab]:[])).toEqual(['Azi','Scanner','Ajutor']);});
 it('intersects Business role with visible pages',()=>{expect(businessTutorial('proprietar',['Azi','Ajutor']).flatMap(s=>s.tab?[s.tab]:[])).toEqual(['Azi','Ajutor']);});
 it('guides applicants through real claims/help without operational access',()=>{expect(businessTutorial('applicant',['Cereri','Ajutor']).flatMap(s=>s.tab?[s.tab]:[])).toEqual(['Cereri','Ajutor']);});
 it('does not promise activation, billing, or free benefits during guidance',()=>{const admin=adminTutorial('fondator',cases.fondator),business=businessTutorial('proprietar',businessTabs);expect(admin.find(s=>s.id==='requests')?.tip).toContain('nu activează automat');expect(admin.find(s=>s.id==='finance')?.tip).toContain('nu sunt configurate');expect(business.find(s=>s.id==='finance')?.tip).toContain('nu sunt configurate');});
 it('isolates completion by application, account, role, venue and version',()=>{const keys=[tutorialKey('business','a','manager','v1'),tutorialKey('business','b','manager','v1'),tutorialKey('business','a','proprietar','v1'),tutorialKey('business','a','manager','v2'),tutorialKey('admin','a','manager','v1')];expect(new Set(keys).size).toBe(keys.length);expect(keys[0]).toContain(`:tutorial:${TUTORIAL_VERSION}:`);});
 it('escapes delimiters so identities cannot collide',()=>{expect(tutorialKey('business','a:b','c','d')).not.toBe(tutorialKey('business','a','b:c','d'));});
});

/** Public, non-secret legal identity. Complete verified fields before commercial launch. */
export const LEGAL_VERSION = '2026-10-10';
export const LEGAL_CONTACT_EMAIL = 'contact@cornacidev.ro';
export const LEGAL_OPERATOR = {
  name: null,
  displayName: 'Proiect CeFaci',
  capacity: 'Proiect în dezvoltare, fără firmă înregistrată',
  identitySource: 'Titularul a confirmat contactul și a ales să nu publice încă numele și adresa.',
  email: LEGAL_CONTACT_EMAIL,
  address: null,
  companyName: null,
  companyRegistration: null,
  taxId: null,
  operatorPending: true,
  registeredCompanyPending: true,
  commercialBillingEnabled: false,
  status: 'beta-precommercial',
} as const;
export const LEGAL_LINKS = {
  privacy: 'https://cefaci.app/confidentialitate/',
  clientTerms: 'https://cefaci.app/termeni/',
  cookies: 'https://cefaci.app/cookies/',
  businessTerms: 'https://cefaci.app/business/termeni/',
  adminRules: 'https://cefaci.app/admin/reguli/',
  rights: 'https://cefaci.app/drepturile-tale/',
  security: 'https://cefaci.app/securitate/',
  contact: 'https://cefaci.app/contact/',
  deleteAccount: 'https://cefaci.app/sterge-contul/',
} as const;

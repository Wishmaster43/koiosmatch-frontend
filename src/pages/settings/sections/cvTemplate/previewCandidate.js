/**
 * previewCandidate — the sample candidate the CV template settings screen renders
 * with. Pure fixture data, pulled out of CvTemplateSettings because TWO consumers
 * need the exact same person: the live HTML preview and the "PDF preview" download
 * (CvDocument). One source keeps the on-screen mock and the generated PDF showing
 * identical content.
 */

export const PREVIEW_CANDIDATE = {
  name: 'Anouk de Vries',
  title: 'Verzorgende IG',
  email: 'anouk.devries@email.nl',
  phone: '06 12 34 56 78',
  address: 'Amsterdam',
  dob: '1990-03-15',
  nationality: 'Nederlands',
  summary: 'Enthousiaste zorgprofessional met 8 jaar ervaring in de ouderenzorg en thuiszorg. Betrouwbaar, klantgericht en flexibel inzetbaar.',
  // Sample data for the 'preferences' section — off by default, but a tenant
  // can enable + relocate it, so the preview needs something to actually show.
  preferredFunctions: ['Dagdienst', 'Avonddienst'],
  shiftType: ['Flexibel inzetbaar'],
  experiences: [
    { title: 'Verzorgende IG', company: 'Thuiszorg Noord', start_date: '2020-01-01', description: 'Zelfstandige thuiszorgverlening, medicijnbeheer en rapportage.' },
    { title: 'Helpende Plus',  company: 'Zorggroep West',  start_date: '2017-03-01', end_date: '2019-12-31' },
  ],
  educations: [
    { title: 'MBO Verpleging & Verzorging niveau 3', school: 'ROC Amsterdam', start_year: 2015, end_year: 2017 },
    { title: 'VMBO Zorg & Welzijn',                  school: 'Pieter Nieuwland College', start_year: 2011, end_year: 2015 },
  ],
  languages: [{ language: 'Nederlands', level: 'Moedertaal' }, { language: 'Engels', level: 'B2' }],
  skills:    [{ name: 'Medicijnbeheer' }, { name: 'Rapportage' }, { name: 'Tilhulpmiddelen' }, { name: 'BHV' }],
  certs:     [{ name: 'BIG-registratie' }, { name: 'VCA Basis' }],
}

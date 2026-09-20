/**
 * previewCandidate — the sample candidate the CV template settings screen renders
 * with. Pure fixture data, pulled out of CvTemplateSettings because TWO consumers
 * need the exact same person: the live HTML preview and the "PDF preview" download
 * (CvDocument). One source keeps the on-screen mock and the generated PDF showing
 * identical content.
 */

// PLACEHOLDER-GENERIEK-1: a general-staffing example (logistics), never a healthcare
// framing — Koios Match is not sector-specific, so the one fixture every tenant sees
// here must not read as "the product is for healthcare".
export const PREVIEW_CANDIDATE = {
  name: 'Anouk de Vries',
  title: 'Allround Magazijnmedewerker',
  email: 'anouk.devries@email.nl',
  phone: '06 12 34 56 78',
  address: 'Amsterdam',
  dob: '1990-03-15',
  nationality: 'Nederlands',
  summary: 'Ervaren logistiek medewerker met 8 jaar ervaring in transport en distributie. Betrouwbaar, klantgericht en flexibel inzetbaar.',
  // Sample data for the 'preferences' section — off by default, but a tenant
  // can enable + relocate it, so the preview needs something to actually show.
  preferredFunctions: ['Dagdienst', 'Avonddienst'],
  shiftType: ['Flexibel inzetbaar'],
  experiences: [
    { title: 'Allround Magazijnmedewerker', company: 'Logistiek Noord', start_date: '2020-01-01', description: 'Orderpicking, voorraadbeheer en interne transportplanning.' },
    { title: 'Heftruckchauffeur',           company: 'Transport West',  start_date: '2017-03-01', end_date: '2019-12-31' },
  ],
  educations: [
    { title: 'MBO Logistiek niveau 3', school: 'ROC Amsterdam', start_year: 2015, end_year: 2017 },
    { title: 'VMBO Techniek',          school: 'Pieter Nieuwland College', start_year: 2011, end_year: 2015 },
  ],
  languages: [{ language: 'Nederlands', level: 'Moedertaal' }, { language: 'Engels', level: 'B2' }],
  skills:    [{ name: 'Orderpicken' }, { name: 'Voorraadbeheer' }, { name: 'Heftruckrijden' }, { name: 'BHV' }],
  certs:     [{ name: 'Heftruckcertificaat' }, { name: 'VCA Basis' }],
}

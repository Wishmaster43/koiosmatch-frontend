const fs = require('fs')
const path = require('path')

// Per-locale strings for the new Industries lookup (nav label + section texts).
const T = {
  nl: { nav: 'Industrieën', title: 'Industrieën', subtitle: 'Beheer de branches die je kunt kiezen bij je bedrijfsprofiel.', add: 'Industrie toevoegen' },
  en: { nav: 'Industries', title: 'Industries', subtitle: 'Manage the industries selectable in your company profile.', add: 'Add industry' },
  de: { nav: 'Branchen', title: 'Branchen', subtitle: 'Verwalte die Branchen, die im Unternehmensprofil auswählbar sind.', add: 'Branche hinzufügen' },
  fr: { nav: 'Secteurs', title: 'Secteurs', subtitle: 'Gérez les secteurs disponibles dans le profil de votre entreprise.', add: 'Ajouter un secteur' },
  es: { nav: 'Sectores', title: 'Sectores', subtitle: 'Gestiona los sectores seleccionables en el perfil de tu empresa.', add: 'Añadir sector' },
}

for (const L of Object.keys(T)) {
  const p = path.join('src/i18n/locales', L, 'settings.json')
  let s = fs.readFileSync(p, 'utf8')
  const v = T[L]

  // 1) Add nav.industries right after nav.genders (same indentation).
  const navRe = /( *)"genders": "([^"]*)"/
  if (!navRe.test(s)) throw new Error('nav.genders not found for ' + L)
  s = s.replace(navRe, (m, ind, val) => `${ind}"genders": "${val}",\n${ind}"industries": ${JSON.stringify(v.nav)}`)

  // 2) Insert the industrySettings block just before the genderSettings block.
  const secRe = /( *)"genderSettings": \{/
  if (!secRe.test(s)) throw new Error('genderSettings block not found for ' + L)
  s = s.replace(secRe, (m, ind) =>
    `${ind}"industrySettings": {\n` +
    `${ind}  "title": ${JSON.stringify(v.title)},\n` +
    `${ind}  "subtitle": ${JSON.stringify(v.subtitle)},\n` +
    `${ind}  "add": ${JSON.stringify(v.add)}\n` +
    `${ind}},\n` +
    `${ind}"genderSettings": {`)

  JSON.parse(s) // validate
  fs.writeFileSync(p, s)
  console.log('updated ' + L)
}

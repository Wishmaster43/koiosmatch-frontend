#!/usr/bin/env node
// ENGLISH-CODE-1 / FILES-EN-1 (Danny 28-09: "Niets mag in NL zijn maar moet in Engels
// zijn alle files!!"): counts Dutch tokens in IDENTIFIERS and in STRING LITERALS of the
// frontend source (src, e2e, scripts; never the locale JSON, never comments — verbatim
// Danny quotes live there on purpose). Deterministic word-list heuristic, so it can be a
// ratchet: `--write` freezes the totals in scripts/english-code-ceiling.json, a plain run
// fails when either total grows. `--list` prints every hit (file:line token).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN = ['src', 'e2e', 'scripts']
const EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const SKIP = [/\/i18n\/locales\//, /api-generated\.ts$/, /node_modules/, /\/dist\//, /english-code-count\.mjs$/]
// Text catalogues (seeded demo copy, lookup seed labels) and the word-list tooling are
// values, not code: their string hits are reported apart and never ratcheted.
const TEXT_VALUES = [/\/demoSeedTexts\//, /lookupSeedCatalogue/, /comment-audit\.mjs$/, /dutchCopies\.houseStyle/, /placeholdersGeneric\.houseStyle/]
const isTest = (f) => /\.test\.[jt]sx?$/.test(f) || /^e2e\//.test(f)

// Dutch tokens that never occur as English words (lowercased; matched per identifier token
// and as whole words inside string literals). Product names (werkzoeken, helloflex) are
// deliberately absent.
const DUTCH = new Set(`
aanmaken aantal afdeling afdelingen afspraak afspraken afgerond akkoord alle annuleren
beschikbaar beschikbaarheid bellijst bellijsten bericht berichten bevestig bevestigen bewerken
bijwerken contactpersoon contactpersonen deelnemer eigenaar fase fout functie gebruiker
gebruikers geannuleerd gelukt geplaatst gesprek gesprekken geweigerd instelling instellingen
kandidaat kandidaten kans kansen klant klanten koppel koppeling locatie locaties maak
medewerker medewerkers meer mislukt naam nieuw nieuwe notitie notities omschrijving onthouden
opleiding opleidingen overgeslagen overzicht plaats prioriteit reden sollicitatie sollicitaties
status_reden stuur taak taken tijd titel toevoegen uitgevoerd vaardigheid vaardigheden vacature
vacatures verstuur verwijder verwijderen vestiging vestigingen voorstel wachtrij werkervaring
wijzig wijzigen zekerheid zoek zoeken
`.trim().split(/\s+/))

const files = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p)
    else if (EXT.test(name) && !SKIP.some(r => r.test(p))) files.push(p)
  }
}
for (const d of SCAN) if (existsSync(join(ROOT, d))) walk(join(ROOT, d))

// Strip comments (line + block) so quoted Dutch in comments never counts.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length))
// Identifier tokens: split camelCase / snake_case / kebab into lowercase words.
const tokensOf = (ident) => ident.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z]+/).filter(Boolean)

const hits = { identifiers: [], strings: [] }
for (const file of files) {
  const rel = relative(ROOT, file)
  const src = stripComments(readFileSync(file, 'utf8'))
  const lines = src.split('\n')
  lines.forEach((line, i) => {
    // string literals first, then identifiers on the line with the literals blanked out
    const literals = []
    const noStrings = line.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, m => { literals.push(m.slice(1, -1)); return ' '.repeat(m.length) })
    for (const lit of literals) {
      const words = lit.toLowerCase().split(/[^a-z_]+/).filter(Boolean)
      const dutch = words.filter(w => DUTCH.has(w) || w.split('_').some(p => DUTCH.has(p)))
      if (dutch.length) hits.strings.push({ file: rel, line: i + 1, token: dutch[0], text: lit.slice(0, 60) })
    }
    for (const m of noStrings.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
      const dutch = tokensOf(m[0]).filter(t => DUTCH.has(t))
      if (dutch.length) hits.identifiers.push({ file: rel, line: i + 1, token: dutch[0], text: m[0] })
    }
  })
}

// Four buckets: identifiers (all code incl. tests: an identifier is code wherever it lives),
// strings in source, strings in tests/probes (fixtures follow the renames), strings in text catalogues.
const kindOf = (h) => TEXT_VALUES.some(r => r.test(h.file)) ? 'strings_catalogue' : isTest(h.file) ? 'strings_tests' : 'strings_src'
const totals = { identifiers: hits.identifiers.length, strings_src: 0, strings_tests: 0, strings_catalogue: 0, files: files.length }
for (const h of hits.strings) totals[kindOf(h)]++
const CEIL = join(ROOT, 'scripts', 'english-code-ceiling.json')
const args = new Set(process.argv.slice(2))
if (args.has('--list')) {
  for (const h of hits.identifiers) console.log(`identifiers\t${h.file}:${h.line}\t${h.token}\t${h.text}`)
  for (const h of hits.strings) console.log(`${kindOf(h)}\t${h.file}:${h.line}\t${h.token}\t${h.text}`)
}
const perFile = {}
for (const k of ['identifiers', 'strings']) for (const h of hits[k]) perFile[h.file] = (perFile[h.file] || 0) + 1
const top = Object.entries(perFile).sort((a, b) => b[1] - a[1]).slice(0, 15)
console.log(`english-code: ${totals.identifiers} Dutch identifier tokens; Dutch string literals: ${totals.strings_src} in source, ${totals.strings_tests} in tests/probes, ${totals.strings_catalogue} in text catalogues (${totals.files} files)`)
if (args.has('--top')) for (const [f, n] of top) console.log(`  ${String(n).padStart(4)}  ${f}`)
if (args.has('--write')) { writeFileSync(CEIL, JSON.stringify(totals, null, 2) + '\n'); console.log(`ceiling written: ${CEIL}`); process.exit(0) }
if (existsSync(CEIL)) {
  const frozen = JSON.parse(readFileSync(CEIL, 'utf8'))
  // The ratchet covers identifiers and source strings; tests and catalogues are informational.
  const grew = totals.identifiers > frozen.identifiers || totals.strings_src > frozen.strings_src
  if (grew) { console.error(`✗ english-code ceiling exceeded (frozen ${frozen.identifiers} identifiers / ${frozen.strings_src} source strings) — new Dutch identifiers or strings landed`); process.exit(1) }
  console.log(`✓ english-code ceiling ok (frozen ${frozen.identifiers} identifiers / ${frozen.strings_src} source strings)`)
}

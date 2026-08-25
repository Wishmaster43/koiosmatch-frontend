/**
 * comment-audit — measures CLAUDE.md §0.1 and §0.2 across the frontend source:
 * every file explains in ENGLISH what it does (a header comment), and no comment
 * is written in Dutch. Reports, never edits.
 *
 *   node scripts/comment-audit.mjs            # summary
 *   node scripts/comment-audit.mjs --list     # every offending file
 *   node scripts/comment-audit.mjs --json     # machine-readable, for a lane's gate
 *   node scripts/comment-audit.mjs src/pages  # limit to a subtree
 *
 * Dutch detection is deliberately conservative: a comment line counts as Dutch only
 * when it holds at least four words and at least three of them are unambiguous Dutch
 * function words. That misses a rare short Dutch line and never flags English prose
 * that happens to contain a Dutch-looking token.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DUTCH_MARKERS = new Set(`de het een niet wordt worden toevoegen verwijderen opslaan annuleren geen nog
alle nieuwe gebruiker vestiging klant klanten kandidaat kandidaten vacature sollicitatie instellingen zoeken
kiest selecteer bewerken wijzigen laden mislukt opgeslagen met van voor naar bij jouw deze dit hier ook als
maar wel nu alleen zijn kan kunnen moet moeten dagen weken maanden jaar uur naam datum tijd fase reden
opmerking notitie bericht berichten verzonden ontvangen afgerond gesloten actief gearchiveerd overzicht
rapport taak taken afspraak bellijst werkstroom geselecteerd beschikbaar weergave wachtrij eigenaar koppelen
gekoppeld toegevoegd verwijderd aanmaken verstuur versturen bevestigen sluiten terug volgende vorige meer
minder alles niets leeg invullen verplicht optioneel verborgen onbekend geplaatst afgewezen uitgenodigd
voorgesteld aangenomen gepland telefoon adres plaats land functie contactpersoon afdeling locatie dienst
plaatsing wijziging geschiedenis nooit altijd zodat waarde velden veld regel regels omdat dus daarom wij ons
onze jij je hem haar zelf eerst daarna zonder tussen binnen buiten boven onder`.split(/\s+/).filter(Boolean))

// The product's own vocabulary. An English comment that names a screen, a button, a
// settings path or a CSV column keeps those words as they are — "Settings → Klanten →
// Weergave" and `klant_naam` are what those things are CALLED, and translating them
// inside a comment would make the comment untrue.
const DOMAIN_VOCABULARY = new Set(`klant klanten kandidaat kandidaten vacature vacatures locatie locaties
afdeling afdelingen contactpersoon contactpersonen taak taken bellijst bellijsten match matches kans kansen
sollicitatie sollicitaties weergave instellingen verplicht gearchiveerd bron fase eigenaar functie vestiging
naam toevoegen aanmaken zoeken notities velden koppelen samenvoegen uren diensten dienst`.split(/\s+/).filter(Boolean))

const SKIP_DIRS = new Set(['node_modules', 'dist', 'locales'])
const SKIP_FILE = /\.test\.|api-generated|\.d\.ts$/

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) { walk(full, out); continue }
    if (/\.(jsx?|tsx?)$/.test(name) && !SKIP_FILE.test(full)) out.push(full)
  }
  return out
}

// A file "explains itself" when a comment appears BEFORE its first export — the
// explanation may sit under the import block, which is a normal and readable layout.
// Requiring a comment at byte 0 flagged 260 files that document themselves perfectly
// well two lines lower; that measured wrong, so the rule follows the real convention.
function hasHeader(src) {
  const firstExport = src.search(/^export\s/m)
  const head = firstExport === -1 ? src : src.slice(0, firstExport)
  return /(^|\n)\s*(\/\*|\/\/)/.test(head)
}

// Comment lines: `//` lines and the body lines of a block comment.
function dutchCommentLines(src) {
  const hits = []
  const lines = src.split('\n')
  // An owner quote often runs over several lines, and only the first carries the opening
  // quotation mark. Track whether we are INSIDE such a quote, otherwise every
  // continuation line reads as an untranslated Dutch comment while it is the convention.
  let insideQuote = false
  lines.forEach((line, i) => {
    const m = line.match(/^\s*(?:\/\/|\*)\s?(.*)$/)
    if (!m) { insideQuote = false; return }
    const marks = (m[1].match(/["\u201c\u201d]/g) ?? []).length
    const wasInside = insideQuote
    if (marks % 2 === 1) insideQuote = !insideQuote
    const words = (m[1].toLowerCase().match(/[a-zà-ü]+/g) ?? [])
    if (words.length < 4) return
    if (words.filter(w => DUTCH_MARKERS.has(w)).length < 3) return
    // Two sanctioned kinds are NOT violations, and counting them hid the real ones:
    // (1) the owner's own words kept verbatim next to an English rendering — those
    //     carry a quotation mark; (2) an English sentence naming Dutch product
    //     vocabulary (Klant, Vacature, Contactpersoon) or a settings path, which is
    //     what those screens are actually called.
    // Domain-only: every Dutch word on the line is product vocabulary, so the sentence
    // around it is English and the Dutch words are names, not prose.
    const dutchWords = words.filter(w => DUTCH_MARKERS.has(w))
    const domainOnly = dutchWords.every(w => DOMAIN_VOCABULARY.has(w))
    const quoted = wasInside || /["\u201c\u201d']/.test(m[1]) || domainOnly
    hits.push({ line: i + 1, text: m[1].slice(0, 100), quoted, domainOnly })
  })
  return hits
}

const args = process.argv.slice(2)
const roots = args.filter(a => !a.startsWith('--'))
const files = (roots.length ? roots : ['src']).flatMap(r => (statSync(r).isDirectory() ? walk(r) : [r]))

const missingHeader = []
const dutchFiles = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  if (!hasHeader(src)) missingHeader.push(f)
  const hits = dutchCommentLines(src)
  if (hits.length) dutchFiles.push({ file: f, count: hits.length, hits })
}
const dutchTotal = dutchFiles.reduce((n, d) => n + d.count, 0)
// Only unquoted Dutch prose is a violation; quoted owner instructions are the convention.
const proseTotal = dutchFiles.reduce((n, d) => n + d.hits.filter(h => !h.quoted).length, 0)

if (args.includes('--json')) {
  console.log(JSON.stringify({ files: files.length, missingHeader, dutchFiles, dutchTotal, proseTotal }, null, 1))
} else {
  console.log(`files scanned: ${files.length}`)
  console.log(`without an explaining header comment: ${missingHeader.length}`)
  console.log(`comment lines holding Dutch: ${dutchTotal} (of which ${dutchTotal - proseTotal} are quoted owner instructions or product vocabulary, both sanctioned)`)
  console.log(`unquoted Dutch prose (the violations): ${proseTotal}`)
  if (args.includes('--list')) {
    console.log('\n-- missing header --'); missingHeader.forEach(f => console.log('  ' + f))
    console.log('\n-- dutch comments --'); dutchFiles.sort((a, b) => b.count - a.count)
      .forEach(d => console.log(`  ${String(d.count).padStart(3)}  ${d.file}`))
  }
}
process.exit(missingHeader.length || proseTotal ? 1 : 0)

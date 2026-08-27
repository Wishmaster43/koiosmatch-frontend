/**
 * Dutch-copy guard (Lane L6, house style): a non-nl locale value that is byte-identical to the
 * nl value AND contains a Dutch marker word is a smuggled Dutch string, not a legitimate
 * cognate. CLAUDE.md §5: i18n is all-or-nothing — a Dutch island in en/de/fr/es is a bug, and
 * this must never regress once fixed.
 *
 * Loads the JSON the same way src/i18n/localeParity.test.ts does (Vite's import.meta.glob, no
 * node fs) so tsc and vitest agree.
 */
import { describe, it, expect } from 'vitest'

type Json = { [k: string]: unknown }

// Flatten a nested translation object to [dotted key path, leaf value] pairs (arrays are leaves).
const flat = (o: Json, pre = ''): [string, unknown][] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? flat(v as Json, pre + k + '.')
      : ([[pre + k, v]] as [string, unknown][]))

// Every locale JSON, keyed by its path './locales/<loc>/<file>.json'.
const modules = import.meta.glob('./locales/*/*.json', { eager: true, import: 'default' }) as Record<string, Json>

const REF = 'nl'
const TARGETS = ['en', 'de', 'fr', 'es'] as const

// Group the loaded modules by locale → file.
const byLoc: Record<string, Record<string, Json>> = {}
for (const [p, mod] of Object.entries(modules)) {
  const m = p.match(/\/locales\/([^/]+)\/([^/]+)$/)
  if (!m) continue
  ;(byLoc[m[1]] ??= {})[m[2]] = mod
}

// Read the string at a dotted key path (undefined when the leaf is not a string).
const valueAt = (o: Json, path: string): string | undefined => {
  const v = path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Json)[k] : undefined), o)
  return typeof v === 'string' ? v : undefined
}

// Common Dutch function/content words that show up in copy-pasted (untranslated) strings.
// Whole-word, case-insensitive matching — a substring like "een" inside "screen" must not hit.
const DUTCH_MARKERS = [
  'de', 'het', 'een', 'niet', 'wordt', 'worden', 'toevoegen', 'verwijderen', 'opslaan',
  'annuleren', 'bezig', 'geen', 'nog', 'alle', 'nieuwe', 'nieuw', 'gebruiker', 'gebruikers',
  'vestiging', 'vestigingen', 'klant', 'klanten', 'kandidaat', 'kandidaten', 'vacature',
  'vacatures', 'sollicitatie', 'sollicitaties', 'instellingen', 'zoeken', 'kies', 'selecteer',
  'bewerken', 'wijzigen', 'laden', 'mislukt', 'opgeslagen', 'met', 'van', 'voor', 'naar', 'bij',
  'je', 'jouw', 'uw', 'deze', 'dit', 'hier', 'ook', 'als', 'maar', 'wel', 'nu', 'alleen', 'zijn',
  'kan', 'kunnen', 'moet', 'moeten', 'dagen', 'weken', 'maanden', 'jaar', 'uur', 'minuten',
  'naam', 'datum', 'tijd', 'fase', 'reden', 'opmerking', 'notitie', 'notities', 'bericht',
  'berichten', 'verzonden', 'ontvangen', 'afgerond', 'gesloten', 'actief', 'gearchiveerd',
  'overzicht', 'rapport', 'rapporten', 'taak', 'taken', 'afspraak', 'afspraken', 'bellijst',
  'bellijsten', 'werkstroom', 'geselecteerd', 'beschikbaar', 'weergave', 'wachtrij', 'eigenaar',
  'koppelen', 'gekoppeld', 'ontkoppelen', 'toegevoegd', 'verwijderd', 'aanmaken', 'aangemaakt',
  'verstuur', 'versturen', 'verstuurd', 'bevestigen', 'bevestig', 'sluiten', 'terug', 'volgende',
  'vorige', 'meer', 'minder', 'alles', 'niets', 'leeg', 'invullen', 'verplicht', 'optioneel',
  'verborgen', 'ja', 'nee', 'onbekend', 'geplaatst', 'afgewezen', 'uitgenodigd', 'voorgesteld',
  'aangenomen', 'ingepland', 'gepland', 'telefoon', 'adres', 'postcode', 'plaats', 'land',
  'functie', 'functies', 'contactpersoon', 'contactpersonen', 'afdeling', 'afdelingen',
  'locatie', 'locaties', 'dienst', 'diensten', 'plaatsing', 'plaatsingen', 'wijziging',
  'wijzigingen', 'geschiedenis',
]

// One whole-word, case-insensitive regex over the marker list.
const MARKER_RE = new RegExp(`\\b(${DUTCH_MARKERS.join('|')})\\b`, 'i')

// Legitimate identical terms: proper nouns, brand names, abbreviations, and — the bulk of the
// list below — true Dutch/German or Dutch/Spanish COGNATES (Dutch and German share a large
// common-word vocabulary; "fase"/"date"-adjacent Latin loans do the same for Spanish). Verified
// per group by checking sibling keys in the SAME locale file translate differently (e.g. German
// "Kandidaat" -> "Kandidat", "Klant" -> "Kunde" sit right next to the identical-plural
// "Kandidaten" entries below), which proves the identical spelling is a deliberate correct
// translation, not a missed one. Extend with 'locale/namespace:dotted.key.path' plus a one-line
// reason as a trailing comment — never to silence a real untranslated string.
const ALLOWLIST: string[] = [
  // German "alle" = "all" (identical spelling, all-caps UI label)
  'de/workflows:fields.logicAll',

  // German "Alle" = "all"
  'de/customers:priceAgreements.any',
  'de/settings:jobs.filters.all',
  'de/shiftmanager:shiftAnalysis.allForms',
  'de/vacancies:buckets.all',
  'de/workflows:categories.all',

  // German "Datum" = "date" (identical spelling)
  'de/candidates:planning.date',
  'de/candidates:work.colDate',
  'de/common:notesAssist.panel.editDate',
  'de/customers:opportunities.col.date',
  'de/dashboard:feed.col.date',
  'de/settings:audit.colDate',
  'de/settings:billing.invoices.colDate',
  'de/settings:billing.usage.daily.colDate',
  'de/settings:customFieldsSettings.types.date',
  'de/settings:log.date',
  'de/shiftmanager:orders.cols.date',
  'de/shiftmanager:orders.drawer.date',
  'de/shiftmanager:shiftsDrawer.fields.date',
  'de/whatsapp:messages.date',
  'de/workflows:fieldLabels.Datum',
  'de/workflows:fieldOptions.Datum',

  // German "Datum" = "date"; the parenthesised part is a literal date-format example, not prose
  'de/workflows:fieldLabels.Datum (08-07-2026)',

  // German "Datum" = "date"; "(d-m-Y)" is a format-token example, not prose
  'de/workflows:canvas.displayAsDate',

  // "Details" and "Kandidaten" are identical German/Dutch loanwords; the dash is the
  // CLAUDE.md-allowed data-value separator ("Section — Page"), not sentence punctuation
  'de/reports:candidates.title',

  // German "Dienst" = "service" (identical spelling); "-ID" is the same abbreviation in both languages
  'de/workflows:fieldLabels.Dienst-ID',

  // Spanish "fase" = "phase" (identical spelling, shared Greek/Latin root)
  'es/analytics:candidates.axes.phase',
  'es/analytics:customers.axes.phase',
  'es/applications:add.phase',
  'es/applications:cols.phase',
  'es/applications:drawer.phase',
  'es/applications:insights.phase',
  'es/applications:status.phase',
  'es/candidates:changelog.axisPhase',
  'es/candidates:changelog.fields.phase',
  'es/candidates:columns.phase',
  'es/candidates:drawer.phase',
  'es/candidates:filters.phase',
  'es/candidates:work.phase',
  'es/customers:cols.phase',
  'es/customers:drawer.phase',
  'es/customers:filters.phase',
  'es/customers:modal.fields.phase',
  'es/settings:applicationDisplay.fields.application_table_color_phase.label',
  'es/settings:audit.field.phase',
  'es/settings:candidateDisplay.fields.candidate_table_color_phase.label',
  'es/settings:lookups.phases.title',
  'es/settings:nav.candidate_phases',
  'es/vacancies:applicants.phase',
  'es/workflows:fieldLabels.Fase',

  // German "Ja" = "yes"
  'de/common:yes',
  'de/reports:contacts.yes',
  'de/shiftmanager:contactsPage.yes',

  // German plural "Kandidaten" (of "Kandidat") = "candidates" (identical spelling)
  'de/analytics:candidates.viewSwitch.candidates',
  'de/analytics:tabs.candidates',
  'de/candidates:title',
  'de/common:nav.candidates',
  'de/common:nav.reports_candidates',
  'de/common:nav.shiftmanager_candidates-table',
  'de/dashboard:chart.series.candidates',
  'de/pageTitles:candidates',
  'de/reports:runs.cols.candidates',
  'de/reports:runs.drawer.candidates',
  'de/settings:apiKeys.scopes.candidates',
  'de/settings:audit.logName.candidates',
  'de/settings:email.context.kandidaten.title',
  'de/settings:export.entities.candidates.title',
  'de/settings:moduleView.modules.candidates',
  'de/settings:nav.cf_candidate',
  'de/settings:nav.dt_candidate',
  'de/settings:nav.kpis_candidates',
  'de/settings:nav.notif_candidates',
  'de/settings:nav.nt_candidate',
  'de/settings:notifications.context.kandidaten.title',
  'de/settings:reportKpis.reportNames.candidates',
  'de/settings:roles.groups.candidates',
  'de/settings:sync.items.candidates.label',
  'de/shiftmanager:dashboard.stats.totalCandidates',
  'de/shiftmanager:orders.drawer.candidates',
  'de/workflows:categories.candidates',
  'de/workflows:fieldLabels.Kandidaten',
  'de/workflows:modules.candidates',
  'de/workflows:modules.hf_candidates',
  'de/workflows:modules.intus_candidates',
  'de/workflows:modules.sm_candidates',

  // German "Kandidaten" = "candidates"; "-SM" is the Shiftmanager abbreviation, same in both languages
  'de/common:nav.shiftmanager_candidates',

  // German "Land" = "country" (identical spelling)
  'de/candidates:modal.fields.country',
  'de/candidates:profile.country',
  'de/customers:locations.detail.country',
  'de/customers:subModal.country',
  'de/settings:company.country',
  'de/settings:identifierValidation.colCountry',
  'de/settings:locations.country',
  'de/settings:nationalities.countryCode',
  'de/settings:provinces.country',
  'de/vacancies:details.country',

  // German "Minuten" = "minutes" (identical spelling)
  'de/workflows:scheduleModal.unit.minutes',

  // German "alle" = "all" (lowercase option label)
  'de/workflows:fieldOptions.all',
  'de/workflows:fieldOptions.alle',

  // German "ja" = "yes" (lowercase flag value)
  'de/settings:whatsapp.embedded.syncYes',

  // EU driving-licence category code, not the Dutch article. NOTE: this is the
  // driverLicenses family — unrelated to Lane D's workflowFolders/workflowNames work
  // (a different LOOKUP-I18N-1 lane's catalogue entries); kept here only because
  // removing it breaks this shared gate unconditionally for every locale, verified
  // by running the suite without it (round 2, 25-08) — flagged for the manager, not
  // silently absorbed into this lane's own scope.
  'en/common:lookupSeeds.driverLicenses.de',
  'de/common:lookupSeeds.driverLicenses.de',
  'fr/common:lookupSeeds.driverLicenses.de',
  'es/common:lookupSeeds.driverLicenses.de',

  // German "Kandidaten" = "candidates" (identical spelling), workflow-folder family
  'de/common:lookupSeeds.workflowFolders.kandidaten',

  // "AI Planner De-Escalate" is a seeded workflow's own literal name (unbranded across
  // locales, LOOKUP-I18N-1); "De" in "De-Escalate" trips the Dutch-article marker, not
  // the Dutch word itself
  'en/common:lookupSeeds.workflowNames.aiPlannerDeEscalate',
  'de/common:lookupSeeds.workflowNames.aiPlannerDeEscalate',
  'fr/common:lookupSeeds.workflowNames.aiPlannerDeEscalate',
  'es/common:lookupSeeds.workflowNames.aiPlannerDeEscalate',
]

describe('i18n house style — no smuggled Dutch copies in translated locales', () => {
  const refFiles = byLoc[REF] ?? {}
  for (const file of Object.keys(refFiles)) {
    const ns = file.replace('.json', '')
    const refKeys = flat(refFiles[file])
    for (const loc of TARGETS) {
      it(`${loc}/${file} has no Dutch-copy leaf`, () => {
        const target = byLoc[loc]?.[file] ?? {}
        const offenders: string[] = []
        for (const [key, refVal] of refKeys) {
          if (typeof refVal !== 'string') continue
          const allowKey = `${loc}/${ns}:${key}`
          if (ALLOWLIST.includes(allowKey)) continue
          const val = valueAt(target, key)
          if (val === undefined) continue
          if (val === refVal && MARKER_RE.test(val)) {
            offenders.push(`${loc}/${ns} ${key} = "${val}"`)
          }
        }
        expect(offenders, `Dutch copy found:\n${offenders.join('\n')}`).toEqual([])
      })
    }
  }
})

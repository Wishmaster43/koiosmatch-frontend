/**
 * Registry i18n coverage guard (§5): every user-facing `placeholder` / `hint` /
 * `help` string in the module registry must have a workflows.json key in every
 * shipped locale (fieldPlaceholders.* / fieldHints.*), unless it is explicitly
 * allow-listed as language-neutral (numbers, URLs, raw tokens, code samples).
 * Adding a new Dutch registry string without its ×5 keys fails this test.
 */
import { describe, it, expect } from 'vitest'
import { MODULE_SCHEMAS } from '@/modules/index'
import { i18nKey } from '@/components/layout/workflow/moduleI18n'

// Every shipped locale's workflows.json, loaded like localeParity.test.ts does.
const modules = import.meta.glob('../i18n/locales/*/workflows.json', { eager: true, import: 'default' }) as Record<string, {
  fieldPlaceholders?: Record<string, string>
  fieldHints?: Record<string, string>
}>
const LOCS = ['nl', 'en', 'de', 'fr', 'es']

// Language-neutral registry literals — identical in every language, so they
// deliberately have NO key and render via the defaultValue fallback.
const NEUTRAL = new Set([
  '0', '1', '5', '10', '24', '30', '35', '50', '100', '500', '10000',
  'nl', 'tr', 'status', 'available_again_date', 'shifts_offered',
  '{"key": "value"}', '<html>...</html>', '<table>...</table>', '(\\d+)',
  'https://api.intus.example/candidates', 'https://api.intus.example/shifts',
  '{{trigger.session_id}}', '{{trigger.candidate_id}}', '6', 'flex@yesway.nu',
  '{{1.bedrag}}', '{{1.inhoud}}', '{{1.naam}}', '{{1.waarde}}',
])

// Collect every placeholder/hint/help string from the registry schemas.
const wanted: Array<{ bucket: 'fieldPlaceholders' | 'fieldHints'; src: string }> = []
for (const schema of Object.values(MODULE_SCHEMAS)) {
  for (const field of (schema ?? []) as Array<Record<string, unknown>>) {
    const ph = field.placeholder
    if (typeof ph === 'string' && ph && !NEUTRAL.has(ph)) wanted.push({ bucket: 'fieldPlaceholders', src: ph })
    for (const k of ['hint', 'help'] as const) {
      const v = field[k]
      if (typeof v === 'string' && v && !NEUTRAL.has(v)) wanted.push({ bucket: 'fieldHints', src: v })
    }
  }
}

describe('module registry placeholder/hint i18n coverage', () => {
  it('found registry strings to check (sanity)', () => {
    expect(wanted.length).toBeGreaterThan(50)
  })

  for (const loc of LOCS) {
    it(`${loc}/workflows.json covers every registry placeholder/hint`, () => {
      const file = Object.entries(modules).find(([p]) => p.includes(`/${loc}/`))?.[1]
      expect(file, `${loc}/workflows.json not found`).toBeTruthy()
      const missing = wanted
        .filter(({ bucket, src }) => (file?.[bucket] ?? {})[i18nKey(src)] == null)
        .map(({ bucket, src }) => `${bucket}: ${JSON.stringify(src)}`)
      expect([...new Set(missing)], `missing in ${loc}: ${[...new Set(missing)].join(' | ')}`).toEqual([])
    })
  }
})

/**
 * Output-field (column) label coverage — a DIFFERENT data source than the block
 * above. Placeholders/hints live in the FE's own MODULE_SCHEMAS and can be
 * derived live; `output_fields` labels are backend-only (each Modules/*Module.php's
 * `outputFields()`, served at runtime via GET /workflows/modules — see
 * useModuleCatalog) and never ship in the FE bundle, so there is nothing to derive
 * them FROM here. This fixture is a manual mirror of that backend catalog (swept
 * 2026-07-15, ~90 fields across ~20 modules) — it guards the labels known at sweep
 * time against regressing, but a future backend-added output field needs a manual
 * addition here too; it is not auto-discovered like the block above.
 */
const OUTPUT_FIELD_LABELS = [
  'AI-enabled', 'AI-interview extractieveld', 'Aantal beschikbare diensten', 'Aantal keer gewerkt',
  'Aantal keer gewerkt (ruw, API-shape)', 'Aantal no-shows', 'Achternaam', 'Achternaam (ruw)', 'Actief',
  'Adres (straat nr postcode)', 'Beschikbare diensten (ruwe Shiftmanager-response)',
  'Conversation: WhatsApp-nummer', 'Conversation: actief intent', 'Conversation: geëscaleerd',
  'Conversation: laatste bericht', 'Conversation: laatste inkomend bericht', 'Conversation: mislukte pogingen',
  'Conversation: state AI flexplanner', 'Conversation: state diensten aangeboden',
  'Conversation: state geen reactie', 'Conversation: state herinnering', 'Conversation: state recruiter intro',
  'Conversation: state uren herinnering', 'Dag (Ma/Di/…)', 'Dagdeel (dag/avond/nacht)', 'Datum (08-07-2026)',
  'Dienst-ID', 'E-mail', 'E-mail (ruw)', 'Eigenaar (recruiter-ID)', 'Einddatum dienstverband',
  'Einde (ISO/UTC)', 'Eindtijd (NL)', 'Fase', 'Favoriete locaties', 'Filiaalnaam', 'Functie', 'Functietitel',
  'Geboortedatum', 'Geslacht', 'Getopte + gescoorde diensten (top N, elk met score/tarief/tijden)',
  'Header (Wo 08/07 23:00)', 'Huidige intake-status', 'Huisnummer', 'Inschrijfdatum',
  'Inschrijfdatum (afgeleid)', 'Inschrijfdatum (ruw, genest)', 'Kandidaat-ID',
  'Kenmerken (dagdienst/avonddienst/…)', 'Klant-ID', 'Klantnaam', 'Laatst aangeboden', 'Laatst geboekt',
  'Laatst gewerkt', 'Laatst gewerkt (ruw, API-shape)', 'Laatst ingelogd', 'Laatst ingelogd (ruw, API-shape)',
  'Laatst ingepland', 'Laatst ingepland (ruw, API-shape)', 'Laatste bericht (tijdstip)',
  'Laatste bericht: heeft reactie', 'Laatste bericht: reactie ontvangen om', 'Laatste berichtcategorie',
  'Laatste contact', 'Locatie (order)', 'Medewerker-ID', 'Mobiel nummer', 'Mobiel nummer (ruw)',
  'Order-onderwerp (ruw)', 'Personeelsnummer', 'Plaats',
  'Planningsnotitie', 'Pools', 'Postcode', 'Reden van afwijzing (bij DISQUALIFIED)', 'Respons-percentage',
  'Runtijd (HH:mm)', 'SM-reminder al gemaild', 'Shift-einde (ruw)', 'Shift-start (ruw)', 'Shiftmanager ID',
  'Start (ISO/UTC)', 'Starttijd (ISO)', 'Starttijd (NL)', 'Status (SM)',
  'Status (afgeleid: employee.status of top-level)', 'Status (eigen bucket: open/in_process/completed)',
  'Status (inzetbaarheid)', 'Status (ruw, genest)', 'Straat', 'Tarieven (samengevat)', 'Telefoonnummer',
  'Type medewerker', 'Vestiging', 'Volledige naam', 'Volledige naam (afgeleid)', 'Voornaam', 'Voornaam (ruw)',
  'WhatsApp-toestemming',
]

describe('module registry output_fields label i18n coverage (static backend mirror)', () => {
  it('found output_fields labels to check (sanity)', () => {
    expect(OUTPUT_FIELD_LABELS.length).toBeGreaterThan(90)
  })

  for (const loc of LOCS) {
    it(`${loc}/workflows.json covers every known output_fields label`, () => {
      const file = Object.entries(modules).find(([p]) => p.includes(`/${loc}/`))?.[1] as
        { fieldLabels?: Record<string, string> } | undefined
      expect(file, `${loc}/workflows.json not found`).toBeTruthy()
      const missing = OUTPUT_FIELD_LABELS.filter(src => (file?.fieldLabels ?? {})[i18nKey(src)] == null)
      expect(missing, `missing fieldLabels in ${loc}: ${missing.join(' | ')}`).toEqual([])
    })
  }
})

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
const LOCS = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pt']

// Language-neutral registry literals — identical in every language, so they
// deliberately have NO key and render via the defaultValue fallback.
const NEUTRAL = new Set([
  '0', '1', '3', '5', '10', '24', '30', '35', '50', '100', '500', '10000',
  'nl', 'tr', 'status', 'available_again_date', 'shifts_offered',
  '{"key": "value"}', '<html>...</html>', '<table>...</table>', '(\\d+)',
  'https://api.intus.example/candidates', 'https://api.intus.example/shifts',
  '{{trigger.session_id}}', '{{trigger.candidate_id}}', '6', 'flex@yesway.nu',
  '{{1.bedrag}}', '{{1.inhoud}}', '{{1.naam}}', '{{1.waarde}}',
  // WF-BUILDER-VELDEN-1: notification_send's link_entity placeholder — a technical
  // bundle-field-name example (matches the "<entity>_id" the engine resolves against),
  // never a translatable word.
  'conversation',
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
    // Option-level hint/help (none today) rides the same bucket, so it joins the same guard.
    if (Array.isArray(field.options)) for (const opt of field.options as Array<Record<string, unknown> | string>) {
      if (!opt || typeof opt !== 'object') continue
      for (const k of ['hint', 'help'] as const) { const v = opt[k]; if (typeof v === 'string' && v && !NEUTRAL.has(v)) wanted.push({ bucket: 'fieldHints', src: v }) }
    }
  }
}

describe('module registry placeholder/hint i18n coverage', () => {
  it('found registry strings to check (sanity)', () => {
    expect(wanted.length).toBeGreaterThan(50)
  })

  // MODULES-EN-2 (FILES-EN-1, 05-11): a registry placeholder/hint is its own English source text, so its
  // key is English too and nl is a translation like any other locale; a Dutch source string fails here.
  it('every registry placeholder/hint equals its own en value (the string is the English source text)', () => {
    const en = Object.entries(modules).find(([p]) => p.includes('/en/'))?.[1]
    const off = wanted.filter(({ bucket, src }) => (en?.[bucket] ?? {})[i18nKey(src)] !== src).map(({ bucket, src }) => `${bucket}: ${JSON.stringify(src)}`)
    expect([...new Set(off)], `registry string differs from its en value: ${[...new Set(off)].join(' | ')}`).toEqual([])
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
  'AI-enabled', 'Called workflow', 'Number of available shifts', 'Times worked', 'Times worked (raw, API shape)',
  'Number of no-shows', 'Last name', 'Last name (raw)', 'Active', 'Address (street, no., postal code)',
  'Available shifts (raw Shiftmanager response)', 'Conversation: WhatsApp number', 'Conversation: active intent',
  'Conversation: escalated', 'Conversation: last message', 'Conversation: last inbound message',
  'Conversation: failed attempts', 'Conversation: state AI flexplanner', 'Conversation: state shifts offered',
  'Conversation: state no response', 'Conversation: state reminder', 'Conversation: state recruiter intro',
  'Conversation: state hours reminder', 'Day (Mon/Tue/…)', 'Part of day (day/evening/night)', 'Date (08-07-2026)',
  'Shift ID', 'Ran directly (sync)', 'E-mail', 'E-mail (raw)', 'Owner (recruiter ID)', 'Employment end date',
  'End (ISO/UTC)', 'End time (NL)', 'Phase', 'Favourite locations', 'Branch name', 'Function', 'Job title',
  'Date of birth', 'Gender', 'Opted-in + scored shifts (top N, each with score/rate/times)',
  'Header (Wed 08/07 23:00)', 'House number', 'Queued', 'Registration date', 'Registration date (derived)',
  'Registration date (raw, nested)', 'Candidate ID', 'Features (day shift/evening shift/…)', 'Child run id',
  'Customer ID', 'Customer name', 'Last offered', 'Last booked', 'Last worked', 'Last worked (raw, API shape)',
  'Last logged in', 'Last logged in (raw, API shape)', 'Last scheduled', 'Last scheduled (raw, API shape)',
  'Last message (time)', 'Last message: has response', 'Last message: response received at', 'Last message category',
  'Last contact', 'Location (order)', 'Employee ID', 'Mobile number', 'Mobile number (raw)', 'Order subject (raw)',
  'Employee number', 'City', 'Scheduling note', 'Pools', 'Postal code', 'Rejection reason (when DISQUALIFIED)',
  'Response rate', 'Run time (HH:mm)', 'SM reminder already e-mailed', 'Shift end (raw)', 'Shift start (raw)',
  'Shiftmanager ID', 'Start (ISO/UTC)', 'Start time (ISO)', 'Start time (NL)', 'Status (SM)',
  'Status (derived: employee.status or top-level)', 'Status (open/in_process/completed)', 'Status (deployability)',
  'Status (raw, nested)', 'Street', 'Rates (summary)', 'Phone number', 'Employee type', 'Child run outcome (sync)',
  'Branch', 'Full name', 'Full name (derived)', 'First name', 'First name (raw)', 'WhatsApp consent',
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

// Pure helpers for the custom-fields editor (moved verbatim from CustomFieldsSettings).
import type { CustomField, CustomFieldDef } from './types'

// entity_type → the nav.<id> label already registered for its sub-tab (registry.jsx),
// reused here as the human-readable entity name instead of a second hardcoded map.
export const ENTITY_NAV_ID: Record<string, string> = {
  candidate: 'cf_candidate', application: 'cf_application', match: 'cf_match', vacancy: 'cf_vacancy',
  task: 'cf_task', opportunity: 'cf_opportunity', outreach_campaign: 'cf_outreach_campaign',
  customer: 'cf_customer', customer_location: 'cf_customer_location',
  customer_department: 'cf_customer_department', customer_contact: 'cf_customer_contact',
}

// Generate a slug from a label (lowercase, letters/numbers/underscores only).
export const toSlug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

// Pick a label for the active language (fallback lang-base → en → nl → any → key).
const pickLabel = (l: Record<string, string> | undefined, lang: string, key: string): string =>
  l ? (l[lang] ?? l[lang.split('-')[0]] ?? l.en ?? l.nl ?? Object.values(l)[0] ?? key) : key
// Map a generic /custom-fields def to the shape this editor renders (label + has_data)
// visible_in_ui defaults true (backend default) — worklist #44: API-only fields stay
// listed and editable here, they only stop rendering on the entity's Extra tab.
export const toField = (d: CustomFieldDef, lang: string): CustomField =>
  ({ ...d, label: pickLabel(d.label_i18n, lang, d.key), has_data: !!d.in_use, visible_in_ui: d.visible_in_ui !== false })

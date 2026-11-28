/**
 * workflowSeedNames (WORKFLOW-SEED-NAMES-TEMPLATE-KEY-FE-1): a workflow row resolves to its lookupSeeds key through the
 * template key or the seeded name in any seed language; a tenant's own name never does. Pinned through seedKeyFor and
 * translateSeedLabel, the entry points the render sites use.
 */
import { describe, it, expect } from 'vitest'
import { seedKeyFor, translateSeedLabel } from './lookupSeedI18n'
import { TEMPLATE_SEED_NAMES } from './workflowTemplateNames.generated'

const t = (key: string) => `T:${key}`
const known = { exists: () => true }
const recount = TEMPLATE_SEED_NAMES.vacancy_leads_recount

describe('seedKeyFor · workflowNames through the template key', () => {
  it('resolves a seeded row by its template key with the Dutch name (nl bureau, byte-identical path)', () => {
    expect(recount.nl).toBe('Leads-telling vacatures')
    expect(seedKeyFor('workflowNames', { value: 'vacancy_leads_recount', label: recount.nl })).toBe('vacancyLeadsCount')
  })

  it('resolves the same template when an English bureau stored the English seed name', () => {
    expect(seedKeyFor('workflowNames', { value: 'vacancy_leads_recount', label: recount.en })).toBe('vacancyLeadsCount')
    expect(seedKeyFor('workflowNames', { value: 'vacancy_leads_recount', label: ` ${recount.en.toUpperCase()} ` })).toBe('vacancyLeadsCount')
  })

  it('keeps a tenant rename as typed even when the template key is known (rename guard)', () => {
    expect(seedKeyFor('workflowNames', { value: 'vacancy_leads_recount', label: 'Onze leads-telling' })).toBeNull()
  })

  it('without a template key, matches the stored name in any seed language (runs, queue, older payloads)', () => {
    expect(seedKeyFor('workflowNames', { label: recount.en })).toBe('vacancyLeadsCount')
    expect(seedKeyFor('workflowNames', { value: null, label: TEMPLATE_SEED_NAMES.shiftmanager_push_employee_create.it })).toBe('shiftmanagerNewCandidate')
  })

  it('keeps the Dutch-label path for a hand-built catalogue entry that is not in the mirror', () => {
    expect(TEMPLATE_SEED_NAMES.koios_send_whatsapp).toBeUndefined()
    expect(seedKeyFor('workflowNames', { label: 'Koios: verstuur WhatsApp' })).toBe('koiosSendWhatsApp')
  })

  it('treats an Object prototype member as an unknown key and never borrows another template through a known key', () => {
    expect(seedKeyFor('workflowNames', { value: 'constructor', label: 'Onze eigen automatisering' })).toBeNull()
    expect(seedKeyFor('workflowNames', { value: 'toString', label: recount.en })).toBe('vacancyLeadsCount')
    // 'Reactivation' is another template's English seed name: under this key it is a rename (the en path stays raw).
    expect(seedKeyFor('workflowNames', { value: 'vacancy_leads_recount', label: 'Reactivation' })).toBeNull()
  })

  it('returns null for a bureau-built workflow (no template key, own name)', () => {
    expect(seedKeyFor('workflowNames', { value: null, label: 'Onze eigen automatisering' })).toBeNull()
    expect(seedKeyFor('workflowNames', { value: 'no_such_template', label: 'Onze eigen automatisering' })).toBeNull()
  })

  it('resolves the OpenCage geocoding templates that never matched before (comma label vs the seeded em dash)', () => {
    expect(seedKeyFor('workflowNames', { value: 'candidate_geocode_bulk', label: 'Adressen geocoderen — bulk (OpenCage)' })).toBe('geocodeAddressesBulkOpenCage')
    expect(seedKeyFor('workflowNames', { label: 'Adres geocoderen (OpenCage)' })).toBe('geocodeAddressOpenCage')
  })

  it('gives the reworded "Match loopt af — melding eigenaar(s)" its own key and keeps the old wording translatable', () => {
    expect(seedKeyFor('workflowNames', { value: 'match_expiring_notify_candidate_owner', label: 'Match loopt af — melding eigenaar(s)' })).toBe('matchExpiringOwnerNotification')
    expect(seedKeyFor('workflowNames', { label: 'Match loopt af — melding eigenaar kandidaat' })).toBe('matchExpiringNotifyCandidateOwner')
  })
})

describe('translateSeedLabel · workflowNames', () => {
  it('translates an English-stored seed name for a user in another language, and passes a renamed one through', () => {
    expect(translateSeedLabel(t, 'workflowNames', { value: 'vacancy_leads_recount', label: recount.en }, known)).toBe('T:lookupSeeds.workflowNames.vacancyLeadsCount')
    expect(translateSeedLabel(t, 'workflowNames', { value: 'vacancy_leads_recount', label: 'Onze leads-telling' }, known)).toBe('Onze leads-telling')
  })
})

import { describe, it, expect } from 'vitest'
import { mapCandidate } from './mapCandidate'

describe('mapCandidate — name', () => {
  it('prefers name, falls back to full_name, first/last, then ?', () => {
    expect(mapCandidate({ name: 'A B' }).name).toBe('A B')
    expect(mapCandidate({ full_name: 'C D' }).name).toBe('C D')
    expect(mapCandidate({ first_name: 'E', last_name: 'F' }).name).toBe('E F')
    expect(mapCandidate({ firstname: 'G', lastname: 'H' }).name).toBe('G H')
    expect(mapCandidate({}).name).toBe('?')
  })
})

describe('mapCandidate — candidateTypes (multi-value)', () => {
  it('keeps an array', () => {
    expect(mapCandidate({ candidate_types: ['on_call', 'freelance'] }).candidateTypes).toEqual(['on_call', 'freelance'])
  })
  it('wraps a single legacy field as an array', () => {
    expect(mapCandidate({ candidate_type: 'payroll' }).candidateTypes).toEqual(['payroll'])
  })
  it('normalises objects to value/id/name and drops falsy results', () => {
    // Note: a raw `null` item would crash (typeof null === 'object') — unrealistic
    // from the API, but a latent robustness gap in mapCandidate's normaliser.
    expect(mapCandidate({ candidate_types: [{ value: 'on_call' }, { id: 'x' }, { value: null }] }).candidateTypes)
      .toEqual(['on_call', 'x'])
  })
  it('defaults to an empty array', () => {
    expect(mapCandidate({}).candidateTypes).toEqual([])
  })
})

describe('mapCandidate — funnel flat fields (regression)', () => {
  it('maps funnel_type/label/color → stage/stageLabel/stageColor', () => {
    const r = mapCandidate({ funnel_type: 'hired', funnel_label: 'Aangenomen', funnel_color: '#16A34A' })
    expect(r.stage).toBe('hired')
    expect(r.stageLabel).toBe('Aangenomen')
    expect(r.stageColor).toBe('#16A34A')
  })
  it('null label/color when not in a procedure', () => {
    const r = mapCandidate({})
    expect(r.stage).toBe('')
    expect(r.stageLabel).toBeNull()
    expect(r.stageColor).toBeNull()
  })
})

describe('mapCandidate — owner', () => {
  it('reads the nested owner object', () => {
    const r = mapCandidate({ owner: { id: 7, name: 'Bente de Jong' } })
    expect(r.owner).toBe('Bente de Jong')
    expect(r.ownerId).toBe(7)
    expect(r.ownerInitials).toBe('BD')
  })
  it('falls back to flat owner_id / owner_name', () => {
    const r = mapCandidate({ owner_id: 3, owner_name: 'Kelly' })
    expect(r.owner).toBe('Kelly')
    expect(r.ownerId).toBe(3)
  })
})

describe('mapCandidate — documents size', () => {
  it('formats numeric bytes', () => {
    expect(mapCandidate({ documents: [{ name: 'cv.pdf', size: 44856 }] }).documents[0].size).toBe('44 KB')
    expect(mapCandidate({ documents: [{ size: 500 }] }).documents[0].size).toBe('500 B')
  })
  it('passes through an already-formatted string', () => {
    expect(mapCandidate({ documents: [{ size: '2.5 MB' }] }).documents[0].size).toBe('2.5 MB')
  })
})

describe('mapCandidate — relations newest-first', () => {
  it('sorts experiences newest first, current on top', () => {
    const r = mapCandidate({ experiences: [
      { id: 1, start_date: '2020-01-01', end_date: '2021-01-01' },
      { id: 2, start_date: '2022-01-01', current: true },
      { id: 3, start_date: '2019-01-01', end_date: '2019-06-01' },
    ] })
    expect(r.experiences.map(e => e.id)).toEqual([2, 1, 3])
  })
})

describe('mapCandidate — phone / mobile split (BE 2026-07-20)', () => {
  it('maps phone and mobile as independent fields (no more merging)', () => {
    const r = mapCandidate({ phone: '0301234567', mobile: '0612345678' })
    expect(r.phone).toBe('0301234567')
    expect(r.mobile).toBe('0612345678')
  })
  it('defaults each to "-" independently when absent (mobile no longer falls back into phone)', () => {
    expect(mapCandidate({ phone: '0301234567' }).mobile).toBe('-')
    expect(mapCandidate({ mobile: '0612345678' }).phone).toBe('-')
    expect(mapCandidate({}).phone).toBe('-')
    expect(mapCandidate({}).mobile).toBe('-')
  })
})

describe('mapCandidate — pools / consent / address', () => {
  it('normalises pools (object passthrough, string → {name})', () => {
    expect(mapCandidate({ pools: [{ id: 1, name: 'Zorg' }, 'Flex'] }).pools)
      .toEqual([{ id: 1, name: 'Zorg' }, { name: 'Flex' }])
  })
  it('consent: wa/email default opt-in, newsletter opt-out; reads nested consent', () => {
    expect(mapCandidate({}).consent.whatsapp_opt_in).toBe(true)
    expect(mapCandidate({}).consent.email_opt_in).toBe(true)
    expect(mapCandidate({}).consent.newsletter_opt_in).toBe(false)
    expect(mapCandidate({ consent: { whatsapp_opt_in: false } }).consent.whatsapp_opt_in).toBe(false)
  })
  it('composes address from street+city, else address/city/-', () => {
    expect(mapCandidate({ street: 'Hoofdstraat 1', city: 'Utrecht' }).address).toBe('Hoofdstraat 1, Utrecht')
    expect(mapCandidate({ address: 'Amsterdam' }).address).toBe('Amsterdam')
    expect(mapCandidate({}).address).toBe('-')
  })
})

// AVG-RET-2 (Danny 22-07 punt 8): the retention deadline is derived server-side
// and comes back on GET /candidates/{id} — verify the mapper reads both the
// top-level retention_expires_at and the nested consent.retention_* pair, with
// defensive null-safety when the backend omits them (older payloads/dummy data).
describe('mapCandidate — retention (AVG-RET-2)', () => {
  it('maps the top-level retention deadline', () => {
    expect(mapCandidate({ retention_expires_at: '2027-01-01T00:00:00.000Z' }).retentionExpiresAt)
      .toBe('2027-01-01T00:00:00.000Z')
  })
  it('is null when the backend does not send a deadline', () => {
    expect(mapCandidate({}).retentionExpiresAt).toBeNull()
  })
  it('maps the nested consent.retention_opt_in / retention_consent_at pair', () => {
    const r = mapCandidate({ consent: { retention_opt_in: true, retention_consent_at: '2026-05-01T00:00:00.000Z' } })
    expect(r.consent.retentionOptIn).toBe(true)
    expect(r.consent.retentionConsentAt).toBe('2026-05-01T00:00:00.000Z')
  })
  it('defaults retentionOptIn to false and retentionConsentAt to null when absent', () => {
    const r = mapCandidate({})
    expect(r.consent.retentionOptIn).toBe(false)
    expect(r.consent.retentionConsentAt).toBeNull()
  })
})

// KOPPELINGEN-META-1 (backend commit 0375fa9): backoffice_links[] now carries
// linked_at/linked_by per system alongside the existing sync state — verify both
// shiftmanagerLink and helloflexLink resolve symmetrically from the same array.
describe('mapCandidate — backoffice links (KOPPELINGEN-META-1)', () => {
  it('maps a linked Shiftmanager entry, including linked_at/linked_by', () => {
    const r = mapCandidate({
      backoffice_links: [
        {
          system: 'shiftmanager', status: 'linked', external_id: '428',
          last_synced_at: '2026-07-18T09:00:00Z',
          linked_at: '2026-07-10T08:00:00Z', linked_by: { id: 7, name: 'Bente de Jong' },
        },
      ],
    })
    expect(r.shiftmanagerLink).toEqual({
      status: 'linked', externalId: '428', lastError: null, lastSyncedAt: '2026-07-18T09:00:00Z',
      linkedAt: '2026-07-10T08:00:00Z', linkedBy: { id: 7, name: 'Bente de Jong' },
    })
  })

  it('maps a failed HelloFlex entry with last_error and a null linked_by', () => {
    const r = mapCandidate({
      backoffice_links: [
        {
          system: 'helloflex', status: 'failed', external_id: null,
          last_error: 'HelloFlex-credentials ontbreken (Settings → Integraties)',
          linked_at: null, linked_by: null,
        },
      ],
    })
    expect(r.helloflexLink).toEqual({
      status: 'failed', externalId: null,
      lastError: 'HelloFlex-credentials ontbreken (Settings → Integraties)',
      lastSyncedAt: null, linkedAt: null, linkedBy: null,
    })
  })

  it('is null for a system the tenant never attempted', () => {
    const r = mapCandidate({ backoffice_links: [{ system: 'shiftmanager', status: 'linked', external_id: '1' }] })
    expect(r.helloflexLink).toBeNull()
  })

  it('is null for both systems when backoffice_links is absent', () => {
    const r = mapCandidate({})
    expect(r.shiftmanagerLink).toBeNull()
    expect(r.helloflexLink).toBeNull()
  })
})

// CREATED-BY-SOURCE-1 (Danny: "wil ik ook zien aangemaakt door wie en de bron") —
// the Statistieken tab needs both fields; verify the mapper actually forwards them.
describe('mapCandidate — createdBy / source (CREATED-BY-SOURCE-1)', () => {
  it('maps the created_by {id,name} object', () => {
    const r = mapCandidate({ created_by: { id: 7, name: 'Bente de Jong' } })
    expect(r.createdBy).toEqual({ id: 7, name: 'Bente de Jong' })
  })
  it('is null on a legacy row without a stamped creator', () => {
    expect(mapCandidate({}).createdBy).toBeNull()
  })
  it('maps the acquisition source', () => {
    expect(mapCandidate({ source: 'indeed' }).source).toBe('indeed')
  })
  it('is null when no source was recorded', () => {
    expect(mapCandidate({}).source).toBeNull()
  })
})

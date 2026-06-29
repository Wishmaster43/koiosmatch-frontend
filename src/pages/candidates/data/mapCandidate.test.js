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

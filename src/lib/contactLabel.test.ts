/**
 * contactLabel — the ONE shared "Name — Function" label builder every contact
 * picker uses (candidate match, opportunity, vacancy, propose, merge). Covers
 * the two subtleties that matter: the function key varies by response shape,
 * and a customer contact mapped through mapCustomer.ts carries it as `role`
 * instead of `function` — missing that key silently renders no function at
 * all on every screen built on the mapped Customer model.
 */
import { describe, it, expect } from 'vitest'
import { contactFunctionOf, contactOptionLabel } from './contactLabel'

describe('contactFunctionOf', () => {
  it('reads the function under whichever key the response used', () => {
    expect(contactFunctionOf({ function: 'HR Manager' })).toBe('HR Manager')
    expect(contactFunctionOf({ function_title: 'Recruiter' })).toBe('Recruiter')
    expect(contactFunctionOf({ position: 'Manager' })).toBe('Manager')
    expect(contactFunctionOf({ job_title: 'Directeur' })).toBe('Directeur')
  })

  // THE TRAP: mapCustomer.ts normalises a customer contact's function to
  // `role` (src/types/customer.ts:29) — the chain must read it too, or every
  // screen built on the mapped Customer model (e.g. MergeContactModal) renders
  // an empty function on data that actually has one.
  it('reads `role` — the key customer contacts are normalised to (mapCustomer.ts)', () => {
    expect(contactFunctionOf({ role: 'Teamleider' })).toBe('Teamleider')
  })

  it('returns an empty string when none of the keys are present', () => {
    expect(contactFunctionOf({})).toBe('')
  })
})

describe('contactOptionLabel', () => {
  it('appends the function with the house " — " separator', () => {
    expect(contactOptionLabel({ name: 'Eva Bos', function: 'HR Manager' })).toBe('Eva Bos — HR Manager')
  })

  it('never leaves a dangling separator when the function is absent', () => {
    expect(contactOptionLabel({ name: 'Eva Bos' })).toBe('Eva Bos')
  })

  it('labels via `role` exactly like the other function keys', () => {
    expect(contactOptionLabel({ name: 'Sanne Vos', role: 'Teamleider' })).toBe('Sanne Vos — Teamleider')
  })

  it('falls back to the dash placeholder when even the name is missing', () => {
    expect(contactOptionLabel({})).toBe('—')
  })
})

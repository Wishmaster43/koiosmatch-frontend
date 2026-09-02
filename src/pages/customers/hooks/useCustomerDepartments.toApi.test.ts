/**
 * useCustomerDepartments.toApi — the ONE camelCase → wire mapping every department
 * create/update rides. K-249 C.4 added billing_email next to cost_center (the match
 * billing resolver reads a department's own billing_email); §13: pin the wire key.
 */
import { describe, it, expect } from 'vitest'
import { toApi } from './useCustomerDepartments'

describe('useCustomerDepartments.toApi', () => {
  it('maps billingEmail and costCenter to their snake_case wire keys', () => {
    expect(toApi({ costCenter: 'CC-12', billingEmail: 'ap@klant.nl' })).toEqual({ cost_center: 'CC-12', billing_email: 'ap@klant.nl' })
  })

  it('omits keys that were not supplied (a partial PATCH never nulls untouched fields)', () => {
    expect(toApi({ name: 'OK' })).toEqual({ name: 'OK' })
  })
})

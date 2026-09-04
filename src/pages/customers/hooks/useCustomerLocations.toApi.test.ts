/**
 * useCustomerLocations.toApi — the ONE camelCase → wire mapping every location
 * create/update rides (mirrors useCustomerDepartments.toApi.test.ts). K-283 added
 * branch_id — the location's OWN single branch, a DIFFERENT wire key than the
 * existing branch_ids (LOCATIE-VESTIGING-1's multi-branch visibility set).
 */
import { describe, it, expect } from 'vitest'
import { toApi } from './useCustomerLocations'

describe('useCustomerLocations.toApi · branch_id (K-283)', () => {
  it('maps a picked branchId to branch_id', () => {
    expect(toApi({ branchId: 'br-2' })).toEqual({ branch_id: 'br-2' })
  })

  it('maps an explicit null branchId to branch_id: null (the clear affordance)', () => {
    expect(toApi({ branchId: null })).toEqual({ branch_id: null })
  })

  it('omits branch_id entirely when branchId was not supplied (a partial PATCH never nulls it)', () => {
    expect(toApi({ name: 'OK' })).toEqual({ name: 'OK' })
  })

  it('stays independent of branch_ids (LOCATIE-VESTIGING-1) — both keys travel together when both are set', () => {
    expect(toApi({ branchId: 'br-2', branchIds: ['br-1', 'br-3'] })).toEqual({ branch_id: 'br-2', branch_ids: ['br-1', 'br-3'] })
  })
})

/**
 * useCascadeDefaults — covers the two DIFFERENT takeover-default rules (Danny
 * 2026-07-22): cost-centre follows the customer→location→department cascade's
 * deepest picked level, while billing email is ALWAYS the customer's own address,
 * regardless of which location/department is picked. Both freeze on manual edit.
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCascadeDefaults } from './useCascadeDefaults'
import type { CustomerCascadeDetail } from '@/hooks/useCustomerCascade'

// One customer with its own cost-centre/billing-email, a location that overrides
// only cost-centre, and a department that overrides cost-centre one level deeper.
const detail: CustomerCascadeDetail = {
  cost_center: 'KP-KLANT', billing_email: 'facturatie@klant.nl',
  locations: [{
    id: 'loc-1', name: 'Locatie Noord', cost_center: 'KP-LOCATIE', billing_email: 'loc@klant.nl',
    departments: [{ id: 'dep-1', name: 'Afdeling A', cost_center: 'KP-AFDELING' }],
  }],
}

describe('useCascadeDefaults · customer only picked', () => {
  it('proposes cost-centre AND billing email from the customer', () => {
    const { result } = renderHook(() => useCascadeDefaults({ detail, locationId: '', departmentId: '' }))
    expect(result.current.costCenter).toBe('KP-KLANT')
    expect(result.current.billingEmails).toEqual(['facturatie@klant.nl'])
  })
})

describe('useCascadeDefaults · location picked', () => {
  it('proposes cost-centre from the LOCATION, but billing email STILL from the customer', () => {
    const { result } = renderHook(() => useCascadeDefaults({ detail, locationId: 'loc-1', departmentId: '' }))
    expect(result.current.costCenter).toBe('KP-LOCATIE')
    // Billing never cascades — the location's own billing_email ('loc@klant.nl') must NOT be used.
    expect(result.current.billingEmails).toEqual(['facturatie@klant.nl'])
  })
})

describe('useCascadeDefaults · department picked', () => {
  it('proposes cost-centre from the DEPARTMENT, billing email still from the customer', () => {
    const { result } = renderHook(() => useCascadeDefaults({ detail, locationId: 'loc-1', departmentId: 'dep-1' }))
    expect(result.current.costCenter).toBe('KP-AFDELING')
    expect(result.current.billingEmails).toEqual(['facturatie@klant.nl'])
  })
})

describe('useCascadeDefaults · freeze-on-edit', () => {
  it('stops recomputing cost-centre once the recruiter marks it dirty', () => {
    const { result, rerender } = renderHook(
      (props: { locationId: string; departmentId: string }) => useCascadeDefaults({ detail, ...props }),
      { initialProps: { locationId: '', departmentId: '' } },
    )
    expect(result.current.costCenter).toBe('KP-KLANT')
    act(() => result.current.setCostCenterDirty(true))
    rerender({ locationId: 'loc-1', departmentId: '' })
    // Picking a location after a manual edit must NOT overwrite the frozen value.
    expect(result.current.costCenter).toBe('KP-KLANT')
  })

  it('stops recomputing billing email once the recruiter marks it dirty', () => {
    const { result, rerender } = renderHook(
      (props: { locationId: string; departmentId: string }) => useCascadeDefaults({ detail, ...props }),
      { initialProps: { locationId: '', departmentId: '' } },
    )
    expect(result.current.billingEmails).toEqual(['facturatie@klant.nl'])
    act(() => { result.current.setBillingDirty(true); result.current.setBillingEmails(['handmatig@klant.nl']) })
    rerender({ locationId: 'loc-1', departmentId: 'dep-1' })
    // A manual billing-email edit must survive a later location/department pick.
    expect(result.current.billingEmails).toEqual(['handmatig@klant.nl'])
  })
})

describe('useCascadeDefaults · no customer picked', () => {
  it('proposes empty strings when detail is null', () => {
    const { result } = renderHook(() => useCascadeDefaults({ detail: null, locationId: '', departmentId: '' }))
    expect(result.current.costCenter).toBe('')
    expect(result.current.billingEmails).toEqual([''])
  })
})

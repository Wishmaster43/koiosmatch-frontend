/**
 * useRequiredFields — the create modal marks exactly the fields the tenant made required,
 * on the COLUMN keys the settings screen stores (postcode, linkedin_slug) and on the
 * legacy keys an older tenant may still carry (postal_code, linkedin, summary).
 */
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useRequiredFields } from './useRequiredFields'

const stored: Record<string, unknown> = {}
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getJsonSetting: (_s: unknown, _k: string, fallback: unknown) => stored.candidate_required_fields ?? fallback,
}))

describe('useRequiredFields', () => {
  it('maps the stored column keys onto the form fields', () => {
    stored.candidate_required_fields = { lead: ['first_name', 'postcode', 'linkedin_slug', 'mobile', 'address_line_2'] }
    const { result } = renderHook(() => useRequiredFields('lead'))
    expect(result.current.isReq('postalCode')).toBe(true)
    expect(result.current.isReq('linkedin')).toBe(true)
    expect(result.current.isReq('mobile')).toBe(true)
    expect(result.current.isReq('addressLine2')).toBe(true)
    expect(result.current.isReq('city')).toBe(false)
  })

  it('folds the legacy keys a tenant may still have stored', () => {
    stored.candidate_required_fields = { candidate: ['postal_code', 'linkedin', 'summary'] }
    const { result } = renderHook(() => useRequiredFields('candidate'))
    expect(result.current.isReq('postalCode')).toBe(true)
    expect(result.current.isReq('linkedin')).toBe(true)
    expect(result.current.isReq('summary')).toBe(true)
  })

  it('falls back to the settings-mirrored defaults when nothing is stored', () => {
    delete stored.candidate_required_fields
    const { result } = renderHook(() => useRequiredFields('candidate'))
    expect(result.current.requiredForm).toEqual(['firstName', 'lastName', 'functionTitle'])
  })
})

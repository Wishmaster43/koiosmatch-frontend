/**
 * useVacancyDetailsForm · land→provincie cascade (Danny 22-07, punt 2): mirrors
 * the candidate ProfileTab/AddCandidateModal pattern — province options scope to
 * the picked country, and an already-filled province that no longer exists in
 * the new country's list is cleared rather than silently kept mismatched. Every
 * other dependency the hook wires in is stubbed so only this cascade is exercised
 * (mirrors DetailsTab.test.tsx's own isolation level, one layer down).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVacancyDetailsForm } from './useVacancyDetailsForm'
import type { VacancyDetail } from '@/types/vacancy'

vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: [], typeMeta: () => ({ label: '', color: '' }) }) }))
vi.mock('@/context/VacancyLookupsContext', () => ({ useVacancyLookups: () => ({ seniorityLevels: [], educationLevels: [] }) }))
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: [] }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: [] }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (d: string) => d }) }))
vi.mock('./useCustomerOptions', () => ({ useCustomerOptions: () => [] }))
vi.mock('./useCascadePickers', () => ({ useCascadePickers: () => ({ locationPicker: null, departmentPicker: null, contactPicker: null }) }))

// The country cascade itself: a per-country list (mirrors useProvinces' real
// per-country cache slots) without a real fetch, so the test can prove the hook
// re-scopes the province options when `form.country` changes.
const provincesByCountry: Record<string, string[]> = { NL: ['Utrecht', 'Zuid-Holland'], BE: ['Antwerpen'] }
vi.mock('@/hooks/useProvinces', () => ({
  useProvinces: (country: string) => ({ provinces: provincesByCountry[(country || 'NL').toUpperCase()] ?? [] }),
}))

// Minimal fixture — only the fields useVacancyDetailsForm actually reads.
const vacancy = (over: Partial<VacancyDetail> = {}): VacancyDetail => ({
  id: 'v1', country: 'NL', province: '',
  category: '', industry: '', street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '',
  experienceMin: '', experienceMax: '', seniorityValue: '', educationValue: '',
  salaryMin: '', salaryMax: '', hoursMin: '', hoursMax: '', startDate: '', endDate: '',
  clientId: null, clientName: '', contractTypes: [], skills: [],
  customerLocationId: '', customerLocationName: '', customerDepartmentId: '', customerDepartmentName: '',
  contactId: '', contactName: '',
  ...over,
} as unknown as VacancyDetail)

describe('useVacancyDetailsForm · province cascades on country', () => {
  it('scopes the province options to the seeded country', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ country: 'BE', province: 'Antwerpen' })))
    expect(result.current.provinces).toEqual(['Antwerpen'])
  })

  it('clears the picked province when it no longer exists in the new country\'s list', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ country: 'NL', province: 'Utrecht' })))
    expect(result.current.form.province).toBe('Utrecht')
    act(() => { result.current.setF('country', 'BE') })
    // 'Utrecht' isn't in BE's list — the reset effect must clear it, never leave a
    // mismatched country/province pair on the form.
    expect(result.current.form.country).toBe('BE')
    expect(result.current.form.province).toBe('')
  })

  it('keeps the province when it still exists in the new country\'s list', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ country: 'NL', province: 'Utrecht' })))
    act(() => { result.current.setF('country', 'NL') })
    expect(result.current.form.province).toBe('Utrecht')
  })

  it('the save patch carries both country and province', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ country: 'NL', province: 'Utrecht' }), onUpdate))
    act(() => { result.current.save() })
    expect(onUpdate).toHaveBeenCalledWith('v1', expect.objectContaining({ country: 'NL', province: 'Utrecht' }))
  })
})

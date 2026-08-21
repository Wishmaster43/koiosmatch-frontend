/**
 * useVacancyDetailsForm · VAC-DETAILS-SPLIT-1 (Danny 24-07): the hook now
 * returns FOUR independent sections (general/location/requirements/conditions)
 * instead of one shared editing/form pair — one pencil must never touch
 * another section's draft, and each section's Save must PATCH only its own
 * fields (asserted against `onUpdate`, mirroring how the real save reaches
 * `buildVacancyPatch`'s key-presence gating). Every other dependency the hook
 * wires in is stubbed so only the section logic under test is exercised.
 *
 * Also covers the land→provincie cascade (Danny 22-07, punt 2), now scoped to
 * the `location` section: province options scope to the picked country, and
 * an already-filled province that no longer exists in the new country's list
 * is cleared rather than silently kept mismatched.
 *
 * DRILLDOWN-VOLGORDE-CANON (Danny 21-08, VACATURES 1/3/4): the bureau branch
 * (vestiging) and the required-skills list both moved OUT of this hook — the
 * branch is now VacancyBranchBlock's own field (VacancyBranchBlock.test.tsx),
 * and skills now live in useVacancySkills (useVacancySkills.test.ts). Neither
 * is covered here any more.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVacancyDetailsForm } from './useVacancyDetailsForm'
import type { VacancyDetail } from '@/types/vacancy'

vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: [], typeMeta: () => ({ label: '', color: '' }) }) }))
vi.mock('@/context/VacancyLookupsContext', () => ({ useVacancyLookups: () => ({ seniorityLevels: [], educationLevels: [] }) }))
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: [] }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: [] }) }))
// VACANCY-CONTRACT-FIELD-1: the Voorwaarden sub-tab's own contract-type/CAO
// lookups — same tenant lookups the match's own ContractSection reads.
vi.mock('@/lib/useContractTypes', () => ({
  useContractTypes: () => ({ types: ['Bepaalde tijd'], options: [{ value: 'bepaalde_tijd', label: 'Bepaalde tijd', default_duration_days: null, is_default: false }] }),
}))
vi.mock('@/lib/useCao', () => ({
  useCao: () => ({ types: [{ value: 'vvt', label: 'CAO VVT' }], labelOf: (v: string) => v, colorOf: () => undefined }),
}))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (d: string) => d }) }))
vi.mock('./useCustomerOptions', () => ({ useCustomerOptions: () => [] }))
vi.mock('./useCascadePickers', () => ({ useCascadePickers: () => ({ locationPicker: null, departmentPicker: null, contactPicker: null }) }))

// The country cascade itself: a per-country list (mirrors useProvinces' real
// per-country cache slots) without a real fetch, so the test can prove the hook
// re-scopes the province options when `location.form.country` changes.
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
  // VACANCY-CONTRACT-FIELD-1: the Voorwaarden sub-tab's own singular fields.
  contractType: '', cao: '',
  clientId: null, clientName: '', contractTypes: [], skills: [],
  customerLocationId: '', customerLocationName: '', customerDepartmentId: '', customerDepartmentName: '',
  contactId: '', contactName: '',
  ...over,
} as unknown as VacancyDetail)

describe('useVacancyDetailsForm · location section · province cascades on country', () => {
  it('scopes the province options to the seeded country', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ country: 'BE', province: 'Antwerpen' })))
    expect(result.current.location.provinces).toEqual(['Antwerpen'])
  })

  it('clears the picked province when it no longer exists in the new country\'s list', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ country: 'NL', province: 'Utrecht' })))
    expect(result.current.location.form.province).toBe('Utrecht')
    act(() => { result.current.location.setF('country', 'BE') })
    // 'Utrecht' isn't in BE's list — the reset effect must clear it, never leave a
    // mismatched country/province pair on the form.
    expect(result.current.location.form.country).toBe('BE')
    expect(result.current.location.form.province).toBe('')
  })

  it('keeps the province when it still exists in the new country\'s list', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ country: 'NL', province: 'Utrecht' })))
    act(() => { result.current.location.setF('country', 'NL') })
    expect(result.current.location.form.province).toBe('Utrecht')
  })

  it('the location save patch carries ONLY country/province/address fields, never another section\'s', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ country: 'NL', province: 'Utrecht' }), onUpdate))
    act(() => { result.current.location.save() })
    expect(onUpdate).toHaveBeenCalledTimes(1)
    const [id, patch] = onUpdate.mock.calls[0]
    expect(id).toBe('v1')
    expect(patch).toEqual(expect.objectContaining({ country: 'NL', province: 'Utrecht' }))
    // Never leaks a sibling section's keys into this PATCH.
    expect(patch).not.toHaveProperty('salaryMin')
    expect(patch).not.toHaveProperty('experienceMin')
    expect(patch).not.toHaveProperty('contractTypes')
  })
})

describe('useVacancyDetailsForm · sections are independent (VAC-DETAILS-SPLIT-1)', () => {
  it('each section starts with its own editing flag, off by default', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy()))
    expect(result.current.general.editing).toBe(false)
    expect(result.current.location.editing).toBe(false)
    expect(result.current.requirements.editing).toBe(false)
    expect(result.current.conditions.editing).toBe(false)
  })

  it('opening one section\'s pencil never opens another\'s', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy()))
    act(() => { result.current.requirements.setEditing(true) })
    expect(result.current.requirements.editing).toBe(true)
    expect(result.current.general.editing).toBe(false)
    expect(result.current.location.editing).toBe(false)
    expect(result.current.conditions.editing).toBe(false)
  })

  it('editing one section\'s form field never touches another\'s draft', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ salaryMin: '100' })))
    act(() => { result.current.conditions.setF('salaryMin', '200') })
    expect(result.current.conditions.form.salaryMin).toBe('200')
    // Requirements/general/location form slices are untouched by the Voorwaarden edit.
    expect(result.current.requirements.form.experienceMin).toBe('')
    expect(result.current.general.form.category).toBe('')
  })

  it('general save PATCHes only Algemeen fields (contract type, dates, client, cascade, function, industry)', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ category: 'Verpleegkundige', startDate: '2026-01-01' }), onUpdate))
    act(() => { result.current.general.save() })
    const [, patch] = onUpdate.mock.calls[0]
    expect(patch).toEqual(expect.objectContaining({ category: 'Verpleegkundige', startDate: '2026-01-01', contractTypes: [] }))
    expect(patch).not.toHaveProperty('street')
    expect(patch).not.toHaveProperty('salaryMin')
    expect(patch).not.toHaveProperty('skills')
  })

  it('requirements save PATCHes experience/seniority/education, never salary/address/skills', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ experienceMin: '1', experienceMax: '3' }), onUpdate))
    act(() => { result.current.requirements.save() })
    const [, patch] = onUpdate.mock.calls[0]
    expect(patch).toEqual(expect.objectContaining({ experienceMin: '1', experienceMax: '3' }))
    expect(patch).not.toHaveProperty('salaryMin')
    expect(patch).not.toHaveProperty('street')
    // Skills moved to useVacancySkills (VACATURES 4) — this section never PATCHes them.
    expect(patch).not.toHaveProperty('skills')
  })

  it('conditions save PATCHes only salary/hours', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ salaryMin: '2000', salaryMax: '2500' }), onUpdate))
    act(() => { result.current.conditions.save() })
    const [, patch] = onUpdate.mock.calls[0]
    expect(patch).toEqual(expect.objectContaining({ salaryMin: '2000', salaryMax: '2500', salary: '2000 – 2500' }))
    expect(patch).not.toHaveProperty('experienceMin')
    expect(patch).not.toHaveProperty('category')
  })

  // VACANCY-CONTRACT-FIELD-1: the Voorwaarden sub-tab's own contract-type/CAO —
  // same fields the +Match modal proposes onto a new match (useVacancyPrefill).
  it('conditions save also PATCHes the vacancy\'s own contract type/CAO', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ contractType: '', cao: '' }), onUpdate))
    act(() => { result.current.conditions.setF('contractType', 'bepaalde_tijd') })
    act(() => { result.current.conditions.setF('cao', 'vvt') })
    act(() => { result.current.conditions.save() })
    const [id, patch] = onUpdate.mock.calls[0]
    expect(id).toBe('v1')
    expect(patch).toEqual(expect.objectContaining({ contractType: 'bepaalde_tijd', cao: 'vvt' }))
  })

  it('exposes the same tenant lookups the +Match modal reads (contractTypeOptions/caoOptions)', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy()))
    expect(result.current.contractTypeOptions).toEqual(expect.arrayContaining([expect.objectContaining({ value: 'bepaalde_tijd' })]))
    expect(result.current.caoOptions).toEqual(expect.arrayContaining([expect.objectContaining({ value: 'vvt' })]))
  })

  it('cancelling one section resets only its own form and closes only its own pencil', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ salaryMin: '100' })))
    act(() => { result.current.conditions.setEditing(true); result.current.requirements.setEditing(true) })
    act(() => { result.current.conditions.setF('salaryMin', '999') })
    act(() => { result.current.conditions.cancel() })
    expect(result.current.conditions.editing).toBe(false)
    expect(result.current.conditions.form.salaryMin).toBe('100')
    // The Requirements pencil, opened independently, stays open — cancelling
    // Conditions must not touch it.
    expect(result.current.requirements.editing).toBe(true)
  })
})

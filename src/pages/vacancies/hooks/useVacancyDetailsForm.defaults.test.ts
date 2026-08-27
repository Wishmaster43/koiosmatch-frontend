/**
 * useVacancyDetailsForm · DEFAULTS-1 (V11/V19): the tenant's flagged default
 * seniority/education is PROPOSED into an empty Eisen field when the pencil opens.
 *
 * This is the consumer that makes the Settings default-toggle real. Guard rails
 * asserted here: proposal only while editing, only into an EMPTY field (never
 * overwriting a vacancy the recruiter opened to edit), and nothing at all when the
 * tenant flagged no default. Own file so the mutable lookup stub never leaks into
 * useVacancyDetailsForm.test.ts's fixed one.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVacancyDetailsForm } from './useVacancyDetailsForm'
import type { VacancyDetail } from '@/types/vacancy'

// The one stub this file varies per test — the vacancy lookups + their defaults.
const lookups = {
  seniorityLevels: [] as Array<{ value: string; label: string }>,
  educationLevels: [] as Array<{ value: string; label: string }>,
  defaultSeniority: '',
  defaultEducation: '',
}

vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: [], typeMeta: () => ({ label: '', color: '' }) }) }))
vi.mock('@/context/VacancyLookupsContext', () => ({ useVacancyLookups: () => lookups }))
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: [] }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: [] }) }))
// VACANCY-CONTRACT-FIELD-1: not under test here, stubbed like every other lookup.
vi.mock('@/lib/useContractTypes', () => ({ useContractTypes: () => ({ types: [], options: [] }) }))
vi.mock('@/lib/useCao', () => ({ useCao: () => ({ types: [], labelOf: (v: string) => v, colorOf: () => undefined }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (d: string) => d }) }))
vi.mock('@/hooks/useCustomerOptions', () => ({ useCustomerOptions: () => [] }))
vi.mock('./useCascadePickers', () => ({ useCascadePickers: () => ({ locationPicker: null, departmentPicker: null, contactPicker: null }) }))
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: [] }) }))

// Minimal fixture — only the fields useVacancyDetailsForm actually reads.
const vacancy = (over: Partial<VacancyDetail> = {}): VacancyDetail => ({
  id: 'v1', country: 'NL', province: '',
  category: '', industry: '', street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '',
  experienceMin: '', experienceMax: '', seniorityValue: '', educationValue: '',
  salaryMin: '', salaryMax: '', hoursMin: '', hoursMax: '', startDate: '', endDate: '',
  contractType: '', cao: '',
  clientId: null, clientName: '', contractTypes: [], skills: [],
  customerLocationId: '', customerLocationName: '', customerDepartmentId: '', customerDepartmentName: '',
  contactId: '', contactName: '',
  ...over,
} as unknown as VacancyDetail)

beforeEach(() => {
  lookups.seniorityLevels = [{ value: 's1', label: 'Starter' }, { value: 's2', label: 'Medior' }]
  lookups.educationLevels = [{ value: 'e1', label: 'MBO' }, { value: 'e2', label: 'HBO' }]
  lookups.defaultSeniority = 's2'
  lookups.defaultEducation = 'e1'
})

describe('useVacancyDetailsForm · tenant default seniority/education proposal', () => {
  it('proposes the flagged defaults into empty fields when the Eisen pencil opens', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy()))
    // Closed pencil = read-only view: nothing is proposed into the draft yet.
    expect(result.current.requirements.form.seniority).toBe('')
    act(() => { result.current.requirements.setEditing(true) })
    expect(result.current.requirements.form.seniority).toBe('s2')
    expect(result.current.requirements.form.education).toBe('e1')
  })

  it('the proposal reaches the PATCH with its resolved label once saved', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy(), onUpdate))
    act(() => { result.current.requirements.setEditing(true) })
    act(() => { result.current.requirements.save() })
    const [id, patch] = onUpdate.mock.calls[0]
    expect(id).toBe('v1')
    expect(patch).toEqual(expect.objectContaining({
      seniorityValue: 's2', seniority: 'Medior', educationValue: 'e1', education: 'MBO',
    }))
  })

  it('never overwrites a value the vacancy already has', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy({ seniorityValue: 's1', educationValue: 'e2' })))
    act(() => { result.current.requirements.setEditing(true) })
    expect(result.current.requirements.form.seniority).toBe('s1')
    expect(result.current.requirements.form.education).toBe('e2')
  })

  it('proposes nothing when the tenant flagged no default', () => {
    lookups.defaultSeniority = ''
    lookups.defaultEducation = ''
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy()))
    act(() => { result.current.requirements.setEditing(true) })
    expect(result.current.requirements.form.seniority).toBe('')
    expect(result.current.requirements.form.education).toBe('')
  })

  it('re-clearing the field by hand while editing is not undone by the proposal', () => {
    const { result } = renderHook(() => useVacancyDetailsForm(vacancy()))
    act(() => { result.current.requirements.setEditing(true) })
    act(() => { result.current.requirements.setF('seniority', '') })
    expect(result.current.requirements.form.seniority).toBe('')
  })
})

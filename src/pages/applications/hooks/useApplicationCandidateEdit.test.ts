/**
 * useApplicationCandidateEdit — header candidate-edit hook coverage: startEdit
 * loads the SEPARATE name parts (never split from the joined display name),
 * saveEdit PATCHes exactly the four snake_case keys CandidateProfileRequest
 * validates, a Dutch tussenvoegsel round-trips intact, and a failing PATCH
 * keeps edit mode open (never silently looks like it succeeded).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useApplicationCandidateEdit } from './useApplicationCandidateEdit'

const get    = api.get    as unknown as ReturnType<typeof vi.fn>
const patch  = api.patch  as unknown as ReturnType<typeof vi.fn>
const notify = notifyError as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { get.mockReset(); patch.mockReset(); notify.mockClear() })

describe('useApplicationCandidateEdit · startEdit', () => {
  it('GETs the candidate and fills the form from the separate name parts', async () => {
    get.mockResolvedValue({ data: { first_name: 'Jan', middle_name: '', last_name: 'Jansen', function_title: 'Verpleegkundige' } })
    const r = renderHook(() => useApplicationCandidateEdit('c1'))
    act(() => { r.result.current.startEdit() })
    expect(r.result.current.editing).toBe(true)
    expect(r.result.current.loading).toBe(true)
    expect(get).toHaveBeenCalledWith('/candidates/c1')
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    expect(r.result.current.form).toEqual({ firstName: 'Jan', middleName: '', lastName: 'Jansen', functionTitle: 'Verpleegkundige' })
  })
})

describe('useApplicationCandidateEdit · saveEdit', () => {
  it('PATCHes exactly the four snake_case keys with the values from the form', async () => {
    get.mockResolvedValue({ data: { first_name: 'Jan', middle_name: '', last_name: 'Jansen', function_title: 'Verpleegkundige' } })
    patch.mockResolvedValue({})
    const onSaved = vi.fn()
    const r = renderHook(() => useApplicationCandidateEdit('c1', onSaved))
    act(() => { r.result.current.startEdit() })
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    act(() => { r.result.current.setField('functionTitle', 'Wijkverpleegkundige') })
    await act(async () => { await r.result.current.saveEdit() })
    expect(patch).toHaveBeenCalledWith('/candidates/c1', {
      first_name: 'Jan', middle_name: '', last_name: 'Jansen', function_title: 'Wijkverpleegkundige',
    })
    expect(onSaved).toHaveBeenCalledWith('c1', { candidateName: 'Jan Jansen', candidateFunction: 'Wijkverpleegkundige' })
    expect(r.result.current.editing).toBe(false)
  })

  it('a Dutch tussenvoegsel survives the round trip', async () => {
    get.mockResolvedValue({ data: { first_name: 'Isa', middle_name: 'van der', last_name: 'Groen', function_title: '' } })
    patch.mockResolvedValue({})
    const onSaved = vi.fn()
    const r = renderHook(() => useApplicationCandidateEdit('c1', onSaved))
    act(() => { r.result.current.startEdit() })
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    expect(r.result.current.form.middleName).toBe('van der')
    await act(async () => { await r.result.current.saveEdit() })
    expect(patch).toHaveBeenCalledWith('/candidates/c1', {
      first_name: 'Isa', middle_name: 'van der', last_name: 'Groen', function_title: '',
    })
    expect(onSaved).toHaveBeenCalledWith('c1', { candidateName: 'Isa van der Groen', candidateFunction: '' })
  })

  it('keeps editing true and never claims success when the PATCH fails', async () => {
    get.mockResolvedValue({ data: { first_name: 'Jan', middle_name: '', last_name: 'Jansen', function_title: '' } })
    patch.mockRejectedValue(new Error('500'))
    const onSaved = vi.fn()
    const r = renderHook(() => useApplicationCandidateEdit('c1', onSaved))
    act(() => { r.result.current.startEdit() })
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    await act(async () => { await r.result.current.saveEdit() })
    expect(r.result.current.editing).toBe(true)
    expect(onSaved).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalled()
  })
})

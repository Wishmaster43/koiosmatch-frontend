/**
 * useApplicationCandidateEdit — header candidate-edit hook coverage: startEdit
 * loads the SEPARATE name parts (never split from the joined display name),
 * saveEdit PATCHes exactly the four snake_case keys CandidateProfileRequest
 * validates, a Dutch tussenvoegsel round-trips intact, a failing PATCH keeps
 * edit mode open (never silently looks like it succeeded), and a successful
 * save reconciles the candidates + applications caches (REFRESH-FIX-2).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

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

// The hook now reads useQueryClient() to invalidate on save (REFRESH-FIX-2) —
// every renderHook needs a provider; `client` is exposed so a test can spy on
// invalidateQueries directly.
let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children)

beforeEach(() => {
  get.mockReset(); patch.mockReset(); notify.mockClear()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

describe('useApplicationCandidateEdit · startEdit', () => {
  it('GETs the candidate and fills the form from the separate name parts', async () => {
    get.mockResolvedValue({ data: { first_name: 'Jan', middle_name: '', last_name: 'Jansen', function_title: 'Verpleegkundige' } })
    const r = renderHook(() => useApplicationCandidateEdit('c1'), { wrapper })
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
    const r = renderHook(() => useApplicationCandidateEdit('c1', onSaved), { wrapper })
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

  // REFRESH-FIX-2 addendum: the PATCH response carries the server-composed,
  // infix-aware name (CandidateListResource's full_name) — it must win over the
  // hook's own plain-space local join, which can disagree on tussenvoegsel formatting.
  it('prefers the server-composed name from the PATCH response over the local join', async () => {
    get.mockResolvedValue({ data: { first_name: 'Daan', middle_name: 'van', last_name: 'Leeuwen', function_title: '' } })
    patch.mockResolvedValue({ data: { name: 'Daan van Leeuwen' } })
    const onSaved = vi.fn()
    const r = renderHook(() => useApplicationCandidateEdit('c1', onSaved), { wrapper })
    act(() => { r.result.current.startEdit() })
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    await act(async () => { await r.result.current.saveEdit() })
    expect(onSaved).toHaveBeenCalledWith('c1', { candidateName: 'Daan van Leeuwen', candidateFunction: '' })
  })

  // When the response carries no name at all, fall back to the local join —
  // never leave candidateName blank.
  it('falls back to the local join when the PATCH response carries no name', async () => {
    get.mockResolvedValue({ data: { first_name: 'Jan', middle_name: '', last_name: 'Jansen', function_title: '' } })
    patch.mockResolvedValue({ data: {} })
    const onSaved = vi.fn()
    const r = renderHook(() => useApplicationCandidateEdit('c1', onSaved), { wrapper })
    act(() => { r.result.current.startEdit() })
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    await act(async () => { await r.result.current.saveEdit() })
    expect(onSaved).toHaveBeenCalledWith('c1', { candidateName: 'Jan Jansen', candidateFunction: '' })
  })

  // REFRESH-FIX-2: a successful save reconciles BOTH caches — the candidate
  // drawer's own view and every application row that denormalises this name.
  it('invalidates the candidates and applications caches on a successful save', async () => {
    get.mockResolvedValue({ data: { first_name: 'Jan', middle_name: '', last_name: 'Jansen', function_title: '' } })
    patch.mockResolvedValue({})
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const r = renderHook(() => useApplicationCandidateEdit('c1'), { wrapper })
    act(() => { r.result.current.startEdit() })
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    await act(async () => { await r.result.current.saveEdit() })
    // One predicate-scoped call (candidates + applications, never their stats
    // branches — the exact scope is pinned in lib/invalidateEntity.test.ts).
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    const predicate = (invalidateSpy.mock.calls[0][0] as unknown as { predicate: (q: { queryKey: unknown[] }) => boolean }).predicate
    expect(predicate({ queryKey: ['candidates', 'x'] })).toBe(true)
    expect(predicate({ queryKey: ['applications', 'stats', {}] })).toBe(false)
  })

  // A failed save must never reconcile caches with a name the server rejected.
  it('never invalidates when the PATCH fails', async () => {
    get.mockResolvedValue({ data: { first_name: 'Jan', middle_name: '', last_name: 'Jansen', function_title: '' } })
    patch.mockRejectedValue(new Error('500'))
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const r = renderHook(() => useApplicationCandidateEdit('c1'), { wrapper })
    act(() => { r.result.current.startEdit() })
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    await act(async () => { await r.result.current.saveEdit() })
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('a Dutch tussenvoegsel survives the round trip', async () => {
    get.mockResolvedValue({ data: { first_name: 'Isa', middle_name: 'van der', last_name: 'Groen', function_title: '' } })
    patch.mockResolvedValue({})
    const onSaved = vi.fn()
    const r = renderHook(() => useApplicationCandidateEdit('c1', onSaved), { wrapper })
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
    const r = renderHook(() => useApplicationCandidateEdit('c1', onSaved), { wrapper })
    act(() => { r.result.current.startEdit() })
    await waitFor(() => expect(r.result.current.loading).toBe(false))
    await act(async () => { await r.result.current.saveEdit() })
    expect(r.result.current.editing).toBe(true)
    expect(onSaved).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalled()
  })
})

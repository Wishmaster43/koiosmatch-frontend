/**
 * useOpportunityNotes — regression coverage for the optimistic-update bug class
 * (measured audit 2026-07-27): addNote used to `.then(load).catch(() => {})` — no
 * optimistic write and a fully swallowed error, so a rejected POST left no trace on
 * screen and no message; a recruiter had every reason to believe the note was
 * recorded and would not re-type it. Fixed to mirror the proven
 * useCandidateNotes.addNote pattern: optimistic prepend with a temp id, then reload
 * on success, and on failure remove that exact temp note + surface the server's own
 * message. Assert the SEAM (§13): the exact POST body, the optimistic write, and
 * the revert + notify on rejection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOpportunityNotes } from './useOpportunityNotes'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// Minimal i18n stub (mirrors useWorkflowsData.test.ts) — the hook now calls
// useTranslation() directly to resolve the fallback error message.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

const mockedGet  = vi.mocked(api.get)
const mockedPost = vi.mocked(api.post)

beforeEach(() => { vi.clearAllMocks(); mockedGet.mockResolvedValue({ data: [] }) })

describe('useOpportunityNotes · addNote', () => {
  it('POSTs the payload, shows the note optimistically, then reloads on success', async () => {
    mockedPost.mockResolvedValue({})
    const { result } = renderHook(() => useOpportunityNotes('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.addNote({ type: 'internal', body: 'Klant gebeld' }) })
    expect(mockedPost).toHaveBeenCalledWith('/opportunities/o1/notes', { type: 'internal', body: 'Klant gebeld' })
    expect(result.current.items).toHaveLength(1) // optimistic
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2)) // reload after success
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('removes the failed note and surfaces the server message — never leaves a fake-saved note', async () => {
    mockedPost.mockRejectedValue({ response: { status: 500, data: { message: 'Server kon de notitie niet opslaan' } } })
    const { result } = renderHook(() => useOpportunityNotes('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.addNote({ type: 'internal', body: 'Zou verloren gaan' }) })
    expect(result.current.items).toHaveLength(1) // optimistic
    await waitFor(() => expect(result.current.items).toHaveLength(0)) // reverted — no fake trace
    expect(notifyError).toHaveBeenCalledWith('Server kon de notitie niet opslaan')
  })

  it('is a no-op for an empty body — never POSTs blank whitespace', async () => {
    const { result } = renderHook(() => useOpportunityNotes('o1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.addNote({ type: 'internal', body: '   ' }) })
    expect(mockedPost).not.toHaveBeenCalled()
  })
})

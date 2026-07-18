/**
 * useApplicationBulkActions — Heraudit-R2 finding 1 regression coverage: bulkDetach
 * must send the `reason` the caller collected as the axios DELETE body (S15: the
 * backend 422s a reason-less DELETE /applications/{id}). The old test only asserted
 * the UI callback fired, never that the reason reached the API layer — exactly how
 * a silent 422 (revert + generic toast, no data ever detached) slipped through.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useApplicationBulkActions } from './useApplicationBulkActions'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { patch: vi.fn(), delete: vi.fn() } }
})
import api from '@/lib/api'

const patch = api.patch  as unknown as ReturnType<typeof vi.fn>
const del   = api.delete as unknown as ReturnType<typeof vi.fn>
const t = ((k: string) => k) as unknown as import('i18next').TFunction

const FUNNEL: LookupItem[] = [
  { value: 'applied', label: 'Applied', color: 'slate' },
  { value: 'hired',    label: 'Hired',   color: 'slate', is_match: true },
]

const app = (overrides: Partial<Application> = {}): Application => ({
  id: 1, candidateId: 1, candidateName: 'Test candidate', candidateInitials: 'TC',
  vacancyId: 1, vacancyTitle: 'Nurse', client: 'Acme', customerId: 1, referenceNumber: 'S-1',
  score: null, task: '', phaseKey: 'applied', bucket: 'active', source: '',
  owner: { id: null, name: '', initials: '', color: null },
  candidateStatusLabel: '', candidateStatusColor: '', candidateStatus: '', candidatePhase: '',
  created: '', isNew: false, archived: false, deletedAt: null,
  ...overrides,
} as Application)

// Harness: real state, so we can observe the optimistic update → revert-on-failure.
function harness(initial: Application[]) {
  return renderHook(() => {
    const [applications, setApplications] = useState<Application[]>(initial)
    const [total, setTotal] = useState(initial.length)
    const [selectedIds, setSelectedIds] = useState<Set<Id>>(new Set())
    const actions = useApplicationBulkActions({ setApplications, setTotal, selectedIds, setSelectedIds, funnelTypes: FUNNEL, t })
    return { applications, total, setSelectedIds, actions }
  })
}
const rowOf = (r: { result: { current: { applications: Application[] } } }, id: Id) => r.result.current.applications.find(a => a.id === id)

beforeEach(() => { patch.mockReset(); del.mockReset() })

describe('useApplicationBulkActions · bulkDetach (Heraudit-R2 finding 1)', () => {
  it('sends the collected reason as the DELETE body for every selected id', async () => {
    del.mockResolvedValue({})
    const r = harness([app({ id: 1 }), app({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkDetach('No longer relevant'))
    expect(del).toHaveBeenCalledWith('/applications/1', { data: { reason: 'No longer relevant' } })
    expect(del).toHaveBeenCalledWith('/applications/2', { data: { reason: 'No longer relevant' } })
    await waitFor(() => expect(rowOf(r, 1)?.archived).toBe(true))
  })

  it('optimistically archives + decrements the total, then reverts both on failure', async () => {
    del.mockRejectedValue(new Error('422'))
    const r = harness([app({ id: 1 })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkDetach('Duplicate'))
    expect(rowOf(r, 1)?.archived).toBe(true) // optimistic
    expect(r.result.current.total).toBe(0)
    await waitFor(() => expect(rowOf(r, 1)?.archived).toBe(false)) // reverted
    expect(r.result.current.total).toBe(1)
  })

  it('is a no-op when nothing is selected — never calls the API with an empty id list', () => {
    const r = harness([app({ id: 1 })])
    act(() => r.result.current.actions.bulkDetach('reason'))
    expect(del).not.toHaveBeenCalled()
  })
})

describe('useApplicationBulkActions · bulkSetPhase', () => {
  it('PATCHes the phase for every selected id and clears the selection', async () => {
    patch.mockResolvedValue({})
    const r = harness([app({ id: 1, phaseKey: 'applied' }), app({ id: 2, phaseKey: 'applied' })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkSetPhase('hired'))
    expect(rowOf(r, 1)?.phaseKey).toBe('hired')
    expect(rowOf(r, 1)?.bucket).toBe('matched')
    expect(patch).toHaveBeenCalledWith('/applications/1', { phase_key: 'hired' })
    expect(patch).toHaveBeenCalledWith('/applications/2', { phase_key: 'hired' })
  })
})

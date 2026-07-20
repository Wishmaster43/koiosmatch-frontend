import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useVacancyBulkActions } from './useVacancyBulkActions'

// Stub the tenant-aware api client so no real request runs.
vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }))
import api from '@/lib/api'

const post = api.post as unknown as ReturnType<typeof vi.fn>
const notify = vi.fn()
const t = ((k: string) => k) as unknown as import('i18next').TFunction
const statusMeta = (v?: string | number | null) => ({ label: `L:${v}`, color: '#111' })

// Harness: real state, so we can observe optimistic update → reconcile/revert.
function harness() {
  return renderHook(() => {
    const [vacancies, setVacancies] = useState<Array<Record<string, unknown>>>([
      { id: 1, statusValue: 'draft', tags: ['x'] },
      { id: 2, statusValue: 'draft', tags: ['x'] },
    ])
    const [total, setTotal] = useState(2)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actions = useVacancyBulkActions({ vacancies, setVacancies, setTotal, selectedIds, setSelectedIds, notify, t, statusMeta } as any)
    return { vacancies, total, setSelectedIds, actions }
  })
}
const status = (r: { result: { current: { vacancies: Array<Record<string, unknown>> } } }, id: number) =>
  r.result.current.vacancies.find(v => v.id === id)?.statusValue

beforeEach(() => { notify.mockClear(); post.mockReset() })

describe('useVacancyBulkActions · bulkMutate optimistic/reconcile', () => {
  it('keeps every row patched when the server confirms all', async () => {
    post.mockResolvedValue({ data: { updated: [1, 2] } })
    const r = harness()
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkSetStatus('open'))
    expect(status(r, 1)).toBe('open')                       // optimistic
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'bulk.statusChanged'))
    expect(status(r, 1)).toBe('open')
    expect(status(r, 2)).toBe('open')
  })

  it('reverts rows the server skipped (partial reconcile)', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness()
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkSetStatus('open'))
    await waitFor(() => expect(notify).toHaveBeenCalled())
    expect(status(r, 1)).toBe('open')     // confirmed → stays
    expect(status(r, 2)).toBe('draft')    // skipped → reverted to snapshot
  })

  it('reverts everything and flags an error when the call fails', async () => {
    post.mockRejectedValue(new Error('boom'))
    const r = harness()
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkSetStatus('open'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.mutateError'))
    expect(status(r, 1)).toBe('draft')
    expect(status(r, 2)).toBe('draft')
  })
})

const tagsOf = (r: { result: { current: { vacancies: Array<Record<string, unknown>> } } }, id: number) =>
  r.result.current.vacancies.find(v => v.id === id)?.tags

describe('useVacancyBulkActions · archive + tag removal', () => {
  it('archives on confirm: drops confirmed rows and lowers the total', async () => {
    post.mockResolvedValue({ data: { archived: [1] } })
    const r = harness()
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkArchive())
    // Confirm via the staged ConfirmDialog (replaces window.confirm).
    act(() => r.result.current.actions.dialog.props.onConfirm())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'bulk.archived'))
    expect(r.result.current.vacancies.map(v => v.id)).toEqual([2]) // only id1 archived
    expect(r.result.current.total).toBe(1)
  })

  it('does nothing when archive is cancelled', () => {
    const r = harness()
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkArchive())
    act(() => r.result.current.actions.dialog.props.onCancel())
    expect(post).not.toHaveBeenCalled()
    expect(r.result.current.vacancies).toHaveLength(2)
  })

  it('removes a tag optimistically and reverts rows the server skipped', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness()
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkRemoveTag('x'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'bulk.tagRemoved'))
    expect(tagsOf(r, 1)).toEqual([])      // confirmed
    expect(tagsOf(r, 2)).toEqual(['x'])   // skipped → reverted
  })
})

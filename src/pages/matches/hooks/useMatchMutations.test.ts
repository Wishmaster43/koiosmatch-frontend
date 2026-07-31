/**
 * useMatchMutations — pins the optimistic-revert bug-class fix (Danny,
 * optimistic-revert audit): board drag / drawer status picker / Extra-tab
 * custom fields used to leave a rejected PATCH's optimistic value sitting on
 * screen with only a toast, no revert. These tests assert the actual
 * UI-visible state (rows + selected) snaps back to its prior value after a
 * rejected PATCH — not merely that a toast fired (§13: a mutation test asserts
 * the effect on state, never only that a callback ran) — and that the request
 * itself (route + body) is unchanged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useMatchMutations } from './useMatchMutations'
import type { MatchRow } from '@/types/match'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { patch: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notify: vi.fn() }))

import api from '@/lib/api'
import { notify } from '@/lib/notify'

const patch = api.patch as unknown as ReturnType<typeof vi.fn>

// A minimal harness with REAL useState for rows/selected (mirrors how
// MatchesPage wires the hook) so a test can assert the actual rendered value
// snaps back, not just that a setter function was invoked.
function useHarness(initial: MatchRow[]) {
  const [rows, setRows] = useState<MatchRow[]>(initial)
  const [selected, setSelected] = useState<MatchRow | null>(initial[0] ?? null)
  const updateMatch = (id: MatchRow['id'], p: Partial<MatchRow>) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...p } : r)))
  const mutations = useMatchMutations({ rows, selected, updateMatch, setSelected })
  return { rows, selected, setSelected, updateMatch, ...mutations }
}

// A stub row carrying only the fields these tests touch.
const row = (over: Partial<MatchRow> = {}): MatchRow => ({
  id: 'm1', candidate: 'Jane', initials: 'J', vacancy: 'V', client: 'C',
  candidateId: null, vacancyId: null, clientId: null, score: null, stage: '',
  status: 'open', stageColor: '#000', owner: '', ownerId: null, ownerInitials: '', ownerColor: null,
  date: '', customFieldValues: {}, helloflexLink: null, shiftmanagerLink: null,
  ...over,
})

// avatar_color values from the /users payload — DATA fixtures, not UI styling.
// eslint-disable-next-line no-restricted-syntax -- API fixture value, never rendered as a style literal
const OWNER_COLOR_OLD = '#abcdef'
// eslint-disable-next-line no-restricted-syntax -- API fixture value, never rendered as a style literal
const OWNER_COLOR_NEW = '#123456'

beforeEach(() => { patch.mockReset(); vi.mocked(notify).mockClear() })

describe('useMatchMutations · setStatus (board drag + drawer status picker)', () => {
  it('reverts BOTH the row list and the open drawer copy when the PATCH rejects', async () => {
    patch.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useHarness([row({ status: 'open' })]))

    act(() => { result.current.setStatus('m1', 'placed') })
    // Optimistic write lands immediately in both slices.
    expect(result.current.rows[0].status).toBe('placed')
    expect(result.current.selected?.status).toBe('placed')

    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', expect.any(String)))
    // The old bug: the value stayed 'placed' forever with only a toast. Assert
    // the actual state is back to what it was, not merely that a toast fired.
    expect(result.current.rows[0].status).toBe('open')
    expect(result.current.selected?.status).toBe('open')
  })

  it('sends the request unchanged (route + body)', async () => {
    patch.mockResolvedValue({})
    const { result } = renderHook(() => useHarness([row()]))
    act(() => { result.current.setStatus('m1', 'placed') })
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/matches/m1', { status: 'placed' }))
  })

  it('never touches an unrelated field on revert (surgical, not whole-row)', async () => {
    patch.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useHarness([row({ status: 'open', score: 50 })]))

    act(() => { result.current.setStatus('m1', 'placed') })
    // A concurrent, unrelated optimistic write (e.g. another field's own edit)
    // lands on the SAME row before this PATCH's rejection is processed — a
    // whole-row snapshot/restore would wipe it out; a field-scoped one won't.
    act(() => { result.current.updateMatch('m1', { score: 99 }) })

    await waitFor(() => expect(result.current.rows[0].status).toBe('open'))
    expect(result.current.rows[0].score).toBe(99)
  })

  it('does nothing when no drawer row is selected for that id', async () => {
    patch.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useHarness([row({ id: 'm1' }), row({ id: 'm2', status: 'open' })]))
    act(() => { result.current.setSelected(null) })
    act(() => { result.current.setStatus('m2', 'placed') })
    expect(result.current.rows.find(r => r.id === 'm2')?.status).toBe('placed')
    await waitFor(() => expect(result.current.rows.find(r => r.id === 'm2')?.status).toBe('open'))
    expect(result.current.selected).toBeNull()
  })
})

describe('useMatchMutations · setOwner (drawer owner picker, MATCH-OWNER-1)', () => {
  it('PATCHes owner_id to the match route (the seam: method + route + body)', async () => {
    patch.mockResolvedValue({})
    const { result } = renderHook(() => useHarness([row()]))
    act(() => { result.current.setOwner('m1', { id: 'u-7', name: 'Piet de Vries', avatar_color: OWNER_COLOR_NEW }) })
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/matches/m1', { owner_id: 'u-7' }))
  })

  it('writes all four owner display fields optimistically (name, id, initials, colour)', () => {
    patch.mockResolvedValue({})
    const { result } = renderHook(() => useHarness([row({ owner: 'Jan Jansen', ownerId: 'u-1', ownerInitials: 'JJ', ownerColor: OWNER_COLOR_OLD })]))
    act(() => { result.current.setOwner('m1', { id: 'u-7', name: 'Piet de Vries', avatar_color: OWNER_COLOR_NEW }) })
    expect(result.current.rows[0]).toMatchObject({ owner: 'Piet de Vries', ownerId: 'u-7', ownerInitials: 'PD', ownerColor: OWNER_COLOR_NEW })
    expect(result.current.selected).toMatchObject({ owner: 'Piet de Vries', ownerId: 'u-7' })
  })

  it('reverts BOTH the row list and the open drawer copy when the PATCH rejects', async () => {
    patch.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useHarness([row({ owner: 'Jan Jansen', ownerId: 'u-1', ownerInitials: 'JJ', ownerColor: OWNER_COLOR_OLD })]))

    act(() => { result.current.setOwner('m1', { id: 'u-7', name: 'Piet de Vries', avatar_color: OWNER_COLOR_NEW }) })
    expect(result.current.rows[0].owner).toBe('Piet de Vries')

    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', expect.any(String)))
    // The dead-box bug's mirror image: a rejected reassignment must not leave the
    // new owner on screen. Every owner field snaps back, in both state slices.
    expect(result.current.rows[0]).toMatchObject({ owner: 'Jan Jansen', ownerId: 'u-1', ownerInitials: 'JJ', ownerColor: OWNER_COLOR_OLD })
    expect(result.current.selected).toMatchObject({ owner: 'Jan Jansen', ownerId: 'u-1' })
  })

  it('never touches an unrelated field on revert (surgical, not whole-row)', async () => {
    patch.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useHarness([row({ owner: 'Jan Jansen', ownerId: 'u-1', status: 'open' })]))
    act(() => { result.current.setOwner('m1', { id: 'u-7', name: 'Piet de Vries' }) })
    act(() => { result.current.updateMatch('m1', { status: 'placed' }) })
    await waitFor(() => expect(result.current.rows[0].owner).toBe('Jan Jansen'))
    expect(result.current.rows[0].status).toBe('placed')
  })

  it('sends nothing when the match id or the user id is missing (no ownerless PATCH)', () => {
    patch.mockResolvedValue({})
    const { result } = renderHook(() => useHarness([row()]))
    act(() => { result.current.setOwner(undefined, { id: 'u-7', name: 'Piet' }) })
    act(() => { result.current.setOwner('m1', { id: undefined as unknown as string, name: 'Piet' }) })
    expect(patch).not.toHaveBeenCalled()
  })
})

describe('useMatchMutations · updateCustomFields (Extra tab)', () => {
  it('reverts the customFieldValues map on a rejected PATCH', async () => {
    patch.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useHarness([row({ customFieldValues: { colour: 'blue' } })]))

    act(() => { result.current.updateCustomFields('m1', { colour: 'red' }) })
    expect(result.current.rows[0].customFieldValues).toEqual({ colour: 'red' })
    expect(result.current.selected?.customFieldValues).toEqual({ colour: 'red' })

    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', expect.any(String)))
    expect(result.current.rows[0].customFieldValues).toEqual({ colour: 'blue' })
    expect(result.current.selected?.customFieldValues).toEqual({ colour: 'blue' })
  })

  it('merges the patch over the existing map and sends the full merged object', async () => {
    patch.mockResolvedValue({})
    const { result } = renderHook(() => useHarness([row({ customFieldValues: { colour: 'blue', size: 'M' } })]))
    act(() => { result.current.updateCustomFields('m1', { colour: 'red' }) })
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/matches/m1', { custom_fields: { colour: 'red', size: 'M' } }))
  })
})

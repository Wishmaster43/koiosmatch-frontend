/**
 * useCustomerBulkActions — request-asserting coverage for the mutations that
 * previously only had a callback-fired test on CustomersBulkBar.test.jsx (seam
 * audit HIGH-gap, §13: a test that proves a callback fired proves nothing about
 * the actual request). Mirrors the useCandidateBulkActions.test.ts harness
 * (real useState so optimistic patch → reconcile/revert is observable) for
 * bulkGeocode (the flagged gap), bulkSetStatus (the generic bulkMutate
 * optimistic/reconcile path) and bulkArchive (the confirm-gated mutation).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useCustomerBulkActions } from './useCustomerBulkActions'
import type { Customer } from '@/types/customer'
import type { Id } from '@/types/common'

// Keep the real unwrap — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
import api from '@/lib/api'

const post = api.post as unknown as ReturnType<typeof vi.fn>
const notify = vi.fn()
const t = ((k: string) => k) as unknown as import('i18next').TFunction
// Minimal status-lookup stand-in: label/color derived from the value.
const statusMeta = (v: string) => ({ label: v === 'actief' ? 'Actief' : v, color: 'slate' })

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 1, name: 'Test customer', status: 'prospect', statusLabel: 'Prospect', statusColor: 'slate',
  owner: '', ownerId: null, ownerInitials: '', ownerColor: null, tags: [],
  ...overrides,
} as Customer)

// Harness: real state, so we can observe optimistic update → reconcile/revert.
function harness(initial: Customer[]) {
  return renderHook(() => {
    const [customers, setCustomers] = useState<Customer[]>(initial)
    const [total, setTotal] = useState(initial.length)
    const [selectedIds, setSelectedIds] = useState<Set<Id>>(new Set())
    const actions = useCustomerBulkActions({
      customers, setCustomers, setTotal, selectedIds, setSelectedIds, notify, statusMeta, t,
    })
    return { customers, total, setSelectedIds, actions }
  })
}
const rowOf = (r: { result: { current: { customers: Customer[] } } }, id: Id) => r.result.current.customers.find(c => c.id === id)

beforeEach(() => { notify.mockClear(); post.mockReset() })

// GEO-REGEOCODE-1 (HIGH-gap): the manual "PDOK opnieuw ophalen" bulk call —
// queued + async (202), no optimistic row patch and no reconcile.
describe('useCustomerBulkActions · bulkGeocode (GEO-REGEOCODE-1)', () => {
  it('POSTs /customers/bulk/geocode with the exact selected customer_ids', async () => {
    post.mockResolvedValue({ status: 202, data: {} })
    const r = harness([customer({ id: 1 }), customer({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkGeocode())
    expect(post).toHaveBeenCalledWith('/customers/bulk/geocode', { customer_ids: [1, 2] })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'common:geocode.started'))
  })

  it('is a no-op when nothing is selected', () => {
    const r = harness([customer({ id: 1 })])
    act(() => r.result.current.actions.bulkGeocode())
    expect(post).not.toHaveBeenCalled()
  })

  it('shows the generic mutate error toast when the call fails', async () => {
    post.mockRejectedValue(new Error('boom'))
    const r = harness([customer({ id: 1 })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkGeocode())
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.mutateError'))
  })
})

// The generic optimistic bulkMutate path (apply → reconcile on `updated` → revert),
// exercised here through bulkSetStatus.
describe('useCustomerBulkActions · bulkSetStatus (bulkMutate optimistic/reconcile)', () => {
  it('POSTs /customers/bulk/status with the exact body, patches optimistically and reverts rows the server skipped', async () => {
    post.mockResolvedValue({ data: { updated: [1] } })
    const r = harness([customer({ id: 1, status: 'prospect' }), customer({ id: 2, status: 'prospect' })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkSetStatus('actief'))
    expect(post).toHaveBeenCalledWith('/customers/bulk/status', { customer_ids: [1, 2], status: 'actief' })
    expect(rowOf(r, 1)?.status).toBe('actief') // optimistic on both
    expect(rowOf(r, 2)?.status).toBe('actief')
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'bulk.statusChanged'))
    expect(rowOf(r, 1)?.status).toBe('actief')   // confirmed → stays
    expect(rowOf(r, 2)?.status).toBe('prospect') // skipped by server → reverted
  })

  it('reverts everything and toasts the generic mutate error when the call fails', async () => {
    post.mockRejectedValue(new Error('boom'))
    const r = harness([customer({ id: 1, status: 'prospect' })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkSetStatus('actief'))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('error', 'bulk.mutateError'))
    expect(rowOf(r, 1)?.status).toBe('prospect')
  })
})

// The confirm-gated destructive path: nothing hits the network before the
// staged ConfirmDialog is accepted.
describe('useCustomerBulkActions · bulkArchive', () => {
  it('POSTs /customers/bulk/archive with the exact customer_ids after confirm, removing archived rows', async () => {
    post.mockResolvedValue({ data: { archived: [1] } })
    const r = harness([customer({ id: 1 }), customer({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkArchive())
    expect(post).not.toHaveBeenCalled() // not yet — waiting on confirm
    // Confirm via the staged ConfirmDialog (replaces window.confirm).
    act(() => r.result.current.actions.dialog.props.onConfirm())
    expect(post).toHaveBeenCalledWith('/customers/bulk/archive', { customer_ids: [1, 2] })
    await waitFor(() => expect(notify).toHaveBeenCalledWith('success', 'bulk.archived'))
    expect(r.result.current.customers).toHaveLength(1)
    expect(r.result.current.total).toBe(1)
  })

  it('does nothing when the confirm dialog is cancelled', () => {
    const r = harness([customer({ id: 1 })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkArchive())
    act(() => r.result.current.actions.dialog.props.onCancel())
    expect(post).not.toHaveBeenCalled()
    expect(r.result.current.customers).toHaveLength(1)
  })
})

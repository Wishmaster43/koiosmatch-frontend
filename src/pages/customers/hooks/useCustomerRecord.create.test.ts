/** useCustomerRecord · phase, create body, restore and key adoption (split from useCustomerRecord.test.ts; the selection and update tests stay there). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useCustomerRecord } from './useCustomerRecord'
import type { Customer } from '@/types/customer'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

const mockedPatch = vi.mocked(api.patch)
const t = ((k: string) => k) as unknown as import('i18next').TFunction

beforeEach(() => vi.clearAllMocks())

import { customer } from './useCustomerRecord.testKit'

// Harness with real state so the optimistic write → revert-on-failure is observable
// (mirrors useApplicationDrawerActions.test.ts's harness).
function harness(initial: Customer[]) {
  return renderHook(() => {
    const [customers, setCustomers] = useState<Customer[]>(initial)
    const [total, setTotal] = useState(initial.length)
    const record = useCustomerRecord({ setCustomers, setTotal, users: [], t })
    return { customers, total, record }
  })
}

/**
 * KLANT-FASE-1 — the lifecycle phase must reach the server. The drawer picker and the
 * create modal both write `phase`; if FIELD_MAP/the create body drop it, the PATCH body
 * comes out EMPTY and no request is sent at all (§3: exactly the fake-affordance class
 * this repo has been bitten by). These assert the REQUEST — route + body.
 */
describe('useCustomerRecord · customer phase (KLANT-FASE-1)', () => {
  it('PATCHes the phase slug to /customers/{id} — the drawer picker really persists', async () => {
    mockedPatch.mockResolvedValue({})
    const r = harness([customer({ id: 1, phase: 'prospect' } as Partial<Customer>)])
    act(() => { r.result.current.record.updateCustomer(1, { phase: 'klant' }) })

    expect(mockedPatch).toHaveBeenCalledWith('/customers/1', { phase: 'klant' })
    await waitFor(() => expect((r.result.current.customers[0] as Customer).phase).toBe('klant'))
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts the phase and reports the server message when the PATCH is refused', async () => {
    mockedPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Onbekende fase' } } })
    const r = harness([customer({ id: 1, phase: 'prospect' } as Partial<Customer>)])
    act(() => { r.result.current.record.updateCustomer(1, { phase: 'klant' }) })

    await waitFor(() => expect((r.result.current.customers[0] as Customer).phase).toBe('prospect'))
    expect(notifyError).toHaveBeenCalledWith('Onbekende fase')
  })

  it('POSTs the chosen phase on create', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 9, name: 'Nieuw', phase: 'klant' } })
    const r = harness([])
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Nieuw', debtorNumber: '', status: 'active', ownerId: '', industry: '', city: '', phase: 'klant',
      })
    })

    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/customers', expect.objectContaining({ phase: 'klant' }))
  })

  it('omits phase from the create body when none was picked — an empty slug would be a 422', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 10, name: 'Nieuw' } })
    const r = harness([])
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Nieuw', debtorNumber: '', status: 'active', ownerId: '', industry: '', city: '', phase: '',
      })
    })

    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('phase')
  })

  // CLEAR-SWEEP (Danny 13-08): industry/owner_id moved into the conditional
  // OPTIONAL_CREATE_FIELDS-style treatment once their pickers became clearable —
  // this asserts the REQUEST body (§13), not only that handleCreate resolved.
  it('sends industry and owner_id on the create body once picked', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 11, name: 'Nieuw' } })
    const r = harness([])
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Nieuw', debtorNumber: '', status: 'active', ownerId: 'u1', industry: 'Zorg', city: '', phase: '',
      })
    })

    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/customers', expect.objectContaining({ industry: 'Zorg', owner_id: 'u1' }))
  })

  // CUST-CREATE-VELDEN (Danny 27-08): the VAT number rides the create body like
  // KvK — asserts the REQUEST (§13), and its absence when left empty.
  it('sends vat_number on the create body once typed, omits it when empty', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 13, name: 'Nieuw' } })
    const r = harness([])
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Nieuw', debtorNumber: '', status: 'active', ownerId: '', industry: '', city: '', phase: '',
        cocNumber: '12345678', vatNumber: 'NL123456789B01',
      })
    })
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/customers',
      expect.objectContaining({ coc_number: '12345678', vat_number: 'NL123456789B01' }))

    vi.mocked(api.post).mockClear()
    vi.mocked(api.post).mockResolvedValue({ data: { id: 14, name: 'Leeg' } })
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Leeg', debtorNumber: '', status: 'active', ownerId: '', industry: '', city: '', phase: '', vatNumber: '',
      })
    })
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('vat_number')
  })

  // CUST-SOURCE-FE-1: acquisition source rides the create body like industry —
  // asserts the REQUEST (§13), and its absence when left empty.
  it('sends source on the create body once picked, omits it when empty', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 15, name: 'Nieuw' } })
    const r = harness([])
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Nieuw', debtorNumber: '', status: 'active', ownerId: '', industry: '', city: '', phase: '',
        source: 'LinkedIn',
      })
    })
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/customers', expect.objectContaining({ source: 'LinkedIn' }))

    vi.mocked(api.post).mockClear()
    vi.mocked(api.post).mockResolvedValue({ data: { id: 16, name: 'Leeg' } })
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Leeg', debtorNumber: '', status: 'active', ownerId: '', industry: '', city: '', phase: '', source: '',
      })
    })
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('source')
  })

  it('CLEAR-SWEEP: omits industry and owner_id from the create body when cleared back to empty', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 12, name: 'Nieuw' } })
    const r = harness([])
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Nieuw', debtorNumber: '', status: 'active', ownerId: '', industry: '', city: '', phase: '',
      })
    })

    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('industry')
    expect(body).not.toHaveProperty('owner_id')
  })

  // BEDRIJFSTEKST-1: the create-form key companyText POSTs as `description`.
  it('POSTs companyText as description', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 20, name: 'Nieuw' } })
    const r = harness([])
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Nieuw', debtorNumber: '', status: 'active', ownerId: '', industry: '', city: '', phase: '',
        companyText: 'Dit is onze bedrijfsfilosofie',
      })
    })

    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/customers', expect.objectContaining({ description: 'Dit is onze bedrijfsfilosofie' }))
  })
})

// TRASH-OVERAL-2: restore-to-active stays the separate per-id /restore route —
// REQUEST-asserting (§13), plus the local lifecycle reconcile across the slices.
describe('useCustomerRecord · restoreCustomer (TRASH-OVERAL-2)', () => {
  it('POSTs /customers/{id}/restore and clears archived + lifecycle on the list row', async () => {
    vi.mocked(api.post).mockResolvedValue({})
    const r = harness([customer({ id: 1, archived: true, archivedAt: '2026-08-01T10:00:00Z', lifecycle: 'archived', pendingEraseAt: null })])

    act(() => { r.result.current.record.restoreCustomer(1) })

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/customers/1/restore', undefined,
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
    await waitFor(() => expect(r.result.current.customers[0].archived).toBe(false))
    expect(r.result.current.customers[0].lifecycle).toBe('active')
    expect(r.result.current.customers[0].archivedAt).toBeNull()
  })

  it('keeps the archived state and reports failure when the POST is refused', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 403 } })
    const r = harness([customer({ id: 1, archived: true, lifecycle: 'archived' })])

    act(() => { r.result.current.record.restoreCustomer(1) })

    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(r.result.current.customers[0].archived).toBe(true)
  })
})

// KEY-ADOPTION (Danny 07-09): lookup values are identified by stable `key` field
// (sent alongside legacy name for backward compat). The source and blacklist_reason
// fields carry their keys in sourceKey and blacklistReasonKey; PATCH and POST bodies
// send source_key and blacklist_reason_key (the API precedence is id > key > name).
describe('useCustomerRecord · KEY-ADOPTION (source_key, blacklist_reason_key)', () => {
  it('PATCHes source_key alongside the legacy source name', async () => {
    mockedPatch.mockResolvedValue({})
    const r = harness([customer({ id: 1, source: 'LinkedIn', sourceKey: null })])
    act(() => { r.result.current.record.updateCustomer(1, { source: 'Google', sourceKey: 'google' }) })
    // Both the name (for back-compat) and the stable key travel together.
    expect(mockedPatch).toHaveBeenCalledWith('/customers/1', { source: 'Google', source_key: 'google' })
  })

  it('POSTs source_key alongside the legacy source name on create', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 99, name: 'Created' } })
    const r = harness([])
    await act(async () => {
      await r.result.current.record.handleCreate({
        name: 'Created', status: 'active', ownerId: '', industry: '', city: '', source: 'Google', sourceKey: 'google',
      })
    })
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/customers', expect.objectContaining({ source: 'Google', source_key: 'google' }))
  })

  it('PATCHes blacklist_reason_key alongside the legacy blacklist_reason', async () => {
    mockedPatch.mockResolvedValue({})
    const r = harness([customer({ id: 1, status: 'bl', blacklistReason: 'Fraude', blacklistReasonKey: null })])
    act(() => { r.result.current.record.updateCustomer(1, { blacklistReason: 'Fraude', blacklistReasonKey: 'fraud' }) })
    expect(mockedPatch).toHaveBeenCalledWith('/customers/1', { blacklist_reason: 'Fraude', blacklist_reason_key: 'fraud' })
  })

  // When a field is cleared, both the name and the key are sent as null.
  it('sends null for both source and source_key when source is cleared', async () => {
    mockedPatch.mockResolvedValue({})
    const r = harness([customer({ id: 1, source: 'Google', sourceKey: 'google' })])
    act(() => { r.result.current.record.updateCustomer(1, { source: '', sourceKey: null }) })
    expect(mockedPatch).toHaveBeenCalledWith('/customers/1', { source: '', source_key: null })
  })
})

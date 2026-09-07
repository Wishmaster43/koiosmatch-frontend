/**
 * useCustomerDrawerActions · blacklist status-reason prompt (KLANT-BLACKLIST-PROMPT-1,
 * Danny 04-09: "Blacklist ja"). Mirrors the candidate axis: a status flagged
 * `isBlacklist` opens the prompt instead of patching immediately, and status +
 * blacklistReason travel in ONE PATCH on confirm. Assert the SEAM (§13): the
 * exact onUpdate call, never only that a callback fired.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCustomerDrawerActions } from './useCustomerDrawerActions'
import type { Customer } from '@/types/customer'
import type { LookupOption } from '@/types/common'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/useCustomerPhases', () => ({
  useCustomerPhases: () => ({ phases: [], phaseMeta: () => ({ label: '', color: '#000' }), defaultPhase: '', isCustomerPhase: () => false, loading: false }),
}))

// The tenant settings blob — one mock var, reassigned per test.
let settingsBlob: Record<string, unknown> = {}
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => settingsBlob }
})

import api from '@/lib/api'
const mockedGet = vi.mocked(api.get)

beforeEach(() => { vi.clearAllMocks(); settingsBlob = {}; mockedGet.mockResolvedValue({ data: { data: [] } }) })

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 1, name: 'Test customer', status: 'available', blacklistReason: null,
  ...overrides,
} as unknown as Customer)

const statuses: LookupOption[] = [
  { value: 'available', label: 'Available' },
  // Flag-less second option — STATUS-OVERRIDE-REVERT-1 below needs a plain
  // transition target distinct from the customer's own starting status.
  { value: 'inactive', label: 'Inactive' },
  { value: 'bl', label: 'Blacklist', isBlacklist: true },
]

function harness(c: Customer, onUpdate = vi.fn()) {
  let hook!: ReturnType<typeof renderHook<ReturnType<typeof useCustomerDrawerActions>, unknown>>
  act(() => { hook = renderHook(() => useCustomerDrawerActions({ c, onUpdate, onClose: vi.fn(), users: [], statuses })) })
  return { hook, onUpdate }
}

describe('useCustomerDrawerActions · blacklist status prompt', () => {
  it('opens the modal instead of patching when a blacklisted status is picked', async () => {
    const { hook, onUpdate } = harness(customer())
    act(() => { hook.result.current.changeStatus('bl') })
    expect(hook.result.current.blacklistModal).toEqual({ target: 'bl', reason: '', reasonKey: null, needReason: true })
    expect(onUpdate).not.toHaveBeenCalled()
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
  })

  // CUSTOMER-BLACKLIST-REASON-DISPLAY: re-opening the status prompt on an already-
  // blacklisted customer prefills the STORED reason instead of an empty field.
  it('prefills the stored blacklistReason when re-opening on an already-blacklisted customer', async () => {
    const { hook } = harness(customer({ status: 'bl', blacklistReason: 'Wanbetaling' }))
    act(() => { hook.result.current.changeStatus('bl') })
    expect(hook.result.current.blacklistModal).toEqual({ target: 'bl', reason: 'Wanbetaling', reasonKey: null, needReason: true })
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
  })

  it('needReason follows the customer_blacklist_reason_required tenant setting', async () => {
    settingsBlob = { customer_blacklist_reason_required: '0' }
    const { hook } = harness(customer())
    act(() => { hook.result.current.changeStatus('bl') })
    expect(hook.result.current.blacklistModal?.needReason).toBe(false)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
  })

  it('confirms with ONE onUpdate call carrying status + blacklistReason', () => {
    const { hook, onUpdate } = harness(customer())
    act(() => { hook.result.current.changeStatus('bl') })
    act(() => { hook.result.current.setBlacklistModal(m => m && ({ ...m, reason: 'Fraude' })) })
    act(() => { hook.result.current.confirmBlacklist() })
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith(1, { status: 'bl', blacklistReason: 'Fraude', blacklistReasonKey: null })
    expect(hook.result.current.blacklistModal).toBeNull()
  })

  it('picking a normal status patches with blacklistReason: null to clear any stored reason', () => {
    const { hook, onUpdate } = harness(customer())
    act(() => { hook.result.current.changeStatus('available') })
    expect(onUpdate).toHaveBeenCalledWith(1, { status: 'available', blacklistReason: null, blacklistReasonKey: null })
    expect(hook.result.current.blacklistModal).toBeNull()
  })

  it('loads the blacklist-reason lookup lazily once the modal opens', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ name: 'Fraude' }, { name: 'Wanbetaling' }] } })
    const { hook } = harness(customer())
    act(() => { hook.result.current.changeStatus('bl') })
    await waitFor(() => expect(hook.result.current.blacklistReasons).toHaveLength(2))
    expect(mockedGet).toHaveBeenCalledWith('/customer-blacklist-reasons')
  })

  // Opus finding (04-09): with an EMPTY lookup the effect used to re-fire on every reason edit.
  it('fetches the reason lookup once even when it is empty and the reason is edited twice', async () => {
    const { hook } = harness(customer())
    act(() => { hook.result.current.changeStatus('bl') })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1))
    act(() => { hook.result.current.setBlacklistModal(m => m && ({ ...m, reason: 'a' })) })
    act(() => { hook.result.current.setBlacklistModal(m => m && ({ ...m, reason: 'ab' })) })
    await new Promise(r => setTimeout(r, 20))
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })
})

// STATUS-OVERRIDE-REVERT-1 (WORKLIST, 04-09): the local status override used to
// survive a rejected PATCH — updateCustomer reverts the record slices, but the
// drawer's own optimistic override lives in separate state it can't reach, so
// the picker kept showing the refused status. onUpdate now resolves true/false,
// and the override clears itself on false.
describe('useCustomerDrawerActions · STATUS-OVERRIDE-REVERT-1 (override clears on a rejected PATCH)', () => {
  it('changeStatus reverts the override when onUpdate resolves false', async () => {
    const onUpdate = vi.fn().mockResolvedValue(false)
    const { hook } = harness(customer(), onUpdate)
    act(() => { hook.result.current.changeStatus('inactive') })
    expect(hook.result.current.currentStatus).toBe('inactive') // optimistic
    await waitFor(() => expect(hook.result.current.currentStatus).toBe('available')) // reverted
  })

  it('confirmBlacklist reverts the override when onUpdate resolves false', async () => {
    const onUpdate = vi.fn().mockResolvedValue(false)
    const { hook } = harness(customer(), onUpdate)
    act(() => { hook.result.current.changeStatus('bl') })
    act(() => { hook.result.current.setBlacklistModal(m => m && ({ ...m, reason: 'Fraude' })) })
    act(() => { hook.result.current.confirmBlacklist() })
    expect(hook.result.current.currentStatus).toBe('bl') // optimistic
    await waitFor(() => expect(hook.result.current.currentStatus).toBe('available')) // reverted
  })

  it('changeStatus keeps the override when onUpdate resolves true (saved)', async () => {
    const onUpdate = vi.fn().mockResolvedValue(true)
    const { hook } = harness(customer(), onUpdate)
    act(() => { hook.result.current.changeStatus('inactive') })
    await act(async () => { await Promise.resolve() })
    expect(hook.result.current.currentStatus).toBe('inactive')
  })
})

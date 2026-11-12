/** offboardingGate — the 423 detector and the idempotent interceptor registration. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'
import { detectOffboarding, getOffboardingGateState, registerOffboardingGate, resetOffboardingGate, subscribeOffboardingGate } from './offboardingGate'

const err = (status: number, data: unknown) => ({ response: { status, data } })
beforeEach(() => resetOffboardingGate())

describe('offboardingGate', () => {
  it('423 tenant_offboarding raises the flag with the due date and notifies subscribers', () => {
    const l = vi.fn()
    const off = subscribeOffboardingGate(l)
    detectOffboarding(err(423, { code: 'tenant_offboarding', offboarding_due_at: '2026-12-06T23:00:00+00:00' }))
    expect(getOffboardingGateState()).toEqual({ active: true, dueAt: '2026-12-06T23:00:00+00:00' })
    expect(l).toHaveBeenCalledTimes(1)
    off()
  })
  it('a null due date still raises the flag', () => {
    detectOffboarding(err(423, { code: 'tenant_offboarding', offboarding_due_at: null }))
    expect(getOffboardingGateState()).toEqual({ active: true, dueAt: null })
  })
  it('another code, another status or a non-axios error does nothing', () => {
    detectOffboarding(err(423, { code: 'other' }))
    detectOffboarding(err(403, { code: 'tenant_offboarding' }))
    detectOffboarding(new Error('x'))
    detectOffboarding(null)
    expect(getOffboardingGateState().active).toBe(false)
  })
  it('the interceptor flags the state and still rejects with the original error', async () => {
    const client = axios.create()
    registerOffboardingGate(client)
    registerOffboardingGate(client)
    const handlers = (client.interceptors.response as unknown as { handlers: Array<{ rejected: (e: unknown) => Promise<unknown> } | null> }).handlers.filter(Boolean)
    expect(handlers).toHaveLength(1)
    const e = err(423, { code: 'tenant_offboarding' })
    await expect(handlers[0]!.rejected(e)).rejects.toBe(e)
    expect(getOffboardingGateState().active).toBe(true)
  })
})

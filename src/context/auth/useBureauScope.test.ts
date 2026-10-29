// useBureauScope — the shell's bureau gate: quiet without a session or before the pick, a new key per login / pick / tenant switch.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBureauScope } from './useBureauScope'

const authState = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('../AuthContext', () => ({ useAuth: () => authState.current }))

afterEach(() => { authState.current = {} })

describe('useBureauScope', () => {
  it('is not ready without a session', () => {
    authState.current = { user: null }
    expect(renderHook(() => useBureauScope()).result.current.ready).toBe(false)
  })

  it('is not ready while the super admin still has to pick a bureau', () => {
    authState.current = { user: { id: 'u1' }, needsTenantPick: true, activeTenant: null }
    expect(renderHook(() => useBureauScope()).result.current.ready).toBe(false)
  })

  it('is ready with a session and a chosen bureau, and the key follows the bureau', () => {
    authState.current = { user: { id: 'u1' }, needsTenantPick: false, activeTenant: { id: 't1' } }
    const { result, rerender } = renderHook(() => useBureauScope())
    expect(result.current.ready).toBe(true)
    const first = result.current.scopeKey
    authState.current = { user: { id: 'u1' }, needsTenantPick: false, activeTenant: { id: 't2' } }
    rerender()
    expect(result.current.scopeKey).not.toBe(first)
  })

  it('is ready for an ordinary user whose bureau comes from the session', () => {
    authState.current = { user: { id: 'u2' }, needsTenantPick: false, activeTenant: { id: 't1' } }
    expect(renderHook(() => useBureauScope()).result.current).toEqual({ ready: true, scopeKey: 'u2:t1' })
  })
})

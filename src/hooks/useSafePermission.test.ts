import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as authModule from '@/context/AuthContext'
import { useSafePermission } from './useSafePermission'

vi.mock('@/context/AuthContext')

describe('useSafePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the context hasPermission when present', () => {
    const mockHasPermission = vi.fn((perm: string) => perm === 'customers.view')
    vi.mocked(authModule.useAuth).mockReturnValue({ hasPermission: mockHasPermission } as unknown as ReturnType<typeof authModule.useAuth>)

    const { result } = renderHook(() => useSafePermission())
    const hasPermission = result.current

    expect(hasPermission('customers.view')).toBe(true)
    expect(hasPermission('customers.delete')).toBe(false)
  })

  it('returns a function that yields false when the context is null', () => {
    vi.mocked(authModule.useAuth).mockReturnValue(null)

    const { result } = renderHook(() => useSafePermission())
    const hasPermission = result.current

    expect(hasPermission('customers.view')).toBe(false)
    expect(hasPermission('any.permission')).toBe(false)
  })

  it('returns a function that yields false when hasPermission is missing from context', () => {
    vi.mocked(authModule.useAuth).mockReturnValue({ user: { id: '123' } } as unknown as ReturnType<typeof authModule.useAuth>)

    const { result } = renderHook(() => useSafePermission())
    const hasPermission = result.current

    expect(hasPermission('customers.view')).toBe(false)
    expect(hasPermission('any.permission')).toBe(false)
  })
})

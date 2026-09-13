import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// OPENERS-HIDE-1: starting a conversation needs BOTH page.whatsapp and customers.view —
// either gate missing must hide the trigger, mirroring ContactConversationsSection/
// ConversationTab's own permission checks before this hook was extracted.
const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

afterEach(() => vi.clearAllMocks())

async function load() {
  return (await import('./useCanStartConversation')).useCanStartConversation
}

describe('useCanStartConversation', () => {
  it('true only when both page.whatsapp and customers.view are granted', async () => {
    const useCanStartConversation = await load()
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'page.whatsapp' || p === 'customers.view' })
    const { result } = renderHook(() => useCanStartConversation())
    expect(result.current).toBe(true)
  })

  it('false when page.whatsapp is missing', async () => {
    const useCanStartConversation = await load()
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'customers.view' })
    const { result } = renderHook(() => useCanStartConversation())
    expect(result.current).toBe(false)
  })

  it('false when customers.view is missing', async () => {
    const useCanStartConversation = await load()
    mockUseAuth.mockReturnValue({ hasPermission: (p: string) => p === 'page.whatsapp' })
    const { result } = renderHook(() => useCanStartConversation())
    expect(result.current).toBe(false)
  })

  it('false when auth is unavailable', async () => {
    const useCanStartConversation = await load()
    mockUseAuth.mockReturnValue(null)
    const { result } = renderHook(() => useCanStartConversation())
    expect(result.current).toBe(false)
  })
})

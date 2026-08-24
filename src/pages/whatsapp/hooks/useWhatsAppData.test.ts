/**
 * useWhatsAppData · loadMoreMessages (WHATSAPP-LOG-MEERLADEN-1, K-176, LIVE) —
 * asserts the real request seam per §13: the cursor param is `before=<oldest
 * currently loaded sent_at>`, a page merges with dedup on id (never a doubled
 * row), and an empty page flips `messagesExhausted` without another request.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import api from '@/lib/api'
import { useWhatsAppData } from './useWhatsAppData'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

const firstPage = [
  { id: 'm-2', direction: 'inbound', body: 'later', status: 'delivered', sent_at: '2026-08-01T10:00:00Z' },
  { id: 'm-1', direction: 'outbound', body: 'eerder', status: 'sent', sent_at: '2026-07-01T10:00:00Z' },
]
const olderPage = [
  { id: 'm-0', direction: 'inbound', body: 'nog eerder', status: 'delivered', sent_at: '2026-06-01T10:00:00Z' },
]

function mockGet(pages: { messages?: unknown; escalations?: unknown; activity?: unknown; stats?: unknown } = {}) {
  vi.mocked(api.get).mockImplementation((url: string, config?: Parameters<typeof api.get>[1]) => {
    if (url === '/whatsapp/stats') return Promise.resolve({ data: {} })
    if (url === '/whatsapp/escalations') return Promise.resolve({ data: { data: [] } })
    if (url === '/whatsapp/activity') return Promise.resolve({ data: { data: [] } })
    if (url === '/whatsapp/messages') {
      if ((config?.params as Record<string, unknown> | undefined)?.before) return Promise.resolve({ data: { data: pages.escalations ?? olderPage, has_older: true } })
      return Promise.resolve({ data: { data: firstPage } })
    }
    return Promise.resolve({ data: {} })
  })
}

describe('useWhatsAppData · loadMoreMessages', () => {
  it('requests before=<oldest currently loaded sent_at>', async () => {
    mockGet()
    const { result } = renderHook(() => useWhatsAppData())
    await waitFor(() => expect(result.current.messages).toHaveLength(2))

    await act(async () => { result.current.loadMoreMessages() })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/whatsapp/messages', {
      params: { per_page: 50, before: '2026-07-01T10:00:00Z' },
    }))
  })

  it('merges the older page with dedup on id, never a doubled row', async () => {
    mockGet()
    const { result } = renderHook(() => useWhatsAppData())
    await waitFor(() => expect(result.current.messages).toHaveLength(2))

    await act(async () => { result.current.loadMoreMessages() })

    await waitFor(() => expect(result.current.messages).toHaveLength(3))
    expect(result.current.messages.map(m => m.id)).toEqual(['m-2', 'm-1', 'm-0'])
  })

  // K-176: end-of-archive comes from the server's has_older signal — a SHORT
  // page with has_older:true must NOT flip exhausted (a filter slice can be
  // short while older rows exist), and has_older:false ends it even with rows.
  it('flips messagesExhausted only on has_older:false — never on page size', async () => {
    vi.mocked(api.get).mockImplementation((url: string, config?: Parameters<typeof api.get>[1]) => {
      if (url === '/whatsapp/stats') return Promise.resolve({ data: {} })
      if (url === '/whatsapp/escalations') return Promise.resolve({ data: { data: [] } })
      if (url === '/whatsapp/activity') return Promise.resolve({ data: { data: [] } })
      if (url === '/whatsapp/messages') {
        if ((config?.params as Record<string, unknown> | undefined)?.before) return Promise.resolve({ data: { data: olderPage, has_older: false } })
        return Promise.resolve({ data: { data: firstPage } })
      }
      return Promise.resolve({ data: {} })
    })
    const { result } = renderHook(() => useWhatsAppData())
    await waitFor(() => expect(result.current.messages).toHaveLength(2))

    await act(async () => { result.current.loadMoreMessages() })

    // The last archive page still merges, and the button gives way honestly.
    await waitFor(() => expect(result.current.messagesExhausted).toBe(true))
    expect(result.current.messages).toHaveLength(3)
  })

  it('a short page with has_older:true keeps the button alive', async () => {
    mockGet()
    const { result } = renderHook(() => useWhatsAppData())
    await waitFor(() => expect(result.current.messages).toHaveLength(2))
    await act(async () => { result.current.loadMoreMessages() })
    await waitFor(() => expect(result.current.messages).toHaveLength(3))
    expect(result.current.messagesExhausted).toBe(false)
  })
})

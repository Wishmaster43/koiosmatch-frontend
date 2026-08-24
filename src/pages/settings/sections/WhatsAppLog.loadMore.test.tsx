/**
 * WhatsAppLog · WHATSAPP-LOG-MEERLADEN-1 (K-176, LIVE) — the "Load more" button
 * calls the hook's cursor loader (before=oldest sent_at lives in the hook
 * itself, dedup is asserted there in useWhatsAppData.test.ts); this file only
 * covers the button's own states: idle → loading → end-reached notice, and
 * that the honest retention copy always renders once messages exist.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import WhatsAppLog from './WhatsAppLog'

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const loadMoreMessages = vi.fn()
const mockUseWhatsAppData = vi.hoisted(() => vi.fn())
vi.mock('@/pages/whatsapp/hooks/useWhatsAppData', () => ({ useWhatsAppData: () => mockUseWhatsAppData() }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => ({}), saveSettingsKeys: vi.fn(), invalidateAllSettingsCache: vi.fn() }
})

const oneMessage = [{ id: 'm-1', direction: 'inbound', body: 'hoi', status: 'delivered', sent_at: '2026-06-01T10:00:00Z', candidate: null }]

afterEach(() => vi.clearAllMocks())

describe('WhatsAppLog · load more', () => {
  it('renders the Load more button and the honest retention hint once messages exist', () => {
    mockUseWhatsAppData.mockReturnValue({
      messages: oneMessage, loading: { messages: false }, loadMoreMessages, loadingMoreMessages: false, messagesExhausted: false,
    })
    render(<WhatsAppLog />)
    expect(screen.getByText(st('waLog.loadMore'))).toBeInTheDocument()
    expect(screen.getByText(st('waLog.retentionHint'))).toBeInTheDocument()
  })

  it('calls loadMoreMessages when clicked', () => {
    mockUseWhatsAppData.mockReturnValue({
      messages: oneMessage, loading: { messages: false }, loadMoreMessages, loadingMoreMessages: false, messagesExhausted: false,
    })
    render(<WhatsAppLog />)
    fireEvent.click(screen.getByText(st('waLog.loadMore')))
    expect(loadMoreMessages).toHaveBeenCalledTimes(1)
  })

  it('shows the loading state on the button while a page is in flight', () => {
    mockUseWhatsAppData.mockReturnValue({
      messages: oneMessage, loading: { messages: false }, loadMoreMessages, loadingMoreMessages: true, messagesExhausted: false,
    })
    render(<WhatsAppLog />)
    expect(screen.getByText(st('waLog.loadingMore'))).toBeInTheDocument()
    expect(screen.queryByText(st('waLog.loadMore'))).not.toBeInTheDocument()
  })

  it('shows the end-reached notice instead of the button once exhausted', () => {
    mockUseWhatsAppData.mockReturnValue({
      messages: oneMessage, loading: { messages: false }, loadMoreMessages, loadingMoreMessages: false, messagesExhausted: true,
    })
    render(<WhatsAppLog />)
    expect(screen.getByText(st('waLog.loadMoreExhausted'))).toBeInTheDocument()
    expect(screen.queryByText(st('waLog.loadMore'))).not.toBeInTheDocument()
  })
})

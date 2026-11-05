/** NotificationBell · ask Koios action (split from NotificationBell.test.tsx; X-31). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import NotificationBell from './NotificationBell'
import * as useNotificationsModule from '@/hooks/useNotifications'
import api from '@/lib/api'

// The API client is mocked (API-CREDITS-1: nothing live); the restore-candidate
// action tests live in NotificationBell.notifI18n.test.tsx.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>
const mockDelete = api.delete as unknown as ReturnType<typeof vi.fn>

// NavigationContext is mocked so the bell renders without a real router tree;
// the record-chip click-through is asserted in NotificationBell.notifI18n.test.tsx.
const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))

afterEach(() => { cleanup(); vi.restoreAllMocks(); mockPost.mockReset(); mockDelete.mockReset(); openEntity.mockClear(); window.location.hash = '' })

describe('NotificationBell · X-31 "ask Koios" action', () => {
  // X-31: render the "Vraag Koios" button only when koios_action carries a non-empty prompt.
  it('renders the "ask Koios" button when a row carries a Koios prompt', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [
        {
          id: 1, title: 'Match question', seen: false,
          koios_action: { prompt: 'Stel een vraag over deze match' },
        },
      ],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    // The button contains KoiosAiMark (with aria-label "Koios AI") + translated text.
    // Search for a button that has a KoiosAiMark ancestor (contains img with aria-label).
    const koiosMarkImg = screen.getByRole('img', { name: /koios ai/i })
    const askKoiosButton = koiosMarkImg.closest('button')
    expect(askKoiosButton).toBeInTheDocument()
  })

  it('calls askKoios with the prompt when the button is clicked', async () => {
    const promptText = 'Waarom is deze match niet geschikt?'
    const mockDispatchEvent = vi.spyOn(window, 'dispatchEvent')
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [
        {
          id: 2, title: 'Advice question', seen: false,
          koios_action: { prompt: promptText },
        },
      ],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const koiosMarkImg = screen.getByRole('img', { name: /koios ai/i })
    const askKoiosButton = koiosMarkImg.closest('button')!
    fireEvent.click(askKoiosButton)
    expect(mockDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'km:ask-koios',
        detail: { text: promptText, ref: undefined },
      }),
    )
  })

  it('closes the bell panel when the "ask Koios" button is clicked', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [
        {
          id: 3, title: 'Question', seen: false,
          koios_action: { prompt: 'Test prompt' },
        },
      ],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    const trigger = screen.getByRole('button', { name: /notificat/i })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const koiosMarkImg = screen.getByRole('img', { name: /koios ai/i })
    const askKoiosButton = koiosMarkImg.closest('button')!
    fireEvent.click(askKoiosButton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not render the button when koios_action is null', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 4, title: 'No prompt', seen: false, koios_action: null }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    // No KoiosAiMark should be rendered in the notification row.
    const allKoiosMarks = screen.queryAllByRole('img', { name: /koios ai/i })
    // Only the dialog/topbar should have a KoiosAiMark, not the notification rows.
    expect(allKoiosMarks.length).toBe(0)
  })

  it('does not render the button when koios_action is missing', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 5, title: 'Plain notification', seen: false }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const allKoiosMarks = screen.queryAllByRole('img', { name: /koios ai/i })
    expect(allKoiosMarks.length).toBe(0)
  })

  it('does not render the button when the prompt is empty string', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 6, title: 'Empty prompt', seen: false, koios_action: { prompt: '' } }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const allKoiosMarks = screen.queryAllByRole('img', { name: /koios ai/i })
    expect(allKoiosMarks.length).toBe(0)
  })

  it('does not render the button when the prompt is only whitespace', () => {
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [{ id: 7, title: 'Whitespace prompt', seen: false, koios_action: { prompt: '   ' } }],
      unseen: 1, markAllSeen: vi.fn(), reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    const allKoiosMarks = screen.queryAllByRole('img', { name: /koios ai/i })
    expect(allKoiosMarks.length).toBe(0)
  })

  // X-31: the button click does NOT mark the notification as read by itself.
  it('does not mark the notification as read when the button is clicked', () => {
    const markAllSeenMock = vi.fn()
    vi.spyOn(useNotificationsModule, 'useNotifications').mockReturnValue({
      items: [
        {
          id: 8, title: 'Question', seen: false,
          koios_action: { prompt: 'Test' },
        },
      ],
      unseen: 1, markAllSeen: markAllSeenMock, reload: vi.fn(),
    } as unknown as ReturnType<typeof useNotificationsModule.useNotifications>)
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: /notificat/i }))
    // markAllSeen should have been called once (when opening the panel).
    expect(markAllSeenMock).toHaveBeenCalledTimes(1)
    // Clicking the button should not call markAllSeen again.
    const koiosMarkImg = screen.getByRole('img', { name: /koios ai/i })
    const askKoiosButton = koiosMarkImg.closest('button')!
    fireEvent.click(askKoiosButton)
    expect(markAllSeenMock).toHaveBeenCalledTimes(1)
  })
})

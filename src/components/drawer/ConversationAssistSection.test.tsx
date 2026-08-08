/**
 * ConversationAssistSection — G27 / K2-CONV-ASSIST-1. §13: assert the REQUEST
 * (conversationId/mode/language, never only that a callback fired), the
 * apply-into-composer-draft semantics per mode, and that a failure shows the
 * server's own message while applying nothing.
 *
 * DEFAULT-VALUE-1 (mirrors NoteAssistSection.test.tsx): every button/label
 * carries a Dutch `defaultValue` — there is no i18n instance in this test
 * tree, so that IS what renders. Assertions below match that Dutch text.
 *
 * The mock is reset INLINE at the top of each test (mirrors
 * NoteAssistSection.test.tsx — a shared `beforeEach` combined with a
 * rejecting mock misattributes the rejection as an unhandled test failure).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationAssistSection from './ConversationAssistSection'
import { assistConversation } from './conversationAssistApi'

vi.mock('./conversationAssistApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./conversationAssistApi')>()
  return { ...actual, assistConversation: vi.fn() }
})

describe('ConversationAssistSection · request per mode', () => {
  it('calls assistConversation with {id, mode: "summarize", language} when Samenvatten is clicked', async () => {
    vi.mocked(assistConversation).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistConversation).mockResolvedValue({ kind: 'text', text: 'Summary.' })
    render(<ConversationAssistSection conversationId="conv-1" hasMessages onApply={vi.fn()} language="en" />)
    await user.click(screen.getByRole('button', { name: 'Samenvatten' }))
    expect(assistConversation).toHaveBeenCalledWith({ id: 'conv-1', mode: 'summarize', language: 'en' }, expect.anything())
  })

  it('calls assistConversation with mode: "actions" when Actiepunten is clicked', async () => {
    vi.mocked(assistConversation).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistConversation).mockResolvedValue({ kind: 'actions', items: [] })
    render(<ConversationAssistSection conversationId="conv-1" hasMessages onApply={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Actiepunten' }))
    expect(assistConversation).toHaveBeenCalledWith(expect.objectContaining({ id: 'conv-1', mode: 'actions' }), expect.anything())
  })

  it('is genuinely enabled the moment the thread has messages — no hidden gate beyond hasMessages', () => {
    vi.mocked(assistConversation).mockReset()
    render(<ConversationAssistSection conversationId="conv-1" hasMessages onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Samenvatten' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Actiepunten' })).toBeEnabled()
    expect(screen.queryByText('Dit gesprek heeft nog geen berichten')).toBeNull()
  })

  it('disables both mode buttons when the thread has no messages, with a VISIBLE (non-hover-only) reason', () => {
    vi.mocked(assistConversation).mockReset()
    render(<ConversationAssistSection conversationId="conv-1" hasMessages={false} onApply={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Samenvatten' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Actiepunten' })).toBeDisabled()
    expect(screen.getByText('Dit gesprek heeft nog geen berichten')).toBeInTheDocument()
  })
})

describe('ConversationAssistSection · Overnemen (apply into the composer draft)', () => {
  it('summarize: applies a single-line-collapsed text on Overnemen, never auto-applies before the click', async () => {
    vi.mocked(assistConversation).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistConversation).mockResolvedValue({ kind: 'text', text: 'Line one.\nLine two.' })
    const onApply = vi.fn()
    render(<ConversationAssistSection conversationId="conv-1" hasMessages onApply={onApply} />)
    await user.click(screen.getByRole('button', { name: 'Samenvatten' }))
    // Testing Library normalizes whitespace when matching text, so the raw
    // "\n" in the preview and this query both collapse to a single space.
    await screen.findByText('Line one. Line two.')
    // Never auto-applied — only the explicit click below calls onApply.
    expect(onApply).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Overnemen' }))
    expect(onApply).toHaveBeenCalledWith('Line one. Line two.')
  })

  it('actions: joins items into one "; "-separated line on Overnemen', async () => {
    vi.mocked(assistConversation).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistConversation).mockResolvedValue({
      kind: 'actions',
      items: [
        { title: 'Bel terug', type: 'task', due_date: '2026-08-10', note_excerpt: null },
        { title: 'Stuur bevestiging', type: 'whatsapp', due_date: null, note_excerpt: null },
      ],
    })
    const onApply = vi.fn()
    render(<ConversationAssistSection conversationId="conv-1" hasMessages onApply={onApply} />)
    await user.click(screen.getByRole('button', { name: 'Actiepunten' }))
    await screen.findByText('Bel terug')
    await user.click(screen.getByRole('button', { name: 'Overnemen' }))
    expect(onApply).toHaveBeenCalledWith('Bel terug (Taak · 2026-08-10); Stuur bevestiging (WhatsApp)')
  })

  it('actions with zero items shows a calm "no items" notice and no apply button', async () => {
    vi.mocked(assistConversation).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistConversation).mockResolvedValue({ kind: 'actions', items: [] })
    render(<ConversationAssistSection conversationId="conv-1" hasMessages onApply={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Actiepunten' }))
    await screen.findByText('Geen actiepunten gevonden')
    expect(screen.queryByRole('button', { name: 'Overnemen' })).toBeNull()
  })

  it('Verwerpen (discard) never calls onApply and clears the preview', async () => {
    vi.mocked(assistConversation).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistConversation).mockResolvedValue({ kind: 'text', text: 'Summary.' })
    const onApply = vi.fn()
    render(<ConversationAssistSection conversationId="conv-1" hasMessages onApply={onApply} />)
    await user.click(screen.getByRole('button', { name: 'Samenvatten' }))
    await screen.findByText('Summary.')
    await user.click(screen.getByRole('button', { name: 'Verwerpen' }))
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.queryByText('Summary.')).toBeNull()
  })
})

describe('ConversationAssistSection · failure', () => {
  it('shows the server\'s own message on a 402 budget response and applies nothing', async () => {
    vi.mocked(assistConversation).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistConversation).mockRejectedValue({ response: { status: 402, data: { message: 'Budget op.' } } })
    const onApply = vi.fn()
    render(<ConversationAssistSection conversationId="conv-1" hasMessages onApply={onApply} />)
    await user.click(screen.getByRole('button', { name: 'Samenvatten' }))
    expect(await screen.findByText('Budget op.')).toBeInTheDocument()
    expect(onApply).not.toHaveBeenCalled()
    // The section itself stays visible/usable — never disappears on failure.
    expect(screen.getByRole('button', { name: 'Samenvatten' })).toBeInTheDocument()
  })

  it('shows the server\'s own message on an unrecognisable-actions 422', async () => {
    vi.mocked(assistConversation).mockReset()
    const user = userEvent.setup()
    vi.mocked(assistConversation).mockRejectedValue({ response: { status: 422, data: { message: 'Koios kon geen actiepunten herkennen.' } } })
    render(<ConversationAssistSection conversationId="conv-1" hasMessages onApply={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Actiepunten' }))
    expect(await screen.findByText('Koios kon geen actiepunten herkennen.')).toBeInTheDocument()
  })
})

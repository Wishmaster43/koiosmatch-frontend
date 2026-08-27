/**
 * KoiosFeedback tests — pins the POST /ai/koios/feedback request body (method
 * assertions never just "a callback fired", §13), the promptLogId gate, the
 * down-vote reason+comment flow and an honest failure state (no fake success).
 * Uses the real i18n instance (SCHERMWAARHEID-1 §5): new keys are not in the
 * shipped locales yet, so i18next's own fallback (returning the key) is what
 * gets asserted — never a hardcoded literal for these new strings.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import KoiosFeedback from './KoiosFeedback'
import { sendKoiosFeedback } from './koiosApi'

vi.mock('./koiosApi', () => ({ sendKoiosFeedback: vi.fn() }))
const mockSend = sendKoiosFeedback as unknown as ReturnType<typeof vi.fn>

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string

describe('KoiosFeedback', () => {
  beforeEach(() => { mockSend.mockReset() })

  it('renders nothing when no promptLogId is present', () => {
    const { container } = render(<KoiosFeedback surface="chat" t={t} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('sends an up vote immediately with the exact request body', async () => {
    mockSend.mockResolvedValue({})
    const user = userEvent.setup()
    render(<KoiosFeedback promptLogId="pl-1" surface="chat" t={t} />)
    await user.click(screen.getByLabelText(t('koios.feedback.up', { defaultValue: 'Nuttig' })))
    expect(mockSend).toHaveBeenCalledWith({ prompt_log_id: 'pl-1', surface: 'chat', rating: 'up' })
    await waitFor(() => expect(screen.getByText(t('koios.feedback.thanks', { defaultValue: 'Bedankt voor je feedback' }))).toBeInTheDocument())
  })

  it('locks the vote UI after a successful send (no re-vote)', async () => {
    mockSend.mockResolvedValue({})
    const user = userEvent.setup()
    render(<KoiosFeedback promptLogId="pl-1" surface="chat" t={t} />)
    await user.click(screen.getByLabelText(t('koios.feedback.up', { defaultValue: 'Nuttig' })))
    await waitFor(() => expect(screen.getByText(t('koios.feedback.thanks', { defaultValue: 'Bedankt voor je feedback' }))).toBeInTheDocument())
    expect(screen.queryByLabelText(t('koios.feedback.up', { defaultValue: 'Nuttig' }))).not.toBeInTheDocument()
    expect(screen.queryByLabelText(t('koios.feedback.down', { defaultValue: 'Niet nuttig' }))).not.toBeInTheDocument()
  })

  it('opens the reason picker on down, and sends the selected reasons + comment', async () => {
    mockSend.mockResolvedValue({})
    const user = userEvent.setup()
    render(<KoiosFeedback promptLogId="pl-2" surface="chat" t={t} />)
    await user.click(screen.getByLabelText(t('koios.feedback.down', { defaultValue: 'Niet nuttig' })))
    await user.click(screen.getByText(t('koios.feedback.reasons.inaccurate', { defaultValue: 'inaccurate' })))
    await user.type(screen.getByPlaceholderText(t('koios.feedback.commentPlaceholder', { defaultValue: 'Toelichting (optioneel)' })), 'wrong date')
    await user.click(screen.getByText(t('koios.feedback.send', { defaultValue: 'Versturen' })))
    expect(mockSend).toHaveBeenCalledWith({
      prompt_log_id: 'pl-2', surface: 'chat', rating: 'down', reasons: ['inaccurate'], comment: 'wrong date',
    })
    await waitFor(() => expect(screen.getByText(t('koios.feedback.thanks', { defaultValue: 'Bedankt voor je feedback' }))).toBeInTheDocument())
  })

  // SUPERSEDE (CMBE-gemeten 28-08, KoiosFeedback model): rating=down REQUIRES
  // ≥1 reason (min:1) server-side — sending without one would 422, so the send
  // button stays disabled until a reason is picked.
  it('keeps the down-vote send disabled until at least one reason is picked', async () => {
    const user = userEvent.setup()
    mockSend.mockResolvedValue({})
    render(<KoiosFeedback promptLogId="pl-1" surface="chat" t={t} />)
    await user.click(screen.getByRole('button', { name: t('koios.feedback.down', { defaultValue: 'Niet nuttig' }) }))
    const send = screen.getByRole('button', { name: t('koios.feedback.send', { defaultValue: 'Versturen' }) })
    expect(send).toBeDisabled()
    await user.click(screen.getByText(t('koios.feedback.reasons.incomplete', { defaultValue: 'Onvolledig' })))
    expect(send).toBeEnabled()
  })

  it('shows an honest inline error and never a fake success when the POST fails', async () => {
    mockSend.mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    render(<KoiosFeedback promptLogId="pl-4" surface="chat" t={t} />)
    await user.click(screen.getByLabelText(t('koios.feedback.up', { defaultValue: 'Nuttig' })))
    await waitFor(() => expect(screen.getByText(t('koios.feedback.error', { defaultValue: 'Feedback versturen is niet gelukt. Probeer het opnieuw.' }))).toBeInTheDocument())
    expect(screen.queryByText(t('koios.feedback.thanks', { defaultValue: 'Bedankt voor je feedback' }))).not.toBeInTheDocument()
  })
})

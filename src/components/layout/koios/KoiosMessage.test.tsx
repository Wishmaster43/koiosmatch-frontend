/**
 * KoiosMessage — KOIOS-FEEDBACK-FE-1 coverage: the vote widget renders only
 * when the message carries a `prompt_log_id`, and never on the user's own
 * bubble or on a welcome/error/forbidden notice. Uses the real i18n instance
 * (SCHERMWAARHEID-1 §5) so new-key fallback copy is what gets asserted.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import KoiosMessage from './KoiosMessage'
import type { KoiosChatMessage } from '@/types/koios'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string
const upLabel = t('koios.feedback.up', { defaultValue: 'Nuttig' })

const reply = (over: Partial<KoiosChatMessage> = {}): KoiosChatMessage => ({
  role: 'assistant', answer: 'Hallo daar', ...over,
})

describe('KoiosMessage — feedback gate', () => {
  it('renders the feedback widget when the reply carries a prompt_log_id', () => {
    render(<KoiosMessage msg={reply({ prompt_log_id: 'pl-1' })} t={t} />)
    expect(screen.getByLabelText(upLabel)).toBeInTheDocument()
  })

  it('renders nothing when the reply carries no prompt_log_id', () => {
    render(<KoiosMessage msg={reply()} t={t} />)
    expect(screen.queryByLabelText(upLabel)).not.toBeInTheDocument()
  })

  it('never shows feedback on the user\'s own bubble', () => {
    render(<KoiosMessage msg={{ role: 'user', content: 'Hoi', prompt_log_id: 'pl-2' }} t={t} />)
    expect(screen.queryByLabelText(upLabel)).not.toBeInTheDocument()
  })

  it('never shows feedback on a notice message (e.g. forbidden)', () => {
    render(<KoiosMessage msg={reply({ kind: 'forbidden', prompt_log_id: 'pl-3' })} t={t} />)
    expect(screen.queryByLabelText(upLabel)).not.toBeInTheDocument()
  })
})

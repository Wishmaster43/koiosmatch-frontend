/**
 * KoiosUsage — K-37 (Danny 05-08): the per-message usage line must show the
 * tenant-facing stand name (Snel/Slim/Max) in place of the raw model id echoed
 * back on the chat message. Uses the real i18n instance so this asserts the
 * actual rendered string, not a stubbed translator.
 *
 * KOIOS-MODEL-VOCAB-1 (27-08, re-measured): `msg.model` is the server-RESOLVED
 * vendor id — Policy::resolveModel maps every flavour through the model catalog
 * BEFORE KoiosConversation echoes it, so this footer always receives
 * claude-haiku-4-5/claude-sonnet-5/… and never a flavour key. Fixtures mirror
 * that wire truth; the "unknown" case keeps a genuinely unlisted id.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import KoiosUsage from './KoiosUsage'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string

describe('KoiosUsage — stand name, never the vendor id', () => {
  it('renders the stand label ("Slim") for a known flavour id, not the raw id', () => {
    render(<KoiosUsage model="claude-sonnet-5" usage={{ input_tokens: 10, output_tokens: 20, cost: 0 }} t={t} />)
    expect(screen.getByText(/Slim/)).toBeInTheDocument()
    expect(screen.queryByText(/claude-sonnet-5/)).not.toBeInTheDocument()
  })

  it('falls back to usage.model when the message carries no model of its own', () => {
    render(<KoiosUsage model={null} usage={{ input_tokens: 1, output_tokens: 1, cost: 0, model: 'claude-opus-4-8' }} t={t} />)
    expect(screen.getByText(/Max/)).toBeInTheDocument()
  })

  it('falls back to the raw id for a model outside the known tier whitelist', () => {
    render(<KoiosUsage model="gpt-4o" usage={{ input_tokens: 1, output_tokens: 1, cost: 0 }} t={t} />)
    expect(screen.getByText(/gpt-4o/)).toBeInTheDocument()
  })

  // KOIOS-CHAT: cost must never render, even when the payload carries a non-zero one.
  it('never renders a cost/currency figure', () => {
    render(<KoiosUsage model="slim" usage={{ input_tokens: 10, output_tokens: 20, cost: 1.23, currency: 'EUR' }} t={t} />)
    expect(screen.queryByText(/€/)).not.toBeInTheDocument()
    expect(screen.queryByText(/1[.,]23/)).not.toBeInTheDocument()
  })
})

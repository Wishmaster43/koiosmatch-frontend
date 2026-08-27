/**
 * UsageWhatsAppTab — K-204 regression: `whatsapp.tokens.price_cents` arrived on
 * the wire but was never rendered (Danny: "elke keer is de 0,01 weg"). Asserts
 * the per-token EUR price now shows, converted from cents at the boundary.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import { formatCurrency } from '@/lib/formatters'
import UsageWhatsAppTab from './UsageWhatsAppTab'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

describe('UsageWhatsAppTab', () => {
  it('shows the WhatsApp per-token price when price_cents is present', () => {
    const whatsapp = {
      by_channel: [{ channel: 'wa_web', label: 'WhatsApp Web', messages: 5, tokens: 5, amount: 0.05 }],
      tokens: { used: 5, budget: 250, over: 0, over_amount: 0, price_cents: 1 },
    }
    render(<UsageWhatsAppTab whatsapp={whatsapp} />)
    const eur = formatCurrency(0.01, 'EUR', 'nl-NL', 2, 2).replace(/\u00A0/g, ' ')
    const expected = t('billing.usage.whatsapp.priceCaption', { amount: eur })
    const match = screen.getAllByText((_, el) => el?.textContent?.replace(/\u00A0/g, ' ') === expected)
    expect(match.length).toBeGreaterThan(0)
  })
})

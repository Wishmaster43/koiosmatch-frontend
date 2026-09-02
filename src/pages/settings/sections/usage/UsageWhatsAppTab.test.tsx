/**
 * UsageWhatsAppTab — K-242 (02-09): `whatsapp.by_channel` is INFO only now (a
 * wa_web message counts as a Workflow-token instead of its own meter), so this
 * asserts the message-count table renders and no tokens/price meter appears.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import UsageWhatsAppTab from './UsageWhatsAppTab'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

describe('UsageWhatsAppTab', () => {
  it('renders the per-channel message counts, with no tokens meter or price line', () => {
    const whatsapp = {
      by_channel: [{ channel: 'wa_web', label: 'WhatsApp Web', messages: 5 }],
    }
    render(<UsageWhatsAppTab whatsapp={whatsapp} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.queryByText(t('billing.usage.whatsapp.tokensMeterLabel'))).toBeNull()
    expect(screen.queryByText(/€/)).toBeNull()
  })
})

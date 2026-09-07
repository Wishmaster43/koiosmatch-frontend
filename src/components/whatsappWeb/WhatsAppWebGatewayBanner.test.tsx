/**
 * WhatsAppWebGatewayBanner — nothing while the gateway is fine, the calm
 * "not configured" notice, and the warning when it is configured but down.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WhatsAppWebGatewayBanner from './WhatsAppWebGatewayBanner'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

describe('WhatsAppWebGatewayBanner', () => {
  it('renders nothing without a verdict or with a healthy gateway', () => {
    const { container, rerender } = render(<WhatsAppWebGatewayBanner gateway={null} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<WhatsAppWebGatewayBanner gateway={{ configured: true, reachable: true }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('says the gateway is not configured', () => {
    render(<WhatsAppWebGatewayBanner gateway={{ configured: false, reachable: false }} />)
    expect(screen.getByText('profile.whatsappWeb.gatewayNotConfigured')).toBeInTheDocument()
  })

  it('warns when the gateway is configured but not answering', () => {
    render(<WhatsAppWebGatewayBanner gateway={{ configured: true, reachable: false }} />)
    expect(screen.getByText('profile.whatsappWeb.gatewayUnreachable')).toBeInTheDocument()
  })
})

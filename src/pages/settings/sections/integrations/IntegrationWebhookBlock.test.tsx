/** IntegrationWebhookBlock: hidden without data, then registered / paused / not registered lines. */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import IntegrationWebhookBlock from './IntegrationWebhookBlock'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

describe('IntegrationWebhookBlock', () => {
  // Undefined and null render nothing at all.
  it('is absent without a webhook object', () => {
    const { container, rerender } = render(<IntegrationWebhookBlock webhook={undefined} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<IntegrationWebhookBlock webhook={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  // Registered with a date shows DD-MM-YYYY HH:mm, never ISO.
  it('renders the last-received date', () => {
    render(<IntegrationWebhookBlock webhook={{ registered: true, paused: false, last_received_at: '2026-11-12T10:05:00' }} />)
    expect(screen.getByText(t('integrations.webhook.registered'))).toBeInTheDocument()
    expect(screen.getByText(t('integrations.webhook.lastReceived', { date: '12-11-2026 10:05' }))).toBeInTheDocument()
  })

  // Registered without a date says nothing was received.
  it('renders nothing received yet', () => {
    render(<IntegrationWebhookBlock webhook={{ registered: true, paused: false, last_received_at: null }} />)
    expect(screen.getByText(t('integrations.webhook.nothingReceived'))).toBeInTheDocument()
  })

  // Paused line.
  it('renders the paused line', () => {
    render(<IntegrationWebhookBlock webhook={{ registered: true, paused: true, last_received_at: null }} />)
    expect(screen.getByText(t('integrations.webhook.paused'))).toBeInTheDocument()
  })

  // Not registered line.
  it('renders the not-registered line', () => {
    render(<IntegrationWebhookBlock webhook={{ registered: false, paused: false, last_received_at: null }} />)
    expect(screen.getByText(t('integrations.webhook.notRegistered'))).toBeInTheDocument()
  })
})

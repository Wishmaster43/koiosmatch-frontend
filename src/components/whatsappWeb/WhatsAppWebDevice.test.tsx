/**
 * WhatsAppWebDevice — per-status action visibility, QR rendering while
 * qr_pending, and that the status renders through the mapped SoftChip label
 * (never a raw backend slug).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WhatsAppWebDevice from './WhatsAppWebDevice'
import type { WhatsAppDevice } from './statusMeta'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => opts ? `${k}:${JSON.stringify(opts)}` : k }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))
vi.mock('qrcode.react', () => ({ QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr">{value}</div> }))

const baseDevice: WhatsAppDevice = {
  id: 1, type: 'wa_web', label: 'My phone', phone_number: '+31612345678',
  status: 'disconnected', qr: null, warmup_stage: null, last_connected_at: null,
}

const noop = vi.fn()

describe('WhatsAppWebDevice', () => {
  it('disconnected: shows Connect, hides Disconnect', () => {
    render(<WhatsAppWebDevice device={baseDevice} busy={false} notEnabled={false} onConnect={noop} onDisconnect={noop} onRemove={noop} />)
    expect(screen.getByText('profile.whatsappWeb.connect')).toBeInTheDocument()
    expect(screen.queryByText('profile.whatsappWeb.disconnect')).not.toBeInTheDocument()
    // Status renders through the mapped label, never the raw slug.
    expect(screen.getByText('profile.whatsappWeb.disconnected')).toBeInTheDocument()
    expect(screen.queryByText('disconnected')).not.toBeInTheDocument()
  })

  it('connected: shows Disconnect, hides Connect', () => {
    render(<WhatsAppWebDevice device={{ ...baseDevice, status: 'connected' }} busy={false} notEnabled={false} onConnect={noop} onDisconnect={noop} onRemove={noop} />)
    expect(screen.getByText('profile.whatsappWeb.disconnect')).toBeInTheDocument()
    expect(screen.queryByText('profile.whatsappWeb.connect')).not.toBeInTheDocument()
  })

  it('qr_pending: renders the QR image and the scan hint', () => {
    render(<WhatsAppWebDevice device={{ ...baseDevice, status: 'qr_pending', qr: 'qr-payload' }} busy={false} notEnabled={false} onConnect={noop} onDisconnect={noop} onRemove={noop} />)
    expect(screen.getByTestId('qr')).toHaveTextContent('qr-payload')
    expect(screen.getByText('profile.whatsappWeb.scanHint')).toBeInTheDocument()
  })

  it('remove is always available and carries an aria-label', () => {
    render(<WhatsAppWebDevice device={baseDevice} busy={false} notEnabled={false} onConnect={noop} onDisconnect={noop} onRemove={noop} />)
    expect(screen.getByRole('button', { name: 'profile.whatsappWeb.remove' })).toBeInTheDocument()
  })

  it('a ramping warmup_stage (1/2) renders its chip; stage 0 and an unknown stage render none', () => {
    // Stage 0 means "not warming / full caps" (BE: NumberBudget::isWarming() =
    // warmup_stage > 0) — it must NEVER render a chip, or a fully-ramped device
    // would falsely look like it is still warming up.
    const { rerender } = render(<WhatsAppWebDevice device={{ ...baseDevice, warmup_stage: 0 }} busy={false} notEnabled={false} onConnect={noop} onDisconnect={noop} onRemove={noop} />)
    expect(screen.queryByText(/profile\.whatsappWeb\.warmup\./)).not.toBeInTheDocument()

    rerender(<WhatsAppWebDevice device={{ ...baseDevice, warmup_stage: 1 }} busy={false} notEnabled={false} onConnect={noop} onDisconnect={noop} onRemove={noop} />)
    expect(screen.getByText('profile.whatsappWeb.warmup.1')).toBeInTheDocument()

    rerender(<WhatsAppWebDevice device={{ ...baseDevice, warmup_stage: 99 as never }} busy={false} notEnabled={false} onConnect={noop} onDisconnect={noop} onRemove={noop} />)
    expect(screen.queryByText(/profile\.whatsappWeb\.warmup\./)).not.toBeInTheDocument()
  })

  it('a 501 (gateway not configured) shows the notEnabled notice', () => {
    render(<WhatsAppWebDevice device={baseDevice} busy={false} notEnabled onConnect={noop} onDisconnect={noop} onRemove={noop} />)
    expect(screen.getByText('profile.whatsappWeb.notEnabled')).toBeInTheDocument()
  })
})

// CMBE 25-08: the row also ships warmup {stage,label,daily_cap}; the object wins
// over the bare stage and the cap renders as a caption.
it('reads the warmup object (stage + daily cap) when the server ships it', () => {
  render(<WhatsAppWebDevice device={{ ...baseDevice, warmup_stage: 0, warmup: { stage: 1, label: 'nieuw nummer', daily_cap: 5 } }} busy={false} notEnabled={false} onConnect={noop} onDisconnect={noop} onRemove={noop} />)
  // The test's t() mock appends the options, so match on the key prefix + the server fallback / cap.
  expect(screen.getByText(/^profile\.whatsappWeb\.warmup\.1:.*nieuw nummer/)).toBeInTheDocument()
  expect(screen.getByText(/^profile\.whatsappWeb\.dailyCap:.*"cap":5/)).toBeInTheDocument()
})

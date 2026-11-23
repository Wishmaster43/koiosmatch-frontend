/** IntegrationWebhookBlock: hidden without data, then registered / paused / not registered lines. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import IntegrationWebhookBlock from './IntegrationWebhookBlock'

// Every render needs a QueryClient because the block owns the status hook.
const wrap = (ui: ReactElement) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

describe('IntegrationWebhookBlock', () => {
  // Undefined and null render nothing at all.
  it('is absent without a webhook object', () => {
    const { container, rerender } = render(wrap(<IntegrationWebhookBlock webhook={undefined} />))
    expect(container).toBeEmptyDOMElement()
    rerender(wrap(<IntegrationWebhookBlock webhook={null} />))
    expect(container).toBeEmptyDOMElement()
  })

  // Registered with a date shows DD-MM-YYYY HH:mm, never ISO.
  it('renders the last-received date', () => {
    render(wrap(<IntegrationWebhookBlock webhook={{ registered: true, paused: false, last_received_at: '2026-11-12T10:05:00' }} />))
    expect(screen.getByText(t('integrations.webhook.registered'))).toBeInTheDocument()
    expect(screen.getByText(t('integrations.webhook.lastReceived', { date: '12-11-2026 10:05' }))).toBeInTheDocument()
  })

  // Registered without a date says nothing was received.
  it('renders nothing received yet', () => {
    render(wrap(<IntegrationWebhookBlock webhook={{ registered: true, paused: false, last_received_at: null }} />))
    expect(screen.getByText(t('integrations.webhook.nothingReceived'))).toBeInTheDocument()
  })

  // Paused line.
  it('renders the paused line', () => {
    render(wrap(<IntegrationWebhookBlock webhook={{ registered: true, paused: true, last_received_at: null }} />))
    expect(screen.getByText(t('integrations.webhook.paused'))).toBeInTheDocument()
  })

  // Not registered line.
  it('renders the not-registered line', () => {
    render(wrap(<IntegrationWebhookBlock webhook={{ registered: false, paused: false, last_received_at: null }} />))
    expect(screen.getByText(t('integrations.webhook.notRegistered'))).toBeInTheDocument()
  })
})

// HF-WEBHOOK-FE-1: actions, verified stamp, permission gate, confirm dialog.
const { get, post, del, perm } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn(), perm: { allowed: true } }))
vi.mock('@/lib/api', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api')>()
  return { ...actual, default: { get, post, delete: del } }
})
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => perm.allowed }) }))

const status = (over = {}) => ({ data: { data: { registered: true, registration_id: 'r', filters: [], last_received_at: null, verified_at: '2026-11-12T10:05:00', ...over } } })
const renderBlock = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><IntegrationWebhookBlock webhook={null} connector="helloflex" /></QueryClientProvider>)
}

describe('IntegrationWebhookBlock actions', () => {
  beforeEach(() => { vi.clearAllMocks(); perm.allowed = true; post.mockResolvedValue(status()); del.mockResolvedValue({ data: null }) })

  // verified_at goes through the house formatter.
  it('renders the verified stamp', async () => {
    get.mockResolvedValue(status())
    renderBlock()
    expect(await screen.findByText(t('integrations.webhook.verifiedAt', { date: '12-11-2026 10:05' }))).toBeInTheDocument()
  })

  // Not registered offers Register only, and it POSTs.
  it('offers Register when not registered', async () => {
    get.mockResolvedValue(status({ registered: false, verified_at: null }))
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: t('integrations.webhook.register') }))
    await waitFor(() => expect(post.mock.calls[0][0]).toBe('/integrations/helloflex/webhook'))
    expect(screen.queryByRole('button', { name: t('integrations.webhook.rotate') })).toBeNull()
  })

  // Rotate POSTs without a dialog; Unregister only DELETEs after confirming.
  it('rotates directly and gates unregister behind the dialog', async () => {
    get.mockResolvedValue(status())
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: t('integrations.webhook.rotate') }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(t('integrations.webhook.confirmUnregisterBody'))).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: t('integrations.webhook.unregister') }))
    expect(await screen.findByText(t('integrations.webhook.confirmUnregisterBody'))).toBeInTheDocument()
    expect(del).not.toHaveBeenCalled()
    const confirm = screen.getAllByRole('button', { name: t('integrations.webhook.unregister') }).pop()!
    fireEvent.click(confirm)
    await waitFor(() => expect(del.mock.calls[0][0]).toBe('/integrations/helloflex/webhook'))
  })

  // While a rotate request is pending both action buttons are disabled (the hook's busy flag).
  it('disables the buttons while a request is pending', async () => {
    get.mockResolvedValue(status())
    post.mockReturnValueOnce(new Promise(() => {}))
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: t('integrations.webhook.rotate') }))
    await waitFor(() => expect(screen.getByRole('button', { name: t('integrations.webhook.unregister') })).toBeDisabled())
    expect(screen.getByRole('button', { name: t('integrations.webhook.rotate') })).toBeDisabled()
  })

  // Without settings.update no action buttons render.
  it('hides the buttons without the permission', async () => {
    perm.allowed = false
    get.mockResolvedValue(status())
    renderBlock()
    await screen.findByText(t('integrations.webhook.registered'))
    expect(screen.queryByRole('button')).toBeNull()
  })
})

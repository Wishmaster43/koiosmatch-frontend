/**
 * IncomingWebhooks — regression for WEBHOOK-LOG-FE-2: clicking "Verzoeken
 * bekijken" on a webhook row still opens the request-log overlay
 * (WebhookRequestsPanel), unchanged after the panel's log body moved out to
 * the shared WebhookRequestsLog export.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import IncomingWebhooks from './IncomingWebhooks'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})

// The panel itself is covered by its own tests; stub it here so this test
// only proves the open wiring, not the log's internals.
vi.mock('@/components/webhooks/WebhookRequestsPanel', () => ({
  default: ({ webhookName, onClose }: { webhookName: string; onClose: () => void }) => (
    <div>
      <span>panel-open: {webhookName}</span>
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

const notifyError = vi.hoisted(() => vi.fn())
vi.mock('@/lib/notify', () => ({ notifyError, notifySuccess: vi.fn(), notify: vi.fn() }))

import api from '@/lib/api'

const mockedApi = vi.mocked(api, true)

// Small i18n shorthand for this test's assertions against rendered button names.
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

describe('IncomingWebhooks — request-log open wiring', () => {
  it('opens WebhookRequestsPanel for the clicked webhook on "Verzoeken bekijken"', async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: 'wh-1', name: 'ATS integration', token: 'tok-1' }] })
    const user = userEvent.setup()
    render(<IncomingWebhooks />)

    await waitFor(() => expect(screen.getByText('ATS integration')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('webhooks.incoming.requests.viewButton') }))

    expect(screen.getByText('panel-open: ATS integration')).toBeInTheDocument()
  })
})

// audit r2-ui-states-3: a rejected delete must surface a notice — it used to be swallowed.
describe('IncomingWebhooks — a failed delete tells the admin', () => {
  it('calls notifyError when the DELETE rejects after the confirm dialog', async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: 'wh-1', name: 'ATS integration', token: 'tok-1' }] })
    mockedApi.delete.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    render(<IncomingWebhooks />)
    await waitFor(() => expect(screen.getByText('ATS integration')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: st('webhooks.incoming.removeConfirm') }))
    await user.click(screen.getByRole('button', { name: i18n.t('confirm') }))
    await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith('/webhooks/wh-1'))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(expect.any(String)))
  })
})

// DL-02/WFB-06 (ADOPT-A3b item 20): the one-time signing-secret reveal on create.
describe('IncomingWebhooks — one-time signing-secret reveal', () => {
  it('reveals the signing_secret POST /webhooks returns on create', async () => {
    mockedApi.get.mockResolvedValue({ data: [] })
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'wh-2', name: 'New hook', token: 'tok-2', signing_secret: 'shh-secret' } })
    const user = userEvent.setup()
    render(<IncomingWebhooks />)
    await waitFor(() => expect(screen.getByText(st('webhooks.incoming.empty'))).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText(st('webhooks.incoming.namePlaceholder')), 'New hook')
    await user.click(screen.getByRole('button', { name: st('webhooks.incoming.create') }))

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/webhooks', { name: 'New hook', description: null }))
    expect(screen.getByText('shh-secret')).toBeInTheDocument()
    expect(screen.getByText(st('webhooks.incoming.secretOnce'))).toBeInTheDocument()
  })

  it('does not reveal anything when create returns no signing_secret', async () => {
    mockedApi.get.mockResolvedValue({ data: [] })
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'wh-3', name: 'Quiet hook', token: 'tok-3' } })
    const user = userEvent.setup()
    render(<IncomingWebhooks />)
    await waitFor(() => expect(screen.getByText(st('webhooks.incoming.empty'))).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText(st('webhooks.incoming.namePlaceholder')), 'Quiet hook')
    await user.click(screen.getByRole('button', { name: st('webhooks.incoming.create') }))

    await waitFor(() => expect(screen.getByText('Quiet hook')).toBeInTheDocument())
    expect(screen.queryByText(st('webhooks.incoming.secretOnce'))).toBeNull()
  })
})

// DL-02/WFB-06 (ADOPT-A3b item 20): "Secret vernieuwen" — recovery path for a
// webhook created dead (the one-time reveal was lost).
describe('IncomingWebhooks — Secret vernieuwen (regenerate)', () => {
  it('POSTs the regenerate-secret route after confirm and reveals the new secret', async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: 'wh-1', name: 'ATS integration', token: 'tok-1' }] })
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'wh-1', signing_secret: 'fresh-secret' } })
    const user = userEvent.setup()
    render(<IncomingWebhooks />)
    await waitFor(() => expect(screen.getByText('ATS integration')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('webhooks.incoming.regenerate') }))
    await user.click(screen.getByRole('button', { name: i18n.t('confirm') }))

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/webhooks/wh-1/regenerate-secret'))
    expect(screen.getByText('fresh-secret')).toBeInTheDocument()
  })

  it('calls notifyError when the regenerate POST rejects', async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: 'wh-1', name: 'ATS integration', token: 'tok-1' }] })
    mockedApi.post.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    render(<IncomingWebhooks />)
    await waitFor(() => expect(screen.getByText('ATS integration')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('webhooks.incoming.regenerate') }))
    await user.click(screen.getByRole('button', { name: i18n.t('confirm') }))

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/webhooks/wh-1/regenerate-secret'))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(expect.any(String)))
  })

  // Verifier fix: a 200 without signing_secret must not read as "nothing happened" —
  // the server already rotated the secret, so a silent no-op would strand the webhook.
  it('calls notifyError when the regenerate POST resolves without a signing_secret', async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: 'wh-1', name: 'ATS integration', token: 'tok-1' }] })
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'wh-1' } })
    const user = userEvent.setup()
    render(<IncomingWebhooks />)
    await waitFor(() => expect(screen.getByText('ATS integration')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('webhooks.incoming.regenerate') }))
    await user.click(screen.getByRole('button', { name: i18n.t('confirm') }))

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/webhooks/wh-1/regenerate-secret'))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(expect.any(String)))
  })
})

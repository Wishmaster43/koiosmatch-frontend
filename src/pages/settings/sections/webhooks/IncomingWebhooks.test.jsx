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
  default: ({ webhookName, onClose }) => (
    <div>
      <span>panel-open: {webhookName}</span>
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

import api from '@/lib/api'

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

describe('IncomingWebhooks — request-log open wiring', () => {
  it('opens WebhookRequestsPanel for the clicked webhook on "Verzoeken bekijken"', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'wh-1', name: 'ATS integration', token: 'tok-1' }] })
    const user = userEvent.setup()
    render(<IncomingWebhooks />)

    await waitFor(() => expect(screen.getByText('ATS integration')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('webhooks.incoming.requests.viewButton') }))

    expect(screen.getByText('panel-open: ATS integration')).toBeInTheDocument()
  })
})

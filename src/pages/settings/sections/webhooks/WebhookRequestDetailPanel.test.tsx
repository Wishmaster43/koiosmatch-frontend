/**
 * WebhookRequestDetailPanel.test — WEBHOOK-LOG-FE-1 seam coverage (§13): the
 * detail GET url, a masked header rendering as its own chip, and a 404 (wrong
 * parent webhook — kind-door-ouder) rendering an honest "not found" state
 * distinct from a generic load error.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import api from '@/lib/api'
import WebhookRequestDetailPanel from './WebhookRequestDetailPanel'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { ...actual.default, get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

// Read strings from the REAL (active-language) i18n instance — mirrors
// UsageDailySection.test.tsx / WebhookRequestsPanel.test.tsx.
const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'req-1', method: 'POST', status_code: 200, ip: '203.0.113.5',
  workflow_ids: [], created_at: '2026-08-20T10:15:00.000000Z',
  headers: { 'Content-Type': 'application/json', Authorization: '[MASKED]' },
  query: { token: 'abc' },
  body: '{"foo":"bar"}',
  response_body: '{"ok":true}',
  ...over,
})

describe('WebhookRequestDetailPanel — request seam', () => {
  it('GETs /webhooks/{id}/requests/{requestId}', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: detail() } })
    render(<WebhookRequestDetailPanel webhookId="wh-1" requestId="req-1" onClose={() => {}} />)
    await screen.findByText('{"foo":"bar"}')
    expect(api.get).toHaveBeenCalledWith('/webhooks/wh-1/requests/req-1')
  })
})

describe('WebhookRequestDetailPanel — masked headers', () => {
  it('renders a masked header value as its own chip, not the raw text', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: detail() } })
    render(<WebhookRequestDetailPanel webhookId="wh-1" requestId="req-1" onClose={() => {}} />)

    const chip = await screen.findByTitle(t('webhooks.incoming.requests.detail.maskedTooltip'))
    expect(chip).toHaveTextContent('[MASKED]')
    // The non-masked header still renders its real value as plain text.
    expect(screen.getByText('application/json')).toBeInTheDocument()
  })
})

describe('WebhookRequestDetailPanel — 404 (wrong parent webhook)', () => {
  it('renders an honest not-found state, not the generic load error', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } })
    render(<WebhookRequestDetailPanel webhookId="wh-1" requestId="req-404" onClose={() => {}} />)

    await screen.findByText(t('webhooks.incoming.requests.detail.notFound'))
    expect(screen.queryByText(t('webhooks.incoming.requests.detail.loadError'))).not.toBeInTheDocument()
  })

  it('renders the generic error state for a non-404 failure', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 500 } })
    render(<WebhookRequestDetailPanel webhookId="wh-1" requestId="req-1" onClose={() => {}} />)

    await screen.findByText(t('webhooks.incoming.requests.detail.loadError'))
  })
})

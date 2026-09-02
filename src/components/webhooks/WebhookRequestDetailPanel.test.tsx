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

// Recursive page-gate (Opus lane-3 B2): canAccessPage now walks the full parent
// gate incl. the tenant MODULE check — a test without auth reads as "no modules"
// and hides the runs-link. Grant the module the link's parent page needs.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeTenant: { modules: ['ats', 'aiagents'] } }) }))
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

// WEBHOOK-RUN-CORRELATION-1: named workflows link into the runs view pre-filtered
// on that workflow; older rows carrying only bare ids keep the honest fallback.
describe('WebhookRequestDetailPanel — workflow references', () => {
  // CONTRACT-PENDING (WEBHOOK-DETAIL-WORKFLOWS-1): the detail read does not
  // attach workflows[] yet (raw model, no $appends) — this pins the tolerant
  // FE behaviour for the moment CMBE adds it; today production always takes
  // the ids-only fallback below.
  it('renders a named workflow as a link into its own filtered run history', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: detail({
      workflow_ids: ['wf-1'], workflows: [{ id: 'wf-1', name: 'Vacancy Reminder Flow' }],
    }) } })
    render(<WebhookRequestDetailPanel webhookId="wh-1" requestId="req-1" onClose={() => {}} />)

    const link = await screen.findByRole('link', { name: 'Vacancy Reminder Flow' })
    expect(link).toHaveAttribute('href', '#details.runs?workflow_id=wf-1')
  })

  it('falls back to the ids-only reference when the row carries no named workflows', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: detail({ workflow_ids: ['wf-9'] }) } })
    render(<WebhookRequestDetailPanel webhookId="wh-1" requestId="req-1" onClose={() => {}} />)

    await screen.findByText('#wf-9')
    expect(screen.getByRole('link', { name: t('webhooks.incoming.requests.openHistory') })).toHaveAttribute('href', '#details.runs')
  })

  // Opus round 2 crash guard: the recorder stores workflow_ids as NULL for a
  // request that matched no workflow (401 signature-rejected, bare 200) — the
  // panel must render the detail, simply without a workflows section.
  it('renders a detail whose workflow_ids is null without crashing', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: detail({ workflow_ids: null }) } })
    render(<WebhookRequestDetailPanel webhookId="wh-1" requestId="req-1" onClose={() => {}} />)

    await screen.findByText('{"foo":"bar"}')
    expect(screen.queryByText(t('webhooks.incoming.requests.detail.workflows'))).toBeNull()
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

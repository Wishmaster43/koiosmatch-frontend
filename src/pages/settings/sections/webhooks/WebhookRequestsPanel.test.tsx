/**
 * WebhookRequestsPanel.test — WEBHOOK-LOG-FE-1 seam coverage (§13: assert the
 * REQUEST, never only that a callback fired). Covers the list GET url + page
 * param, the status-code → SoftChip semantics (401 renders the danger chip),
 * and a pagination click re-fetching the next page.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import WebhookRequestsPanel from './WebhookRequestsPanel'

// Partial mock: fake the HTTP verb, keep the real unwrap/unwrapList (they read
// res.data.data / res.data.meta), mirroring UsageDailySection.test.tsx.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { ...actual.default, get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

// Read strings from the REAL (active-language) i18n instance, never a hardcoded
// English literal — the test suite's default language is 'nl' (mirrors
// UsageDailySection.test.tsx's own `t` helper).
const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
const tc = (key: string) => i18n.t(key, { ns: 'common' })

// One list row — the summary shape only (no headers/body per contract).
const row = (over: Record<string, unknown> = {}) => ({
  id: 'req-1', method: 'POST', status_code: 200, ip: '203.0.113.5',
  workflow_ids: ['wf-1'], created_at: '2026-08-20T10:15:00.000000Z', ...over,
})

// Real Laravel paginator envelope shape.
const page = (rows: unknown[], over: Record<string, unknown> = {}) => ({
  data: { data: rows, meta: { current_page: 1, last_page: 1, per_page: 50, total: rows.length, ...over } },
})

function mockList(rows: unknown[], meta: Record<string, unknown> = {}) {
  vi.mocked(api.get).mockResolvedValue(page(rows, meta))
}

describe('WebhookRequestsPanel — request seam', () => {
  it('GETs /webhooks/{id}/requests with page=1', async () => {
    mockList([row()])
    render(<WebhookRequestsPanel webhookId="wh-1" webhookName="ATS intake" onClose={() => {}} />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/webhooks/wh-1/requests', expect.objectContaining({ params: { page: 1, per_page: 50 } }),
    ))
  })

  it('clicking next page re-fetches page=2', async () => {
    const user = userEvent.setup()
    // Two pages so "next" is enabled.
    mockList([row({ id: 'req-1' })], { last_page: 2, total: 60 })
    render(<WebhookRequestsPanel webhookId="wh-1" webhookName="ATS intake" onClose={() => {}} />)
    await screen.findByText('POST')

    await user.click(screen.getByTitle(tc('nextPage')))
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(
      '/webhooks/wh-1/requests', expect.objectContaining({ params: { page: 2, per_page: 50 } }),
    ))
  })
})

describe('WebhookRequestsPanel — status semantics', () => {
  it('renders a 401 row as the danger chip with the rejected tooltip', async () => {
    mockList([row({ id: 'req-401', status_code: 401 })])
    render(<WebhookRequestsPanel webhookId="wh-1" webhookName="ATS intake" onClose={() => {}} />)

    const chip = await screen.findByTitle(t('webhooks.incoming.requests.status.rejected'))
    expect(chip).toHaveTextContent('401')
    // §4: the SoftChip ink is derived from the danger token via chipInk (color-mix).
    expect(chip.getAttribute('style')).toContain('--color-danger')
  })

  it('renders a 200 row as the success chip with the received tooltip', async () => {
    mockList([row({ id: 'req-200', status_code: 200 })])
    render(<WebhookRequestsPanel webhookId="wh-1" webhookName="ATS intake" onClose={() => {}} />)

    const chip = await screen.findByTitle(t('webhooks.incoming.requests.status.received'))
    expect(chip.getAttribute('style')).toContain('--color-success')
  })
})

describe('WebhookRequestsPanel — four UI states', () => {
  it('shows the empty state when no requests exist', async () => {
    mockList([])
    render(<WebhookRequestsPanel webhookId="wh-1" webhookName="ATS intake" onClose={() => {}} />)
    await screen.findByText(t('webhooks.incoming.requests.empty'))
  })

  it('shows a retry control when the list fails to load', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network down'))
    render(<WebhookRequestsPanel webhookId="wh-1" webhookName="ATS intake" onClose={() => {}} />)
    await screen.findByText(t('webhooks.incoming.requests.loadError'))
    expect(screen.getByRole('button', { name: new RegExp(t('webhooks.outgoing.retry')) })).toBeInTheDocument()
  })
})

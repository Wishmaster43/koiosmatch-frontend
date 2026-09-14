/**
 * WebhookCreate — the create-subscription REQUEST, asserted as method/route/body
 * (§13), not just "a callback fired". Regression for the blocker fix: the form
 * used to send `event_types` where the backend's StoreWebhookSubscriptionRequest
 * validates `events` (required|array|min:1) — a wrong field name that a 422 would
 * catch live, but every unit test here stayed green because none of them ever
 * inspected the POST body.
 */
import type { ReactElement } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import WebhookCreate from './WebhookCreate'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

import api from '@/lib/api'

// Resolve the active locale's own copy so assertions never hardcode a language.
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

// EventCatalog fetches the live GET /webhook-events catalog — one event is enough for select-all.
beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: [
    { key: 'candidate.created', label: 'Candidate created', group: 'candidates', pii: false },
  ] } })
})
afterEach(() => vi.clearAllMocks())

// Fresh QueryClient per render — no cross-test cache bleed, no retries slowing failures.
function renderWithQueryClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

// Fill name + URL, select every event via the catalog's own "select all", then submit.
const fillAndSubmit = async (user: UserEvent) => {
  await user.type(screen.getByLabelText(st('webhooks.outgoing.field.name')), 'ATS integration')
  await user.type(screen.getByLabelText(st('webhooks.outgoing.field.url')), 'https://example.test/hook')
  await waitFor(() => screen.getByRole('button', { name: st('webhooks.events.selectAll') }))
  await user.click(screen.getByRole('button', { name: st('webhooks.events.selectAll') }))
  await user.click(screen.getByRole('button', { name: st('webhooks.outgoing.create') }))
}

describe('WebhookCreate — the create request', () => {
  it('POSTs /webhook-subscriptions with an `events` array in the body, never `event_types`', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'wh-1', name: 'ATS integration', url: 'https://example.test/hook', events: ['candidate.created'], secret: 'shh' } })
    const user = userEvent.setup()
    renderWithQueryClient(<WebhookCreate onBack={vi.fn()} onCreated={vi.fn()} />)

    await fillAndSubmit(user)

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    const [route, body] = vi.mocked(api.post).mock.calls[0] as [string, { events: string[]; event_types?: unknown }]
    expect(route).toBe('/webhook-subscriptions')
    expect(body).toHaveProperty('events')
    expect(Array.isArray(body.events)).toBe(true)
    expect(body.events.length).toBeGreaterThan(0)
    expect(body).not.toHaveProperty('event_types')
  })

  it('carries the exact name/url alongside the events array', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'wh-1', secret: 'shh' } })
    const user = userEvent.setup()
    renderWithQueryClient(<WebhookCreate onBack={vi.fn()} onCreated={vi.fn()} />)

    await fillAndSubmit(user)

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/webhook-subscriptions',
      expect.objectContaining({ name: 'ATS integration', url: 'https://example.test/hook' })))
  })

  it('displays the signing_secret from the create response in the one-time reveal', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'wh-1', name: 'ATS integration', signing_secret: 'sk_live_xyz123abc' } })
    const user = userEvent.setup()
    renderWithQueryClient(<WebhookCreate onBack={vi.fn()} onCreated={vi.fn()} />)

    await fillAndSubmit(user)

    await waitFor(() => {
      const secretDisplay = screen.getByText('sk_live_xyz123abc')
      expect(secretDisplay).toBeInTheDocument()
    })
  })

  it('falls back to legacy secret field when signing_secret is absent', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'wh-1', name: 'ATS integration', secret: 'legacy_secret_xyz' } })
    const user = userEvent.setup()
    renderWithQueryClient(<WebhookCreate onBack={vi.fn()} onCreated={vi.fn()} />)

    await fillAndSubmit(user)

    await waitFor(() => {
      const secretDisplay = screen.getByText('legacy_secret_xyz')
      expect(secretDisplay).toBeInTheDocument()
    })
  })
})

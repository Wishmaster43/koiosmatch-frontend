/**
 * WebhookDetail — tests for the regenerate-secret flow, ensuring the
 * signing_secret response field is correctly extracted for the one-time reveal.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import WebhookDetail from './WebhookDetail'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

import api from '@/lib/api'

// Resolve the active locale's own copy so assertions never hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// Fresh QueryClient per render — no cross-test cache bleed.
function renderWithQueryClient(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('WebhookDetail — secret regeneration', () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ data: {
      id: 'wh-1',
      name: 'ATS integration',
      url: 'https://example.test/hook',
      events: ['candidate.created'],
      status: 'active',
    } })
  })
  afterEach(() => vi.clearAllMocks())

  it('displays the signing_secret from the regenerate response in the one-time banner', async () => {
    const user = userEvent.setup()
    const listRow = {
      id: 'wh-1',
      name: 'ATS integration',
      url: 'https://example.test/hook',
      events: ['candidate.created'],
      status: 'active',
    }
    renderWithQueryClient(
      <WebhookDetail
        subId="wh-1"
        listRow={listRow}
        onBack={vi.fn()}
        onPatch={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    api.post.mockResolvedValue({ data: { signing_secret: 'sk_live_rotated_xyz123' } })

    // Open the action menu and click regenerate.
    await waitFor(() => screen.getByRole('button', { name: st('webhooks.outgoing.action') }))
    await user.click(screen.getByRole('button', { name: st('webhooks.outgoing.action') }))
    await user.click(screen.getByRole('menuitem', { name: st('webhooks.outgoing.regenerate') }))

    await waitFor(() => {
      const secretDisplay = screen.getByText('sk_live_rotated_xyz123')
      expect(secretDisplay).toBeInTheDocument()
    })
  })

  it('falls back to legacy secret field when signing_secret is absent in regenerate response', async () => {
    const user = userEvent.setup()
    const listRow = {
      id: 'wh-1',
      name: 'ATS integration',
      url: 'https://example.test/hook',
      events: ['candidate.created'],
      status: 'active',
    }
    renderWithQueryClient(
      <WebhookDetail
        subId="wh-1"
        listRow={listRow}
        onBack={vi.fn()}
        onPatch={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    api.post.mockResolvedValue({ data: { secret: 'legacy_rotated_secret' } })

    // Open the action menu and click regenerate.
    await waitFor(() => screen.getByRole('button', { name: st('webhooks.outgoing.action') }))
    await user.click(screen.getByRole('button', { name: st('webhooks.outgoing.action') }))
    await user.click(screen.getByRole('menuitem', { name: st('webhooks.outgoing.regenerate') }))

    await waitFor(() => {
      const secretDisplay = screen.getByText('legacy_rotated_secret')
      expect(secretDisplay).toBeInTheDocument()
    })
  })

  it('sends status toggle with the correct PATCH body (active → disabled)', async () => {
    const user = userEvent.setup()
    const listRow = {
      id: 'wh-1',
      name: 'ATS integration',
      url: 'https://example.test/hook',
      events: ['candidate.created'],
      status: 'active',
    }
    const onPatch = vi.fn()
    renderWithQueryClient(
      <WebhookDetail
        subId="wh-1"
        listRow={listRow}
        onBack={vi.fn()}
        onPatch={onPatch}
        onDelete={vi.fn()}
      />
    )

    api.put.mockResolvedValue({ data: { status: 'disabled' } })

    // Open the action menu and click the status toggle.
    await waitFor(() => screen.getByRole('button', { name: st('webhooks.outgoing.action') }))
    await user.click(screen.getByRole('button', { name: st('webhooks.outgoing.action') }))
    await user.click(screen.getByRole('menuitem', { name: st('webhooks.outgoing.deactivate') }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(expect.stringContaining('/wh-1'), { status: 'disabled' })
    })
  })
})

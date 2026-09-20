/**
 * WebhookDetail — tests for the regenerate-secret flow, ensuring the
 * signing_secret response field is correctly extracted for the one-time reveal.
 */
import type { ReactElement } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import WebhookDetail from './WebhookDetail'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const notifyError = vi.hoisted(() => vi.fn())
vi.mock('@/lib/notify', () => ({ notifyError, notifySuccess: vi.fn(), notify: vi.fn() }))

import api from '@/lib/api'

// Resolve the active locale's own copy so assertions never hardcode a language.
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

// AUDIT-BE-1-15: regenerate now stages the house ConfirmDialog (never native
// window.confirm) before rotating the secret — open the menu, click regenerate,
// then resolve the dialog by clicking Confirm or Cancel inside it.
const clickRegenerate = async (user: ReturnType<typeof userEvent.setup>, { accept = true }: { accept?: boolean } = {}) => {
  await waitFor(() => screen.getByRole('button', { name: st('webhooks.outgoing.action') }))
  await user.click(screen.getByRole('button', { name: st('webhooks.outgoing.action') }))
  await user.click(screen.getByRole('menuitem', { name: st('webhooks.outgoing.regenerate') }))
  const dialog = await screen.findByRole('dialog', { name: st('webhooks.outgoing.regenerateConfirm') })
  await user.click(within(dialog).getByRole('button', { name: accept ? ct('confirm') : ct('cancel') }))
}

// Fresh QueryClient per render — no cross-test cache bleed.
function renderWithQueryClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('WebhookDetail — secret regeneration', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: {
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
      status: 'active' as const,
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

    vi.mocked(api.post).mockResolvedValue({ data: { signing_secret: 'sk_live_rotated_xyz123' } })

    await clickRegenerate(user)

    await waitFor(() => {
      const secretDisplay = screen.getByText('sk_live_rotated_xyz123')
      expect(secretDisplay).toBeInTheDocument()
    })
  })

  it('declining the confirm dialog never rotates the secret', async () => {
    const user = userEvent.setup()
    const listRow = {
      id: 'wh-1',
      name: 'ATS integration',
      url: 'https://example.test/hook',
      events: ['candidate.created'],
      status: 'active' as const,
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

    await clickRegenerate(user, { accept: false })

    expect(api.post).not.toHaveBeenCalled()
  })

  it('falls back to legacy secret field when signing_secret is absent in regenerate response', async () => {
    const user = userEvent.setup()
    const listRow = {
      id: 'wh-1',
      name: 'ATS integration',
      url: 'https://example.test/hook',
      events: ['candidate.created'],
      status: 'active' as const,
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

    vi.mocked(api.post).mockResolvedValue({ data: { secret: 'legacy_rotated_secret' } })

    await clickRegenerate(user)

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
      status: 'active' as const,
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

    vi.mocked(api.put).mockResolvedValue({ data: { status: 'disabled' } })

    // Open the action menu and click the status toggle.
    await waitFor(() => screen.getByRole('button', { name: st('webhooks.outgoing.action') }))
    await user.click(screen.getByRole('button', { name: st('webhooks.outgoing.action') }))
    await user.click(screen.getByRole('menuitem', { name: st('webhooks.outgoing.deactivate') }))

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(expect.stringContaining('/wh-1'), { status: 'disabled' })
    })
  })
})

// audit r2c-settings-a: saveDetails/saveEvents/regenerate/remove used to swallow
// a rejected request with an empty catch, leaving the admin with no signal.
describe('WebhookDetail — a rejected mutation tells the admin', () => {
  const listRow = {
    id: 'wh-1',
    name: 'ATS integration',
    url: 'https://example.test/hook',
    events: ['candidate.created'],
    status: 'active' as const,
  }
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: listRow })
  })
  afterEach(() => vi.clearAllMocks())

  it('calls notifyError when saving the name/url card rejects', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<WebhookDetail subId="wh-1" listRow={listRow} onBack={vi.fn()} onPatch={vi.fn()} onDelete={vi.fn()} />)
    await waitFor(() => screen.getByRole('button', { name: st('webhooks.outgoing.edit') }))
    await user.click(screen.getByRole('button', { name: st('webhooks.outgoing.edit') }))
    vi.mocked(api.put).mockRejectedValueOnce(new Error('boom'))
    // Two "Save" buttons render at once (details card + event-filter SaveButton) —
    // the details one is the first in DOM order.
    await user.click(screen.getAllByRole('button', { name: st('common.save') })[0])
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(expect.any(String)))
  })

  it('calls notifyError when saving the event filter rejects', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<WebhookDetail subId="wh-1" listRow={listRow} onBack={vi.fn()} onPatch={vi.fn()} onDelete={vi.fn()} />)
    await waitFor(() => screen.getByText(st('webhooks.outgoing.field.events')))
    // Dirty the event filter via the catalog's own "select all" toggle.
    await user.click(screen.getByRole('button', { name: st('webhooks.events.selectAll') }))
    vi.mocked(api.put).mockRejectedValueOnce(new Error('boom'))
    await user.click(screen.getByRole('button', { name: st('common.save') }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(expect.any(String)))
  })

  it('calls notifyError when regenerate rejects', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<WebhookDetail subId="wh-1" listRow={listRow} onBack={vi.fn()} onPatch={vi.fn()} onDelete={vi.fn()} />)
    vi.mocked(api.post).mockRejectedValueOnce(new Error('boom'))
    await clickRegenerate(user)
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(expect.any(String)))
  })

  it('calls notifyError when delete rejects', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<WebhookDetail subId="wh-1" listRow={listRow} onBack={vi.fn()} onPatch={vi.fn()} onDelete={vi.fn()} />)
    vi.mocked(api.delete).mockRejectedValueOnce(new Error('boom'))
    await waitFor(() => screen.getByRole('button', { name: st('webhooks.outgoing.action') }))
    await user.click(screen.getByRole('button', { name: st('webhooks.outgoing.action') }))
    await user.click(screen.getByRole('menuitem', { name: st('webhooks.outgoing.delete') }))
    const dialog = await screen.findByRole('dialog', { name: st('webhooks.outgoing.deleteConfirm', { name: 'ATS integration' }) })
    await user.click(within(dialog).getByRole('button', { name: ct('confirm') }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(expect.any(String)))
  })
})

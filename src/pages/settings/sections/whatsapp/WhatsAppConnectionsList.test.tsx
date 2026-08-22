/**
 * WhatsAppConnectionsList.test — WA-VESTIGING-FE-1 seam coverage (§13: assert the
 * REQUEST, and where the flow reads back, the refetched value — never only that a
 * callback fired). Covers the four UI states, the scope-chip resolution (everyone /
 * branch / role), promoting a default (PATCHes then RE-FETCHES — never hand-
 * reconciled locally), delete, and that no secret value ever reaches the DOM.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import WhatsAppConnectionsList from './WhatsAppConnectionsList'
import type { WhatsappConnectionRow } from '@/types/whatsapp'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { ...actual.default, get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// react-query-backed lookup, mocked directly (no QueryClientProvider needed).
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'loc-1', label: 'Yesway Zorg' }],
}))
// The users barrel (§2 public surface) — mocked flat with exactly what the
// create/edit form (rendered inside this list) uses.
vi.mock('@/pages/users/shared', () => ({
  useAssignableRoles: () => ({ roles: [{ id: 'r1', name: 'recruiter' }], loading: false }),
  // Flat barrel mock (§2 TESTLES) — identity passthrough is enough here.
  roleLabel: (_t: unknown, name: string) => name,
}))

// Resolve the active locale's own copy so assertions never hardcode a language.
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const row = (over: Partial<WhatsappConnectionRow> = {}): WhatsappConnectionRow => ({
  id: 'conn-1', waba_id: '10229012934', label: null, location_id: null, role_name: null,
  is_default: false, has_verify_token: false, provider: 'meta', status: 'active', ...over,
})

const baseProps = {
  loading: false, error: false,
  reload: vi.fn(), removeLocal: vi.fn(),
  canManage: true,
}

describe('WhatsAppConnectionsList · WA-VESTIGING-FE-1 · four UI states', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loading', () => {
    render(<WhatsAppConnectionsList {...baseProps} connections={[]} loading />)
    expect(screen.getByText(st('whatsapp.loading'))).toBeInTheDocument()
  })

  it('error', () => {
    render(<WhatsAppConnectionsList {...baseProps} connections={[]} error />)
    expect(screen.getByText(st('whatsapp.loadListFailed'))).toBeInTheDocument()
  })

  it('empty — invites creating the first token', () => {
    render(<WhatsAppConnectionsList {...baseProps} connections={[]} />)
    expect(screen.getByText(st('whatsapp.noConnections'))).toBeInTheDocument()
    expect(screen.getByText(st('whatsapp.noConnectionsDesc'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: st('whatsapp.addConnection') })).toBeInTheDocument()
  })

  it('success — renders one row per connection', () => {
    render(<WhatsAppConnectionsList {...baseProps} connections={[row(), row({ id: 'conn-2', waba_id: '999' })]} />)
    expect(screen.getByText('10229012934')).toBeInTheDocument()
    expect(screen.getByText('999')).toBeInTheDocument()
  })
})

describe('WhatsAppConnectionsList · scope chip', () => {
  beforeEach(() => vi.clearAllMocks())

  it('everyone (both scope fields empty)', () => {
    render(<WhatsAppConnectionsList {...baseProps} connections={[row()]} />)
    expect(screen.getByText(st('whatsapp.scopeEveryone'))).toBeInTheDocument()
  })

  it('one branch — resolves the location id to its name', () => {
    render(<WhatsAppConnectionsList {...baseProps} connections={[row({ location_id: 'loc-1' })]} />)
    expect(screen.getByText('Yesway Zorg')).toBeInTheDocument()
  })

  it('one role — shows the role name directly', () => {
    render(<WhatsAppConnectionsList {...baseProps} connections={[row({ role_name: 'recruiter' })]} />)
    expect(screen.getByText('recruiter')).toBeInTheDocument()
  })

  it('has_verify_token indicator flips label honestly', () => {
    const { rerender } = render(<WhatsAppConnectionsList {...baseProps} connections={[row({ has_verify_token: true })]} />)
    expect(screen.getByText(st('whatsapp.verifyTokenSet'))).toBeInTheDocument()
    rerender(<WhatsAppConnectionsList {...baseProps} connections={[row({ has_verify_token: false })]} />)
    expect(screen.getByText(st('whatsapp.verifyTokenUnset'))).toBeInTheDocument()
  })
})

describe('WhatsAppConnectionsList · mutations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('promoting a row PATCHes is_default:true and RE-FETCHES the list (never hand-reconciled)', async () => {
    const reload = vi.fn().mockResolvedValue(undefined)
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<WhatsAppConnectionsList {...baseProps} reload={reload} connections={[row()]} />)

    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/whatsapp/conn-1', { is_default: true }))
    // The list never hand-reconciles the flag itself — it re-fetches the whole list instead.
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
  })

  it('checking connection status POSTs check-status then re-fetches', async () => {
    const reload = vi.fn().mockResolvedValue(undefined)
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<WhatsAppConnectionsList {...baseProps} reload={reload} connections={[row()]} />)

    await user.click(screen.getByRole('button', { name: st('whatsapp.checkStatus') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp/conn-1/check-status'))
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
  })

  it('delete asks for confirmation, then DELETEs and removes the row locally (no reload needed)', async () => {
    const removeLocal = vi.fn()
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<WhatsAppConnectionsList {...baseProps} removeLocal={removeLocal} connections={[row()]} />)

    await user.click(screen.getByRole('button', { name: i18n.t('delete', { ns: 'common' }) }))
    await user.click(await screen.findByRole('button', { name: i18n.t('confirm', { ns: 'common' }) }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/whatsapp/conn-1'))
    await waitFor(() => expect(removeLocal).toHaveBeenCalledWith('conn-1'))
  })

  it('hides every mutation affordance for a viewer without whatsapp.manage', () => {
    render(<WhatsAppConnectionsList {...baseProps} canManage={false} connections={[row()]} />)
    expect(screen.queryByRole('button', { name: st('whatsapp.addConnection') })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: st('common.setDefault') })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: st('common.edit') })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: i18n.t('delete', { ns: 'common' }) })).not.toBeInTheDocument()
  })

  it('opening "+ Add" shows the create form; no secret value is ever rendered in the DOM', async () => {
    const user = userEvent.setup()
    render(<WhatsAppConnectionsList {...baseProps} connections={[row({ label: 'Yesway Flex' })]} />)
    await user.click(screen.getByRole('button', { name: st('whatsapp.addConnection') }))
    expect(screen.getByText(st('whatsapp.formTitleCreate'))).toBeInTheDocument()
  })

  // §8 safety net (Opus F1 — the earlier version was vacuous: the fixture carried
  // no secrets, so the absence assertion could never fail). Here a HOSTILE row
  // carries all three secret-shaped values; nothing may reach the DOM, and the
  // edit form's secret inputs must initialise EMPTY (never echo).
  it('never renders a secret carried on the row, and the edit form never echoes one', async () => {
    const user = userEvent.setup()
    const hostile = row({
      label: 'Yesway Flex',
      ...({ access_token: 'EAAG-LEAK-ACCESS', app_secret: 'LEAK-APP-SECRET',
            webhook_verify_token: 'LEAK-VERIFY-TOKEN' } as Partial<WhatsappConnectionRow>),
    })
    render(<WhatsAppConnectionsList {...baseProps} connections={[hostile]} />)
    expect(document.body.innerHTML).not.toContain('EAAG-LEAK-ACCESS')
    expect(document.body.innerHTML).not.toContain('LEAK-APP-SECRET')
    expect(document.body.innerHTML).not.toContain('LEAK-VERIFY-TOKEN')

    await user.click(screen.getByRole('button', { name: i18n.t('edit', { ns: 'common' }) }))
    // The three secret inputs are password-typed and start empty — blank = unchanged.
    const secretInputs = Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[]
    expect(secretInputs).toHaveLength(3)
    for (const input of secretInputs) expect(input.value).toBe('')
    expect(document.body.innerHTML).not.toContain('EAAG-LEAK-ACCESS')
  })
})

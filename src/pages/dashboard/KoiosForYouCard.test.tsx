/**
 * KoiosForYouCard — §13 coverage for the "Koios deed dit voor jou" dashboard
 * card (KOIOS-KAART-COMPACT-2, backend contract K-174): the default "this
 * week" range fires with from/to, the period presets recompute the range, the
 * four UI states (loading/error/empty/success) render distinctly, a KPI tile
 * click reveals that category's action table, a row with a mapped entity_type
 * links to its record + opens a new tab via the deep link, an unmapped
 * entity_type renders plain text, and actions_truncated shows the honest
 * "first 200 shown" notice. NL-label pinning lives in the sibling
 * KoiosForYouCard.i18n.test.tsx, which uses the real i18n runtime.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ComponentProps, ReactNode } from 'react'
import KoiosForYouCard from './KoiosForYouCard'

// Identity translations — this test asserts on state/structure, not copy
// (mirrors Dashboard.test.tsx's approach).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// Avoid real locale-dependent formatting / the @/i18n side-effect import
// (same reasoning as Dashboard.test.tsx).
vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (n: number) => String(n) }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: unknown) => String(v), formatDateTime: (v: unknown) => String(v) }) }))

// Preserve the real `unwrap` (used by the card's queryFn) — only the network
// call is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
import api from '@/lib/api'
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>

// One fresh QueryClient per render — no cross-test cache leakage; retry:false
// keeps a rejected fetch fast.
function renderCard(props: Partial<ComponentProps<typeof KoiosForYouCard>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return render(<KoiosForYouCard {...props} />, { wrapper })
}

const emptyReport = { from: '2026-08-24', to: '2026-08-24', period: 'range', actions_total: 0, per_type: {}, per_source: {}, actions: [], actions_truncated: false }

// Pin "now" to a Monday-anchored week for a deterministic default range.
// 2026-08-24 is a Monday.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-26T10:00:00Z')) // Wednesday
})

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('KoiosForYouCard', () => {
  it('defaults to "this week" (Monday through today) and fetches from/to', async () => {
    apiGet.mockResolvedValue({ data: emptyReport })
    renderCard()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))
    expect(apiGet).toHaveBeenCalledWith('/ai/koios/for-you', expect.objectContaining({ params: { from: '2026-08-24', to: '2026-08-26' } }))
  })

  it('switches to the 30-day preset via the period picker', async () => {
    apiGet.mockResolvedValue({ data: emptyReport })
    renderCard()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('radio', { name: 'koiosForYou.periodPreset.last30' }))

    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2))
    expect(apiGet).toHaveBeenLastCalledWith('/ai/koios/for-you', expect.objectContaining({ params: { from: '2026-07-28', to: '2026-08-26' } }))
  })

  it('shows the loading state while the request is in flight', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    apiGet.mockReturnValue(new Promise((resolve) => { resolveFn = resolve }))
    renderCard()
    expect(screen.getByText('common:loading')).toBeInTheDocument()
    resolveFn({ data: emptyReport })
    await waitFor(() => expect(screen.queryByText('common:loading')).not.toBeInTheDocument())
  })

  it('renders a calm empty state when actions_total is 0', async () => {
    apiGet.mockResolvedValue({ data: emptyReport })
    renderCard()
    await waitFor(() => expect(screen.getByText('koiosForYou.empty')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders a calm error notice with a working retry on failure', async () => {
    apiGet.mockRejectedValue(new Error('network down'))
    renderCard()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('koiosForYou.loadError'))

    apiGet.mockResolvedValue({ data: emptyReport })
    fireEvent.click(screen.getByRole('button', { name: /error\.retry/ }))
    await waitFor(() => expect(screen.getByText('koiosForYou.empty')).toBeInTheDocument())
  })

  const reportWithActions = {
    from: '2026-08-24', to: '2026-08-26', period: 'range',
    actions_total: 3,
    per_type: { koios_create_task: 2, koios_send_whatsapp: 1 },
    per_source: { note: 2, chat: 1 },
    actions: [
      { id: 'a1', type: 'koios_create_task', source: 'note:abc', executed_at: '2026-08-24T10:00:00Z', status: 'completed', created: { entity_type: 'task', entity_id: 42, label: 'Follow up' } },
      { id: 'a2', type: 'koios_create_task', source: 'note:abc', executed_at: '2026-08-25T10:00:00Z', status: 'failed', created: null },
      { id: 'a3', type: 'koios_send_whatsapp', source: 'chat', executed_at: '2026-08-26T10:00:00Z', status: 'completed', created: { entity_type: 'appointment', entity_id: 7, label: 'Intake' } },
    ],
    actions_truncated: false,
  }

  it('renders KPI tiles by default — no table until a tile is selected', async () => {
    apiGet.mockResolvedValue({ data: reportWithActions })
    renderCard()
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
    expect(screen.getByText('koiosForYou.category.tasks')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    // No table (no column headers) while nothing is selected.
    expect(screen.queryByText('koiosForYou.col.action')).not.toBeInTheDocument()
  })

  it('selecting a category tile reveals its action table with the mapped record link', async () => {
    apiGet.mockResolvedValue({ data: reportWithActions })
    renderCard()
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())

    fireEvent.click(screen.getByText('koiosForYou.category.tasks'))

    expect(screen.getByText('koiosForYou.col.action')).toBeInTheDocument()
    expect(screen.getByText('Follow up')).toBeInTheDocument()
    // The task row's new-tab icon button links to the tasks deep link.
    const link = screen.getByRole('link', { name: 'common:openInNewTab' })
    expect(link).toHaveAttribute('href', expect.stringContaining('#tasks?open=42'))
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    // Row with created: null renders a plain dash, no link.
    expect(screen.queryAllByRole('link')).toHaveLength(1)
  })

  it('an unknown/unmapped entity_type (e.g. appointment) renders plain text, no link', async () => {
    apiGet.mockResolvedValue({ data: reportWithActions })
    renderCard()
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())

    fireEvent.click(screen.getByText('koiosForYou.category.whatsapp'))

    const row = screen.getByText('Intake')
    expect(row).toBeInTheDocument()
    expect(within(row.closest('tr') as HTMLElement).queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows the truncated notice when actions_truncated is true', async () => {
    apiGet.mockResolvedValue({ data: { ...reportWithActions, actions_truncated: true } })
    renderCard()
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())

    fireEvent.click(screen.getByText('koiosForYou.category.tasks'))
    expect(screen.getByText('koiosForYou.truncated')).toBeInTheDocument()
  })

  it('buckets an unknown action type into "other" with a humanized label', async () => {
    apiGet.mockResolvedValue({
      data: {
        from: '2026-08-24', to: '2026-08-26', period: 'range',
        actions_total: 1,
        per_type: { koios_future_thing: 1 },
        per_source: { note: 1 },
        actions: [
          { id: 'a1', type: 'koios_future_thing', source: 'note:abc', executed_at: '2026-08-24T10:00:00Z', status: 'completed', created: null },
        ],
        actions_truncated: false,
      },
    })
    renderCard()
    await waitFor(() => expect(screen.getByText('koiosForYou.category.other')).toBeInTheDocument())

    fireEvent.click(screen.getByText('koiosForYou.category.other'))
    expect(screen.getByText('Future Thing')).toBeInTheDocument()
  })
})

// Fix-round pins (Opus B1-B4): translated status text, deleted-record fallback,
// pressed tile state, payload-level truncated notice at the tile row.
describe('KoiosForYouCard — v2 fix-round pins', () => {
  const base = {
    from: '2026-08-24', to: '2026-08-26', period: 'range',
    actions_total: 1,
    per_type: { koios_create_task: 1 }, per_source: { chat: 1 },
    actions: [{ id: 'a1', type: 'koios_create_task', source: 'chat', executed_at: '2026-08-24T10:00:00Z', status: 'completed', created: null }],
    actions_truncated: false,
  }
  const openTasksTile = async () => {
    await waitFor(() => expect(screen.getByText('koiosForYou.category.tasks')).toBeInTheDocument())
    const tile = screen.getByText('koiosForYou.category.tasks').closest('[role="button"]')!
    fireEvent.click(tile)
    return tile
  }

  it('renders a translated status TEXT next to the icon — never the raw wire value as a name', async () => {
    apiGet.mockResolvedValue({ data: base })
    renderCard()
    await openTasksTile()
    // identity t(): the KEY renders — proves the label runs through i18n.
    expect(await screen.findByText('koiosForYou.status.completed')).toBeInTheDocument()
    expect(screen.queryByLabelText('completed')).not.toBeInTheDocument()
  })

  it('a created ref whose label was deleted server-side renders the fallback, never an empty link', async () => {
    apiGet.mockResolvedValue({ data: { ...base,
      actions: [{ ...base.actions[0], created: { entity_type: 'task', entity_id: 42, label: null } }] } })
    renderCard()
    await openTasksTile()
    expect(await screen.findByText('koiosForYou.recordGone')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('the selected category tile carries aria-pressed', async () => {
    apiGet.mockResolvedValue({ data: base })
    renderCard()
    const tile = await openTasksTile()
    await waitFor(() => expect(tile.getAttribute('aria-pressed')).toBe('true'))
  })

  it('the truncated notice renders at the tile row, without a category open', async () => {
    apiGet.mockResolvedValue({ data: { ...base, actions_truncated: true } })
    renderCard()
    expect(await screen.findByText('koiosForYou.truncated')).toBeInTheDocument()
  })
})

// K-182 manager scope toggle (recruitment_manager/sales_manager only, wired
// by Dashboard.tsx's `scopeToggle` prop) — pins the request params, not just
// that the control renders.
describe('KoiosForYouCard — K-182 scope toggle', () => {
  it('without scopeToggle, no scope param is sent (pins today\'s behavior)', async () => {
    apiGet.mockResolvedValue({ data: emptyReport })
    renderCard()
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))
    const [, config] = apiGet.mock.calls[0]
    expect(config.params).not.toHaveProperty('scope')
    expect(screen.queryByRole('radio', { name: 'koiosForYou.scope.me' })).not.toBeInTheDocument()
  })

  it('with scopeToggle, defaults to scope=me and switching fetches scope=team', async () => {
    apiGet.mockResolvedValue({ data: emptyReport })
    renderCard({ scopeToggle: true })
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))
    expect(apiGet).toHaveBeenCalledWith('/ai/koios/for-you', expect.objectContaining({
      params: expect.objectContaining({ scope: 'me' }),
    }))

    fireEvent.click(screen.getByRole('radio', { name: 'koiosForYou.scope.team' }))

    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2))
    expect(apiGet).toHaveBeenLastCalledWith('/ai/koios/for-you', expect.objectContaining({
      params: expect.objectContaining({ scope: 'team' }),
    }))
  })
})

// K-182 deep-link map extension: application/candidate entity_types now link.
describe('KoiosForYouCard — deep-link map extension', () => {
  const reportWithApplication = {
    from: '2026-08-24', to: '2026-08-26', period: 'range',
    actions_total: 1,
    per_type: { koios_send_email: 1 }, per_source: { note: 1 },
    actions: [
      { id: 'a1', type: 'koios_send_email', source: 'note:abc', executed_at: '2026-08-24T10:00:00Z', status: 'completed', created: { entity_type: 'application', entity_id: 99, label: 'Application #99' } },
    ],
    actions_truncated: false,
  }

  it('an action row created.entity_type "application" links to the applications deep link', async () => {
    apiGet.mockResolvedValue({ data: reportWithApplication })
    renderCard()
    await waitFor(() => expect(screen.getByText('koiosForYou.category.emails')).toBeInTheDocument())

    fireEvent.click(screen.getByText('koiosForYou.category.emails'))

    const link = screen.getByRole('link', { name: 'common:openInNewTab' })
    expect(link).toHaveAttribute('href', expect.stringContaining('#applications?open=99'))
  })
})

/**
 * GebruikSettings (F5) — asserts the sub-tab bar, the ONE shared period param
 * reaching /billing/usage on every tab switch, the per-workflow row's
 * navigation to the workflow editor deep link, and the WhatsApp tab's
 * presence-based rendering (channel table vs legacy fallback).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { RightPanelProvider } from '@/context/RightPanelContext'
import GebruikSettings from './GebruikSettings'

// The per-workflow row navigates through the app seam, never a bare hash write.
const openEntitySpy = vi.hoisted(() => vi.fn())
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: openEntitySpy, navigate: vi.fn() }), useOpenFromIntent: () => {} }))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// Captures the real FilterGroup config GebruikSettings registers, so a test
// can drive the period pick through the exact onToggle a right-panel radio
// row would call, without rendering the whole right-panel chrome.
type FilterGroup = { key: string; onToggle?: (v: string) => void }
let lastGroups: FilterGroup[] = []
vi.mock('@/context/RightPanelContext', async () => {
  const actual = await vi.importActual('@/context/RightPanelContext')
  return {
    ...actual,
    useRightPanel: () => ({
      registerFilters: (_key: string, groups: FilterGroup[]) => { lastGroups = groups },
      unregisterFilters: () => {},
    }),
  }
})

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const billingUsage = (over: Record<string, unknown> = {}) => ({
  workflow: {
    total_credits: 10, credit_price: 1, amount: 10,
    per_day: [], per_workflow: [{ workflow_id: 'wf-1', name: 'Welkomstflow', runs: 4, credits: 10 }],
  },
  ai: { input_tokens: 0, output_tokens: 0, amount: 0, per_day: [], per_user: [] },
  ...over,
})

function mockApi(billing = billingUsage()) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/billing/usage') return Promise.resolve({ data: { data: billing } })
    if (url === '/settings/messaging-costs') return Promise.resolve({ data: { usage: {}, cost: {}, by_number: [] } })
    return Promise.resolve({ data: {} })
  })
}

function renderPage() {
  return render(<RightPanelProvider><GebruikSettings /></RightPanelProvider>)
}

beforeEach(() => { window.history.replaceState({}, '', '#billing_usage') })
afterEach(() => vi.clearAllMocks())

describe('GebruikSettings — sub-tabs share one period', () => {
  it('fetches /billing/usage with period=month by default and renders the five sub-tabs', async () => {
    mockApi()
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/billing/usage', expect.objectContaining({ params: { period: 'month' } }),
    ))
    expect(screen.getByRole('tab', { name: t('billing.usage.tabs.overview') })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: t('billing.usage.tabs.activity') })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: t('billing.usage.tabs.workflow') })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: t('billing.usage.tabs.user') })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: t('billing.usage.tabs.whatsapp') })).toBeInTheDocument()
  })

  it('switching to Per workflow renders the row from the same shared fetch, no second request', async () => {
    mockApi()
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2)) // /billing/usage + /settings/messaging-costs
    await userEvent.click(screen.getByRole('tab', { name: t('billing.usage.tabs.workflow') }))
    expect(await screen.findByText('Welkomstflow')).toBeInTheDocument()
    // No extra /billing/usage call fired by switching tabs.
    expect(vi.mocked(api.get).mock.calls.filter(c => c[0] === '/billing/usage')).toHaveLength(1)
  })

  it('the period pick reaches BOTH /billing/usage and the Per-functie /ai/koios/usage fetch', async () => {
    mockApi()
    renderPage()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/billing/usage', expect.objectContaining({ params: { period: 'month' } }),
    ))

    // Drive the pick through the real onToggle GebruikSettings registered —
    // the same call a right-panel radio row makes.
    const group = lastGroups.find((g) => g.key === 'usage-period')
    expect(group?.onToggle).toBeTruthy()
    act(() => { group!.onToggle!('prev_month') })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/billing/usage', expect.objectContaining({ params: { period: 'prev_month' } }),
    ))

    // Per-functie's /ai/koios/usage has no prev_month support (measured
    // contract) — the overview period still downmaps to 'month' there.
    await userEvent.click(screen.getByRole('tab', { name: t('billing.usage.tabs.activity') }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/ai/koios/usage', expect.objectContaining({ params: { period: 'month' } }),
    ))
    expect(await screen.findByText(t('billing.usage.activity.periodCaption'))).toBeInTheDocument()
  })
})

describe('GebruikSettings — per-workflow row navigates to the workflow editor', () => {
  it('clicking a workflow row opens the workflow editor through openEntity', async () => {
    mockApi()
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: t('billing.usage.tabs.workflow') }))
    const row = await screen.findByText('Welkomstflow')
    await userEvent.click(row)
    expect(openEntitySpy).toHaveBeenCalledWith('aiagents', 'wf-1')
  })
})

describe('GebruikSettings — Per gebruiker renders ai.per_user with success_rate as a RATIO', () => {
  it('renders calls/tokens/amount and formats a 0..1 success_rate via formatRatio, not formatPercent', async () => {
    // Backend contract (BillingUsageController::index): success_rate is a
    // FRACTION 0..1 (round(successes/calls, 4)) — formatPercent would treat it
    // as an already-scaled percentage and render 0.9524 as "1%".
    mockApi(billingUsage({
      ai: {
        input_tokens: 100, output_tokens: 50, amount: 3.5, per_day: [],
        per_user: [{ user_id: 'u-1', name: 'Jane Doe', calls: 21, input_tokens: 100, output_tokens: 50, amount: 3.5, success_rate: 0.9524 }],
      },
    }))
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: t('billing.usage.tabs.user') }))
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('95,2%')).toBeInTheDocument()
    expect(screen.queryByText('1%')).not.toBeInTheDocument()
  })
})

describe('GebruikSettings — vocabulary keys exist in all five locales', () => {
  it.each(['nl', 'en', 'de', 'fr', 'es'])('%s carries the Koios Tokens / AI-tokens / WhatsApp Tokens vocabulary', (loc) => {
    const bundle = i18n.getResourceBundle(loc, 'settings')
    expect(bundle?.billing?.usage?.plan?.workflowMeter).toBeTruthy()
    expect(bundle?.billing?.usage?.plan?.aiMeter).toBeTruthy()
    expect(bundle?.billing?.usage?.plan?.whatsappMeter).toBeTruthy()
    // The rename target — "credits" no longer appears in the plan title/notice.
    expect(String(bundle?.billing?.usage?.plan?.title ?? '')).not.toMatch(/credit/i)
    expect(String(bundle?.billing?.usage?.plan?.notice ?? '')).not.toMatch(/credit/i)
  })
})

describe('GebruikSettings — WhatsApp tab is presence-based', () => {
  it('renders the legacy by_number fallback when whatsapp.by_channel is absent', async () => {
    mockApi()
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: t('billing.usage.tabs.whatsapp') }))
    expect(await screen.findByText(t('billing.usage.whatsapp.fallbackCaption'))).toBeInTheDocument()
  })

  it('renders the per-channel table when whatsapp.by_channel is present', async () => {
    mockApi(billingUsage({ whatsapp: { by_channel: [{ channel: 'wa_web', messages: 12, tokens: 12, amount: 1.2 }], tokens: { used: 12, budget: 100 } } }))
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: t('billing.usage.tabs.whatsapp') }))
    expect(await screen.findByText('WA Web')).toBeInTheDocument()
    expect(screen.queryByText(t('billing.usage.whatsapp.fallbackCaption'))).not.toBeInTheDocument()
  })
})

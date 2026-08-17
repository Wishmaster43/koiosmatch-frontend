/**
 * TenantUsageBreakdownTable — asserts the REAL request (route + group_by/month
 * params) sent on axis switches, the "__system__" sentinel row rendering with
 * its resolved label, and the honest error state. Per CLAUDE.md §13: a
 * mutation/read test proves the seam, never only that a callback fired.
 *
 * USAGE-GROUPS-1: every fixture below is shaped like the REAL response
 * (AdminUsageController@details → `groups` + `totals` + a per-row `sale` split),
 * captured from the live endpoint on 17-08. The previous fixtures invented a
 * `rows` key that the server has never sent, so the suite proved the component
 * could render a payload it would never receive while the actual screen showed
 * "geen verbruik" on all four axes. A fixture is part of the seam.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import api from '@/lib/api'
import i18n from '@/i18n'
import TenantUsageBreakdownTable from './TenantUsageBreakdownTable'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key: string, opts?: object) => i18n.t(key, { ns: 'settings', ...opts })

const activityGroups = {
  data: {
    group_by: 'activity',
    month: '2026-08',
    groups: [
      { key: 'chat', requests: 40, input_tokens: 1000, output_tokens: 500, cost: 0.3, sale: { purchase: 0.3, sale: 0.45, margin: 0.15 } },
      { key: 'interview', requests: 90, input_tokens: 4000, output_tokens: 2200, cost: 1.8, sale: { purchase: 1.8, sale: 2.7, margin: 0.9 } },
    ],
    totals: { tokens: 7700, requests: 130, cost: 2.1 },
  },
}

const userGroups = {
  data: {
    group_by: 'user',
    month: '2026-08',
    groups: [
      { key: 'u1', label: 'Jane Doe', requests: 30, input_tokens: 900, output_tokens: 420, cost: 0.25, sale: { purchase: 0.25, sale: 0.38, margin: 0.13 } },
      { key: '__system__', label: 'System / unattributed', requests: 5, input_tokens: 200, output_tokens: 80, cost: 0.05, sale: { purchase: 0.05, sale: 0.08, margin: 0.03 } },
    ],
    totals: { tokens: 1600, requests: 35, cost: 0.3 },
  },
}

afterEach(() => vi.clearAllMocks())

describe('TenantUsageBreakdownTable', () => {
  it('fetches the activity axis for the given tenant/month by default', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: activityGroups })
    render(<TenantUsageBreakdownTable tenantId="t1" month="2026-08" />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/admin/tenants/t1/usage/details',
      expect.objectContaining({ params: { month: '2026-08', group_by: 'activity' } }),
    ))
  })

  it('renders the groups the server actually sends (regression: the key is `groups`, not `rows`)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: activityGroups })
    render(<TenantUsageBreakdownTable tenantId="t1" month="2026-08" />)
    expect(await screen.findByText('interview')).toBeInTheDocument()
    expect(screen.getByText('chat')).toBeInTheDocument()
    expect(screen.queryByText(t('usage.breakdown.empty'))).not.toBeInTheDocument()
  })

  it('ignores a payload using the old `rows` key instead of silently rendering it', async () => {
    // Proves the component is bound to the real contract: a `rows`-shaped body
    // must NOT produce rows, otherwise this suite could go green against a shape
    // the backend never sends (which is exactly how the bug survived).
    vi.mocked(api.get).mockResolvedValue({ data: { group_by: 'activity', month: '2026-08', rows: activityGroups.data.groups } })
    render(<TenantUsageBreakdownTable tenantId="t1" month="2026-08" />)
    expect(await screen.findByText(t('usage.breakdown.empty'))).toBeInTheDocument()
    expect(screen.queryByText('interview')).not.toBeInTheDocument()
  })

  it('shows the purchase AND sale side per group (super-admin surface)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: activityGroups })
    render(<TenantUsageBreakdownTable tenantId="t1" month="2026-08" />)
    const row = (await screen.findByText('interview')).closest('tr') as HTMLElement
    expect(within(row).getByText(/1,80/)).toBeInTheDocument() // purchase
    expect(within(row).getByText(/2,70/)).toBeInTheDocument() // sale
  })

  it('sorts the biggest consumer to the top by default', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: activityGroups })
    const { container } = render(<TenantUsageBreakdownTable tenantId="t1" month="2026-08" />)
    await screen.findByText('interview')
    const firstCell = container.querySelectorAll('tbody tr td')[0]
    expect(firstCell?.textContent).toBe('interview') // 1.80 purchase > 0.30
  })

  it('bounds the list and states its real size plus the server totals in the footer', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: activityGroups })
    render(<TenantUsageBreakdownTable tenantId="t1" month="2026-08" />)
    await screen.findByText('interview')
    // The scroll region is a named, focusable landmark (a11y) …
    const region = screen.getByRole('region', { name: t('usage.breakdown.title') })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region.style.maxHeight).not.toBe('')
    // … and the footer states the count + the server's own month totals, so a
    // scrolled view still foots without scrolling to the end.
    expect(screen.getByText(t('usage.breakdown.footerWithTotals', {
      count: 2, requests: '130', tokens: '7.700',
    }))).toBeInTheDocument()
  })

  it('renders the __system__ row with its resolved label, never hidden, on the user axis', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: userGroups })
    render(<TenantUsageBreakdownTable tenantId="t1" month="2026-08" />)
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))
    const userButton = await screen.findByRole('radio', { name: t('usage.breakdown.axis.user') })
    await userEvent.click(userButton)
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('System / unattributed')).toBeInTheDocument()
  })

  it('switching the axis sends the new group_by with the same month', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: activityGroups })
    render(<TenantUsageBreakdownTable tenantId="t1" month="2026-08" />)
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))

    const userButton = await screen.findByRole('radio', { name: t('usage.breakdown.axis.user') })
    await userEvent.click(userButton)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/admin/tenants/t1/usage/details',
      expect.objectContaining({ params: { month: '2026-08', group_by: 'user' } }),
    ))
  })

  it('shows an honest error state when the request fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network'))
    render(<TenantUsageBreakdownTable tenantId="t1" month="2026-08" />)
    await waitFor(() => expect(screen.getByText(t('usage.breakdown.loadError'))).toBeInTheDocument())
  })
})

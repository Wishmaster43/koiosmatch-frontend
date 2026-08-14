/**
 * TenantUsageBreakdownTable — asserts the REAL request (route + group_by/month
 * params) sent on axis switches, the "__system__" sentinel row rendering with
 * its resolved label, and the honest error state. Per CLAUDE.md §13: a
 * mutation/read test proves the seam, never only that a callback fired.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import api from '@/lib/api'
import i18n from '@/i18n'
import TenantUsageBreakdownTable from './TenantUsageBreakdownTable'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key: string, opts?: object) => i18n.t(key, { ns: 'settings', ...opts })

const activityRows = {
  data: {
    group_by: 'activity',
    month: '2026-08',
    rows: [
      { key: 'chat', requests: 40, input_tokens: 1000, output_tokens: 500, cost: 0.3 },
    ],
  },
}

const userRows = {
  data: {
    group_by: 'user',
    month: '2026-08',
    rows: [
      { key: 'u1', label: 'Jane Doe', requests: 30, input_tokens: 900, output_tokens: 420, cost: 0.25 },
      { key: '__system__', label: 'System / unattributed', requests: 5, input_tokens: 200, output_tokens: 80, cost: 0.05 },
    ],
  },
}

afterEach(() => vi.clearAllMocks())

describe('TenantUsageBreakdownTable', () => {
  it('fetches the activity axis for the given tenant/month by default', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: activityRows })
    render(<TenantUsageBreakdownTable tenantId="t1" month="2026-08" />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/admin/tenants/t1/usage/details',
      expect.objectContaining({ params: { month: '2026-08', group_by: 'activity' } }),
    ))
  })

  it('renders the __system__ row with its resolved label, never hidden, on the user axis', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: userRows })
    render(<TenantUsageBreakdownTable tenantId="t1" month="2026-08" />)
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))
    const userButton = await screen.findByRole('radio', { name: t('usage.breakdown.axis.user') })
    await userEvent.click(userButton)
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('System / unattributed')).toBeInTheDocument()
  })

  it('switching the axis sends the new group_by with the same month', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: activityRows })
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

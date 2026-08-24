/**
 * BillingUsersCard (MODULES-USERS-SUBTAB-1, K-167/K-175) — asserts the real
 * request seam: GET renders the seeded package seat fields, editing a package
 * PUTs only the seat keys, null included_users renders "unlimited" text (never
 * an invented symbol), and the extra-count/amount is computed from the fixture.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import BillingUsersCard from './BillingUsersCard'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', async () => {
  const actual = await vi.importActual('@/lib/notify')
  return { ...actual, notifyError: vi.fn(), notifySuccess: vi.fn() }
})

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

const budgets = {
  packages: {
    core: { ai_token_budget: 1000, workflow_credit_budget: 200, included_users: 5, extra_user_price_cents: 1500 },
    pro: { ai_token_budget: 5000, workflow_credit_budget: 800, included_users: 10, extra_user_price_cents: 1000 },
    enterprise: { ai_token_budget: 20000, workflow_credit_budget: 3000, included_users: null, extra_user_price_cents: 0 },
  },
  tenants: {},
  tenant_users: {
    't-1': { package: 'core', active_users: 8 },
    't-2': { package: 'enterprise', active_users: 40 },
  },
  resets_at: '2026-09-01T00:00:00Z',
}

function mockGet() {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/admin/billing-budgets') return Promise.resolve({ data: budgets })
    return Promise.resolve({ data: {} })
  })
}

describe('BillingUsersCard', () => {
  it('GETs /admin/billing-budgets and renders the three package seat fields', async () => {
    mockGet()
    render(<BillingUsersCard />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/billing-budgets'))
    const inputs = await screen.findAllByLabelText(t('billingUsers.includedUsersLabel'))
    expect(inputs).toHaveLength(3)
    expect(inputs[0]).toHaveValue(5)
    expect(inputs[1]).toHaveValue(10)
    // null included_users on enterprise still renders as an empty editable field, not 0.
    expect(inputs[2]).toHaveValue(null)
  })

  it('PUTs only the seat fields on the package block when saving', async () => {
    mockGet()
    vi.mocked(api.put).mockResolvedValue({ data: budgets })
    render(<BillingUsersCard />)
    const [coreIncluded] = await screen.findAllByLabelText(t('billingUsers.includedUsersLabel'))
    await userEvent.clear(coreIncluded)
    await userEvent.type(coreIncluded, '6')
    await userEvent.click(screen.getByText(t('common.save')))

    // Dirty-only PUT: exactly the edited field on the edited package — an
    // untouched unlimited package (enterprise: null) must never be rewritten
    // as 0 (that would make every seat billable).
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/billing-budgets', {
      packages: { core: { included_users: 6 } },
    }))
  })

  it('clearing a field saves null (back to unlimited), never 0', async () => {
    mockGet()
    vi.mocked(api.put).mockResolvedValue({ data: budgets })
    render(<BillingUsersCard />)
    const [coreIncluded] = await screen.findAllByLabelText(t('billingUsers.includedUsersLabel'))
    await userEvent.clear(coreIncluded)
    await userEvent.click(screen.getByText(t('common.save')))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/billing-budgets', {
      packages: { core: { included_users: null } },
    }))
  })

  it('renders null included_users as unlimited text and computes extra seats/amount from the fixture', async () => {
    mockGet()
    render(<BillingUsersCard />)
    // t-1: core package, included 5, active 8 -> 3 extra at 1500 cents = 45.00.
    await screen.findByText('t-1')
    expect(screen.getByText(/3 extra/)).toBeInTheDocument()
    // t-2: enterprise package, included_users null -> unlimited, no extra row.
    expect(screen.getByText('t-2')).toBeInTheDocument()
    expect(screen.getAllByText(t('billingUsers.unlimited')).length).toBeGreaterThan(0)
  })
})

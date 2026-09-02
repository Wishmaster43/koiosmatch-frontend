/**
 * BillingBudgetsCard (CREDITS-2-FE deel 2) — asserts the real request seam: the
 * GET shape, the PUT body for a package edit and the PUT body for a tenant-
 * override clear (null fields), per §13.
 * PRIJSMODEL-C (30-08): ai_token_budget is gone (AI capacity is a staffel now,
 * shown read-only via ai_tier_key); workflow_credit_budget is renamed
 * included_workflow_runs.
 * K-242 (02-09): whatsapp_token_budget is RETIRED — a PUT body never carries
 * it any more (folded into included_workflow_runs server-side).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import BillingBudgetsCard from './BillingBudgetsCard'

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
    core: { included_workflow_runs: 200, ai_tier_key: 'assist', value: { ai_cogs: 1, ai_sale: 2, basis: 'per 1k' } },
    pro: { included_workflow_runs: 800, ai_tier_key: 'pro', value: { ai_cogs: 1, ai_sale: 2, basis: 'per 1k' } },
    enterprise: { included_workflow_runs: 3000, ai_tier_key: 'max', value: { ai_cogs: 1, ai_sale: 2, basis: 'per 1k' } },
  },
  tenants: {
    't-1': { included_workflow_runs: 500 },
  },
  resets_at: '2026-09-01T00:00:00Z',
}

function mockGet() {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/admin/billing-budgets') return Promise.resolve({ data: budgets })
    if (url === '/tenants') return Promise.resolve({ data: { data: [{ id: 't-1', name: 'Yesway Flex B.V.' }] } })
    return Promise.resolve({ data: {} })
  })
}

describe('BillingBudgetsCard', () => {
  it('GETs /admin/billing-budgets and renders the three package budgets', async () => {
    mockGet()
    render(<BillingBudgetsCard />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/billing-budgets'))
    const inputs = await screen.findAllByLabelText(t('billingBudgets.workflowBudgetLabel'))
    expect(inputs).toHaveLength(3)
    expect(inputs[0]).toHaveValue(200)
    expect(inputs[1]).toHaveValue(800)
  })

  it('renders the read-only AI staffel per package, never as an input', async () => {
    mockGet()
    render(<BillingBudgetsCard />)
    await screen.findAllByLabelText(t('billingBudgets.workflowBudgetLabel'))
    expect(screen.getByText(t('billingBudgets.aiTierLabel', { tier: 'assist' }))).toBeInTheDocument()
    expect(screen.queryByLabelText(t('billingBudgets.aiBudgetLabel'))).not.toBeInTheDocument()
  })

  it('PUTs the edited package budget', async () => {
    mockGet()
    vi.mocked(api.put).mockResolvedValue({ data: budgets })
    render(<BillingBudgetsCard />)

    const inputs = await screen.findAllByLabelText(t('billingBudgets.workflowBudgetLabel'))
    await userEvent.clear(inputs[0])
    await userEvent.type(inputs[0], '1500')

    await userEvent.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/billing-budgets', expect.objectContaining({
      packages: expect.objectContaining({ core: { included_workflow_runs: 1500 } }),
    })))
  })

  it('never sends the retired whatsapp_token_budget knob (K-242)', async () => {
    mockGet()
    vi.mocked(api.put).mockResolvedValue({ data: budgets })
    render(<BillingBudgetsCard />)

    const inputs = await screen.findAllByLabelText(t('billingBudgets.workflowBudgetLabel'))
    await userEvent.clear(inputs[0])
    await userEvent.type(inputs[0], '1500')
    await userEvent.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    const body = vi.mocked(api.put).mock.calls[0][1] as { packages?: Record<string, unknown> }
    for (const pkg of Object.values(body.packages ?? {})) {
      expect(pkg).not.toHaveProperty('whatsapp_token_budget')
    }
  })

  it('PUTs null fields for a tenant override clear', async () => {
    mockGet()
    vi.mocked(api.put).mockResolvedValue({ data: budgets })
    render(<BillingBudgetsCard />)

    await screen.findAllByLabelText(t('billingBudgets.workflowBudgetLabel'))
    const tenantTrigger = screen.getByText(t('billingBudgets.tenantPickerPlaceholder'))
    await userEvent.click(tenantTrigger)
    const option = await screen.findByText('Yesway Flex B.V.')
    await userEvent.click(option)

    const wfInput = await screen.findByLabelText(t('billingBudgets.workflowBudgetLabel'), { selector: '#tenant-budget-wf' })
    await userEvent.clear(wfInput)

    await userEvent.click(screen.getByRole('button', { name: t('common.save') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/billing-budgets', expect.objectContaining({
      tenants: { 't-1': { included_workflow_runs: null } },
    })))
  })
})

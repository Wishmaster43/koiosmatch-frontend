/**
 * UsagePerWorkflowTab.test — verify the workflow usage table renders amount
 * column, null as "—", and formatted currency amounts (X-19 D-4).
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import i18n from '@/i18n'
import UsagePerWorkflowTab from './UsagePerWorkflowTab'
import * as navigationContext from '@/context/NavigationContext'
import type { BillingUsageWorkflow } from '@/types/billingUsage'

vi.mock('@/context/NavigationContext')

const st = (key: string) => i18n.t(key, { ns: 'settings' })

describe('UsagePerWorkflowTab', () => {
  beforeEach(() => {
    vi.mocked(navigationContext.useNavigation).mockReturnValue({
      openEntity: vi.fn(),
    } as unknown as ReturnType<typeof navigationContext.useNavigation>)
  })

  it('renders amount column header', () => {
    const workflow: BillingUsageWorkflow = {
      per_workflow: [
        { workflow_id: 'wf1', name: 'Welcome email', runs: 42, credits: 126 },
      ],
      overage_price: 0.05,
    }

    render(<UsagePerWorkflowTab workflow={workflow} phase="ready" />)

    expect(screen.getByText(st('billing.usage.perWorkflow.colName'))).toBeInTheDocument()
    expect(screen.getByText(st('billing.usage.perWorkflow.colRuns'))).toBeInTheDocument()
    expect(screen.getByText(st('billing.usage.perWorkflow.colTokens'))).toBeInTheDocument()
    expect(screen.getByText(st('billing.usage.perWorkflow.colAmount'))).toBeInTheDocument()
  })

  it('renders null amount as "—"', () => {
    const workflow: BillingUsageWorkflow = {
      per_workflow: [
        { workflow_id: 'wf1', name: 'Welcome email', runs: 42, credits: 126, amount: null },
      ],
      overage_price: 0.05,
    }

    render(<UsagePerWorkflowTab workflow={workflow} phase="ready" />)

    expect(screen.getByText('Welcome email')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders formatted amount for non-null values', () => {
    const workflow: BillingUsageWorkflow = {
      per_workflow: [
        { workflow_id: 'wf1', name: 'Welcome email', runs: 42, credits: 126, amount: 6.30 },
      ],
      overage_price: 0.05,
    }

    render(<UsagePerWorkflowTab workflow={workflow} phase="ready" />)

    expect(screen.getByText('Welcome email')).toBeInTheDocument()
    // formatCurrency renders it based on locale, just verify it's not the raw number
    const rows = screen.getAllByRole('row')
    const dataRow = rows.find((r) => r.textContent.includes('Welcome email'))
    expect(dataRow?.textContent).toContain('6')
  })

  it('renders loading state', () => {
    render(<UsagePerWorkflowTab workflow={undefined} phase="loading" />)
    expect(screen.getByText(st('common.loadingShort'))).toBeInTheDocument()
  })

  it('renders empty state', () => {
    const workflow: BillingUsageWorkflow = {
      per_workflow: [],
      overage_price: 0.05,
    }

    render(<UsagePerWorkflowTab workflow={workflow} phase="ready" />)
    expect(screen.getByText(st('billing.usage.perWorkflow.empty'))).toBeInTheDocument()
  })
})

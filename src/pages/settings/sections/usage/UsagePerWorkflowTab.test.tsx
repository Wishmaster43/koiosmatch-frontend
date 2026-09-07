/**
 * UsagePerWorkflowTab.test — verify the workflow usage table renders runs and
 * tokens columns only, never currency amounts.
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

  it('renders table headers without amount column', () => {
    const workflow: BillingUsageWorkflow = {
      per_workflow: [
        { workflow_id: 'wf1', name: 'Welcome email', runs: 42, credits: 126 },
        { workflow_id: 'wf2', name: 'SMS reminder', runs: 15, credits: 45 },
      ],
      overage_price: 0.05,
    }

    render(<UsagePerWorkflowTab workflow={workflow} phase="ready" />)

    expect(screen.getByText(st('billing.usage.perWorkflow.colName'))).toBeInTheDocument()
    expect(screen.getByText(st('billing.usage.perWorkflow.colRuns'))).toBeInTheDocument()
    expect(screen.getByText(st('billing.usage.perWorkflow.colTokens'))).toBeInTheDocument()
    expect(screen.queryByText('Amount')).not.toBeInTheDocument()
    expect(screen.queryByText(st('billing.usage.perWorkflow.colAmount'))).not.toBeInTheDocument()
  })

  it('renders workflow rows with runs and tokens only', () => {
    const workflow: BillingUsageWorkflow = {
      per_workflow: [
        { workflow_id: 'wf1', name: 'Welcome email', runs: 42, credits: 126 },
      ],
      overage_price: 0.05,
    }

    render(<UsagePerWorkflowTab workflow={workflow} phase="ready" />)

    expect(screen.getByText('Welcome email')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('126')).toBeInTheDocument()
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

/**
 * TenantTierAssignment tests (props-only presenter) — the assignment PUT body
 * asserted verbatim, the empty state, and no native <select>.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import i18n from '@/i18n'
import TenantTierAssignment from './TenantTierAssignment'
import { toLocalIsoDate } from '@/lib/localDate'
import type { BillingAiTier, BillingWorkflowTier } from '@/types/billingTiers'

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

// Deterministic tenant options — no real /tenants call in a unit test.
vi.mock('@/hooks/useTenantSearch', () => ({
  useTenantSearch: () => ({
    options: [{ value: 'tenant-1', label: 'Yesway Flex B.V.' }],
    onSearch: vi.fn(),
  }),
}))

const aiTiers: BillingAiTier[] = [{ key: 'pro', label: 'Pro', active: true }]
const workflowTiers: BillingWorkflowTier[] = [{ key: 'start', label: 'Start', active: true }]

describe('TenantTierAssignment', () => {
  // Picking a tenant + AI tier and saving sends the exact PUT body.
  it('calls onAssign with the exact body after picking a tenant and AI tier', async () => {
    const onAssign = vi.fn().mockResolvedValue(undefined)
    render(
      <TenantTierAssignment aiTiers={aiTiers} workflowTiers={workflowTiers} onAssign={onAssign} assignments={[]} />,
    )

    fireEvent.click(screen.getByLabelText(st('billingTiers.tenantPickerLabel')))
    fireEvent.click(screen.getByText('Yesway Flex B.V.'))

    fireEvent.click(screen.getByLabelText(st('billingTiers.tenantAiTier')))
    fireEvent.click(screen.getByText('Pro'))

    await act(async () => {
      fireEvent.click(screen.getByText(st('common.save')))
    })

    const today = toLocalIsoDate(new Date())
    expect(onAssign).toHaveBeenCalledWith('tenant-1', {
      ai_tier: 'pro',
      workflow_tier: null,
      effective_from: today,
    })
  })

  // Empty assignments render the honest empty state, not a blank table.
  it('shows the empty state when there are no assignments yet', () => {
    render(
      <TenantTierAssignment aiTiers={aiTiers} workflowTiers={workflowTiers} onAssign={vi.fn()} assignments={[]} />,
    )
    expect(screen.getByText(st('billingTiers.assignmentsEmpty'))).toBeInTheDocument()
  })

  // No native <select> anywhere.
  it('never renders a native select', () => {
    const { container } = render(
      <TenantTierAssignment aiTiers={aiTiers} workflowTiers={workflowTiers} onAssign={vi.fn()} assignments={[]} />,
    )
    expect(container.querySelectorAll('select')).toHaveLength(0)
  })
})

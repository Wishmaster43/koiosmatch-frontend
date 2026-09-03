/**
 * OpportunityLostReasonModal — OPP-LOST-FE-1: the reason picker is a searchable
 * CreatableSelect (allowCreate off), confirm stays disabled until a reason is
 * picked, and confirm emits the reason label (the string posted as `lost_reason`).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OpportunityLostReasonModal from './OpportunityLostReasonModal'

// Key-echo (repo-wide precedent, RejectionModal.test.tsx) — keeps assertions
// stable regardless of i18n init timing across the suite.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

vi.mock('@/lib/useOpportunityLostReasons', () => ({
  useOpportunityLostReasons: () => ({
    reasons: [{ value: 'Budget', label: 'Budget' }, { value: 'Timing', label: 'Timing' }],
    loading: false,
  }),
}))

describe('OpportunityLostReasonModal', () => {
  it('renders the reason picker as a searchable CreatableSelect, not a bare <select>', async () => {
    render(<OpportunityLostReasonModal onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(await screen.findByRole('button', { name: 'lost.reasonPlaceholder' })).toBeInTheDocument()
    expect(document.querySelector('select')).toBeNull()
  })

  it('disables confirm until a reason is picked', async () => {
    render(<OpportunityLostReasonModal onCancel={vi.fn()} onConfirm={vi.fn()} />)
    await screen.findByRole('button', { name: 'lost.reasonPlaceholder' })
    expect(screen.getByText('lost.confirm').closest('button')).toBeDisabled()
  })

  it('picks a reason and confirms with the reason label', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<OpportunityLostReasonModal onCancel={vi.fn()} onConfirm={onConfirm} />)
    await user.click(await screen.findByRole('button', { name: 'lost.reasonPlaceholder' }))
    await user.click(await screen.findByRole('button', { name: 'Budget' }))
    await user.click(screen.getByText('lost.confirm'))
    expect(onConfirm).toHaveBeenCalledWith('Budget')
  })

  it('cancel calls onCancel and never onConfirm', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<OpportunityLostReasonModal onCancel={onCancel} onConfirm={onConfirm} />)
    await screen.findByRole('button', { name: 'lost.reasonPlaceholder' })
    await user.click(screen.getByText('common:cancel'))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

/**
 * BranchSection — the shared, purely presentational branch-linking block (§3A/§11:
 * one component adopted by both candidates and customers). Covers the empty state,
 * chip rendering, and that toggling (remove chip / pick from the search list) calls
 * back with the exact branch id — the persistence itself is each caller's own hook
 * (useCandidateBranches / useEntityBranches), covered separately.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import BranchSection from './BranchSection'

// The × button's aria-label comes from the real, ACTIVE-locale common:remove key
// (never hardcoded — mirrors OverviewTab.test.tsx's ct()/cm() helpers).
const cm = (key: string) => i18n.t(key, { ns: 'common' })

const baseProps = {
  label: 'Branch',
  addLabel: 'Link branch',
  emptyLabel: 'No branch linked yet.',
  options: [{ value: 'b1', label: 'North' }, { value: 'b2', label: 'South' }],
}

describe('BranchSection · empty state', () => {
  it('renders the empty-state text when no branch is linked', () => {
    render(<BranchSection {...baseProps} selectedIds={[]} branches={[]} onToggle={vi.fn()} />)
    expect(screen.getByText('No branch linked yet.')).toBeInTheDocument()
  })
})

describe('BranchSection · linked chips', () => {
  it('renders one chip per linked branch, never the empty state', () => {
    render(<BranchSection {...baseProps} selectedIds={['b1']} branches={[{ id: 'b1', name: 'North' }]} onToggle={vi.fn()} />)
    expect(screen.getByText('North')).toBeInTheDocument()
    expect(screen.queryByText('No branch linked yet.')).toBeNull()
  })

  it('calls onToggle with the branch id when its × is clicked', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<BranchSection {...baseProps} selectedIds={['b1']} branches={[{ id: 'b1', name: 'North' }]} onToggle={onToggle} />)
    await user.click(screen.getByRole('button', { name: cm('remove') }))
    expect(onToggle).toHaveBeenCalledWith('b1')
  })
})

describe('BranchSection · add trigger', () => {
  it('opens the searchable picker and calls onToggle with the picked option id', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<BranchSection {...baseProps} selectedIds={[]} branches={[]} onToggle={onToggle} />)
    await user.click(screen.getByText('Link branch'))
    await user.click(screen.getByText('South'))
    expect(onToggle).toHaveBeenCalledWith('b2')
  })
})

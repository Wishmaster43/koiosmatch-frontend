import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Users } from 'lucide-react'
import { KpiCard } from './DashboardPrimitives'

describe('dashboard KpiCard target line', () => {
  // Every tone paints its text token on the target line.
  it.each([
    ['success', 'var(--color-success-text)'],
    ['warning', 'var(--color-warning-text)'],
    ['muted', 'var(--text-muted)'],
  ] as const)('renders the line with the %s tone token', (tone, token) => {
    render(<KpiCard label="L" value="3" Icon={Users} targetLine={{ text: 'Target 10 reached', tone }} />)
    expect(screen.getByText('Target 10 reached')).toHaveStyle({ color: token })
  })
  // The same card with and without a target line differs by exactly that line.
  it('renders nothing extra when absent', () => {
    const { container: without } = render(<KpiCard label="L" value="3" sub="sub" Icon={Users} />)
    const bare = without.querySelectorAll('div').length
    expect(screen.queryByText('Target 10 reached')).toBeNull()
    const { container: withLine } = render(
      <KpiCard label="L" value="3" sub="sub" Icon={Users} targetLine={{ text: 'Target 10 reached', tone: 'success' }} />)
    expect(withLine.querySelectorAll('div').length).toBe(bare + 1)
  })
})

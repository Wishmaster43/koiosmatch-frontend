import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Users } from 'lucide-react'
import { KpiCard } from './DashboardPrimitives'

describe('dashboard KpiCard target line', () => {
  it('renders the line with the tone token', () => {
    render(<KpiCard label="L" value="3" Icon={Users} targetLine={{ text: 'Doel 10 gehaald', tone: 'success' }} />)
    expect(screen.getByText('Doel 10 gehaald')).toHaveStyle({ color: 'var(--color-success-text)' })
  })
  it('renders nothing extra when absent', () => {
    render(<KpiCard label="L" value="3" sub="sub" Icon={Users} />)
    expect(screen.queryByText(/Doel/)).toBeNull()
  })
})

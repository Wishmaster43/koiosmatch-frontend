import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Users, Clock } from 'lucide-react'
import ReportStatStrip from './ReportStatStrip'

// The shared strip renders every item's value next to its label (SHARED-UNIT-TEST-1).
describe('ReportStatStrip', () => {
  it('renders one cell per item with its value and label', () => {
    render(<ReportStatStrip items={[{ label: 'Candidates', value: 12, icon: Users }, { label: 'Duration', value: '3 s', icon: Clock }]} />)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Candidates')).toBeInTheDocument()
    expect(screen.getByText('3 s')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
  })

  it('merges the caller frame style onto the strip', () => {
    const { container } = render(<ReportStatStrip items={[]} style={{ borderRadius: 8 }} />)
    expect((container.firstChild as HTMLElement).style.borderRadius).toBe('8px')
  })
})

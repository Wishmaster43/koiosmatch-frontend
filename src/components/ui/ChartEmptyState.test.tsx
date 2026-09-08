/**
 * ChartEmptyState.test.tsx — tests for the chart empty-state component.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ChartEmptyState from './ChartEmptyState'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key === 'noData' ? 'No data available' : key,
  }),
}))

describe('ChartEmptyState', () => {
  it('renders empty state with title', () => {
    render(<ChartEmptyState title="Test Chart" />)
    expect(screen.getByText('Test Chart')).toBeInTheDocument()
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders empty state without title', () => {
    render(<ChartEmptyState />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('applies muted text colour', () => {
    const { container } = render(<ChartEmptyState title="Test" />)
    const emptyDiv = container.querySelector('div[style*="--text-muted"]')
    expect(emptyDiv).toBeInTheDocument()
  })

  it('renders with correct height for content area', () => {
    const { container } = render(<ChartEmptyState />)
    const contentDiv = container.querySelector('.h-40')
    expect(contentDiv).toBeInTheDocument()
  })
})

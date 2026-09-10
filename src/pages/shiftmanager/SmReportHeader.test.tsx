/**
 * SmReportHeader.test — the title always renders; the divider + meta children
 * show only once loading is false, and the loading spinner shows only while
 * loading is true. SmKpiGrid just needs to render its children.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SmReportHeader, SmKpiGrid } from './SmReportHeader'

describe('SmReportHeader', () => {
  it('shows the title and meta children, no spinner, once loading is false', () => {
    const { container } = render(
      <SmReportHeader title="Departments" loading={false}>
        <span data-testid="meta">42 total</span>
      </SmReportHeader>
    )
    expect(screen.getByText('Departments')).toBeInTheDocument()
    expect(screen.getByTestId('meta')).toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument()
  })

  it('hides the meta children and shows the spinner while loading', () => {
    const { container } = render(
      <SmReportHeader title="Departments" loading={true}>
        <span data-testid="meta">42 total</span>
      </SmReportHeader>
    )
    expect(screen.getByText('Departments')).toBeInTheDocument()
    expect(screen.queryByTestId('meta')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })
})

describe('SmKpiGrid', () => {
  it('renders its children in a 4-column grid', () => {
    const { container } = render(
      <SmKpiGrid>
        <span>A</span>
        <span>B</span>
      </SmKpiGrid>
    )
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    const grid = container.firstElementChild as HTMLElement
    expect(grid.style.gridTemplateColumns).toBe('repeat(4, 1fr)')
  })
})

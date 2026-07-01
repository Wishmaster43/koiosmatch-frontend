import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RunStepList from './RunStepList'
import type { RunStep } from '@/types/reports'

// i18n is not initialised in tests, so t() returns the raw key — assertions
// check for the keys (e.g. 'runs.drawer.input').
const steps: RunStep[] = [
  { label: 'HTTP',   status: 'success', input: { url: '/x' }, output: { id: 1 } },
  { label: 'Filter', status: 'success', message: 'passed' }, // no I/O → not expandable
]

describe('RunStepList', () => {
  it('renders each step label', () => {
    render(<RunStepList steps={steps} />)
    expect(screen.getByText('HTTP')).toBeInTheDocument()
    expect(screen.getByText('Filter')).toBeInTheDocument()
  })

  it('reveals INPUT and OUTPUT only after expanding a step with I/O', () => {
    render(<RunStepList steps={steps} />)
    expect(screen.queryByText('runs.drawer.input')).toBeNull()
    fireEvent.click(screen.getByText('HTTP'))
    expect(screen.getByText('runs.drawer.input')).toBeInTheDocument()
    expect(screen.getByText('runs.drawer.output')).toBeInTheDocument()
  })

  it('does not expand a step without input/output', () => {
    render(<RunStepList steps={steps} />)
    fireEvent.click(screen.getByText('Filter'))
    expect(screen.queryByText('runs.drawer.input')).toBeNull()
  })

  it('shows the no-data placeholder for an empty bundle', () => {
    render(<RunStepList steps={[{ label: 'S', status: 'success', input: { a: 1 }, output: null }]} />)
    fireEvent.click(screen.getByText('S'))
    expect(screen.getByText('runs.drawer.noData')).toBeInTheDocument()
  })
})

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

// WF-DRYRUN-FE-1: a dry-run-skipped step (whatsapp_send etc.) reads as a
// DISTINCT chip, never the generic StatusBadge fallback a plain unknown status
// would get — and its "Dry-run: niet verzonden" message renders per the
// existing generic step.message treatment.
describe('RunStepList · WF-DRYRUN-FE-1 skipped rows', () => {
  it('renders a skipped step from step_results with its dry-run message', () => {
    const skipped = [
      { label: 'WhatsApp versturen', status: 'skipped', message: 'Dry-run: niet verzonden' },
      { label: 'Kandidaat bijwerken', status: 'success' },
    ]
    render(<RunStepList steps={skipped} />)
    // No real i18next instance runs in this file (mirrors the rest of this
    // suite) — t()'s own `defaultValue` option resolves instead of the raw key.
    expect(screen.getByText('Skipped')).toBeInTheDocument()
    expect(screen.getByText('Dry-run: niet verzonden')).toBeInTheDocument()
    // The real outcome next to it still reads as a normal success badge.
    expect(screen.getByText('success')).toBeInTheDocument()
  })
})

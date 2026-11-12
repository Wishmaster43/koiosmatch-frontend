/**
 * ReportCompareStatus — every state of an explicitly requested comparison renders
 * its own key (key echo); off and the happy path render nothing.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReportCompareStatus } from './ReportCompareStatus'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

describe('ReportCompareStatus', () => {
  it('renders nothing while compare is off', () => {
    const { container } = render(<ReportCompareStatus compare={{ kind: 'off' }} error />)
    expect(container).toBeEmptyDOMElement()
  })

  it('hints that an incomplete custom range needs both dates', () => {
    render(<ReportCompareStatus compare={{ kind: 'custom', from: '2026-01-01', to: '' }} />)
    expect(screen.getByText('compare.customRangeIncomplete')).toBeInTheDocument()
  })

  it('shows the loading line', () => {
    render(<ReportCompareStatus compare={{ kind: 'previous_period' }} loading />)
    expect(screen.getByText('compare.compareLoading')).toBeInTheDocument()
  })

  it('shows the error with a working retry', () => {
    const onRetry = vi.fn()
    render(<ReportCompareStatus compare={{ kind: 'previous_year' }} error onRetry={onRetry} />)
    expect(screen.getByText('compare.compareError')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders nothing for a complete range with data', () => {
    const { container } = render(<ReportCompareStatus compare={{ kind: 'custom', from: '2026-01-01', to: '2026-01-31' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

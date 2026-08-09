/**
 * VacancySearchFilters — COMPACT-1 regression coverage (Danny 09-08): two
 * defects fixed while compacting the bar. (1) the "Inzetbaar vanaf" filter
 * moved off a bare <input type="date"> onto the shared react-datepicker
 * convention (DD-MM-YYYY, mirrors ProfilePersonalTab's dob field); (2) the
 * reset button only renders while `filtersDirty` is genuinely true. These
 * tests pin both so the native inputs / the always-on button never regress.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18next instance so t() resolves actual locale strings, not raw keys.
import '@/i18n'
import VacancySearchFilters from './VacancySearchFilters'

// Minimal, fully-inert prop set — every callback is a spy, every gated filter
// off by default so each test opts IN to only what it needs.
const baseProps = {
  statusOptions: [{ value: 'open', label: 'Open' }],
  statuses: [],
  onStatusesChange: vi.fn(),
  functionOptions: ['Verpleegkundige'],
  functions: [],
  onFunctionsChange: vi.fn(),
  functionNotInLookup: false,
  contractvormOptions: ['ZZP'],
  contractvorm: [],
  onContractvormChange: vi.fn(),
  hasHoursData: false,
  hoursRange: [0, 40] as [number, number],
  hoursRangeMax: 40,
  onHoursRangeChange: vi.fn(),
  hasAvailableFromData: false,
  availableFrom: '',
  onAvailableFromChange: vi.fn(),
  filtersDirty: false,
  onReset: vi.fn(),
}

describe('VacancySearchFilters · no native browser controls (COMPACT-1 regression)', () => {
  it('never renders a native <input type="date"> or <input type="range">, even with both gated filters on', () => {
    const { container } = render(
      <VacancySearchFilters {...baseProps} hasHoursData hasAvailableFromData availableFrom="2026-08-20" />,
    )
    expect(container.querySelector('input[type="date"]')).toBeNull()
    expect(container.querySelector('input[type="range"]')).toBeNull()
  })

  it('renders the "Inzetbaar vanaf" value as DD-MM-YYYY via the shared datepicker', () => {
    render(<VacancySearchFilters {...baseProps} hasAvailableFromData availableFrom="2026-08-20" />)
    expect(screen.getByDisplayValue('20-08-2026')).toBeInTheDocument()
  })

  it('renders the hours-per-week range as the shared two-thumb Slider, not a raw input', () => {
    render(<VacancySearchFilters {...baseProps} hasHoursData />)
    expect(screen.getAllByRole('slider')).toHaveLength(2)
  })
})

describe('VacancySearchFilters · gated filters stay gated', () => {
  it('omits the date and hours filters entirely when their data gate is off', () => {
    render(<VacancySearchFilters {...baseProps} />)
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.queryByText('Inzetbaar vanaf')).toBeNull()
  })
})

describe('VacancySearchFilters · reset button only shows when something actually changed', () => {
  it('is absent while filtersDirty is false', () => {
    render(<VacancySearchFilters {...baseProps} filtersDirty={false} />)
    expect(screen.queryByRole('button', { name: 'Filters herstellen' })).toBeNull()
  })

  it('appears once filtersDirty flips true and calls onReset on click', async () => {
    const onReset = vi.fn()
    const user = userEvent.setup()
    render(<VacancySearchFilters {...baseProps} filtersDirty onReset={onReset} />)

    const button = screen.getByRole('button', { name: 'Filters herstellen' })
    expect(button).toBeInTheDocument()
    await user.click(button)
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})

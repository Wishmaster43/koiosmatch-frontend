/**
 * VacancySearchFilters — COMPACT-1 regression coverage (Danny 09-08): two
 * defects fixed while compacting the bar. (1) the "Inzetbaar vanaf" filter
 * moved off a bare <input type="date"> onto the shared react-datepicker
 * convention (DD-MM-YYYY, mirrors ProfilePersonalTab's dob field); (2) the
 * reset button only renders while `filtersDirty` is genuinely true. These
 * tests pin both so the native inputs / the always-on button never regress.
 *
 * P8-MORE-FILTERS (batch 8, option B): "Uren per week" + "Inzetbaar vanaf"
 * now live behind the shared DrawerFilterMenu popover — tests that reach
 * those two controls open it ("Meer filters") first. A section below covers
 * the popover trigger + the removable secondary-filter chips it feeds.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18next instance so t() resolves actual locale strings, not raw keys.
import '@/i18n'
import VacancySearchFilters from './VacancySearchFilters'

// This project ships no @types/node; process.env.TZ is a genuine Node global at
// test runtime (Vitest runs under Node) — this is a minimal local type shim for it.
declare const process: { env: Record<string, string | undefined> }

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

// Both secondary filters now live behind the "Meer filters" popover trigger —
// open it before reaching their controls (mirrors how a real user gets there).
const openMoreFilters = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Meer filters' }))
}

describe('VacancySearchFilters · no native browser controls (COMPACT-1 regression)', () => {
  it('never renders a native <input type="date"> or <input type="range">, even with both gated filters on', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <VacancySearchFilters {...baseProps} hasHoursData hasAvailableFromData availableFrom="2026-08-20" />,
    )
    await openMoreFilters(user)
    expect(container.querySelector('input[type="date"]')).toBeNull()
    expect(container.querySelector('input[type="range"]')).toBeNull()
  })

  it('renders the "Inzetbaar vanaf" value as DD-MM-YYYY via the shared datepicker, once the popover is open', async () => {
    const user = userEvent.setup()
    render(<VacancySearchFilters {...baseProps} hasAvailableFromData availableFrom="2026-08-20" />)
    await openMoreFilters(user)
    expect(screen.getByDisplayValue('20-08-2026')).toBeInTheDocument()
  })

  // Regression guard (Danny 09-08, UTC-date-shift fix): this filter used to carry its
  // OWN local toLocalIsoDate copy (now the shared src/lib/datetime one) — prove the
  // SENT value is the picked local day, not one rolled back by a UTC conversion.
  describe('sends the LOCAL calendar day, never UTC-shifted', () => {
    const originalTz = process.env.TZ
    beforeEach(() => {
      // Explicit TZ so this proves something on any machine, not just one that
      // happens to run in UTC (where old-buggy and fixed code would coincide).
      process.env.TZ = 'Europe/Amsterdam'
      // Freeze "now" just after local midnight (CET, winter) — the exact window where
      // `.toISOString().slice(0, 10)` used to roll the picked day back by one (measured
      // 09-08: picking 15 Jan 2026 saved as "2026-01-14"). Only Date is faked, so
      // userEvent's own internal timers keep ticking normally.
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 0, 15, 0, 30, 0))
    })
    afterEach(() => {
      vi.useRealTimers()
      process.env.TZ = originalTz
    })

    it('reports "2026-01-15" when the today cell is picked, not "2026-01-14"', async () => {
      const user = userEvent.setup()
      const onAvailableFromChange = vi.fn()
      render(<VacancySearchFilters {...baseProps} hasAvailableFromData availableFrom="" onAvailableFromChange={onAvailableFromChange} />)
      await openMoreFilters(user)
      await user.click(screen.getByRole('textbox'))
      // The calendar renders into the shared datepicker-portal, outside this filter row —
      // and outside the popover's own subtree, exercising the outside-click whitelist.
      const todayCell = document.querySelector('.react-datepicker__day--today') as HTMLElement
      expect(todayCell).toBeTruthy()
      await user.click(todayCell)
      expect(onAvailableFromChange).toHaveBeenCalledWith('2026-01-15')
    })
  })

  it('renders the hours-per-week range as the shared two-thumb Slider, not a raw input', async () => {
    const user = userEvent.setup()
    render(<VacancySearchFilters {...baseProps} hasHoursData />)
    await openMoreFilters(user)
    expect(screen.getAllByRole('slider')).toHaveLength(2)
  })
})

describe('VacancySearchFilters · gated filters stay gated', () => {
  it('omits the "Meer filters" trigger entirely when neither secondary filter is offered', () => {
    render(<VacancySearchFilters {...baseProps} />)
    expect(screen.queryByRole('button', { name: 'Meer filters' })).toBeNull()
  })
})

describe('VacancySearchFilters · secondary filters as removable chips (P8-more-filters)', () => {
  it('an active hours-per-week narrowing shows as a removable chip beside the trigger', async () => {
    render(<VacancySearchFilters {...baseProps} hasHoursData hoursRange={[8, 32]} />)
    expect(screen.getByText('8–32 uur/week')).toBeInTheDocument()
  })

  it('the resting (unbounded) hours range shows NO chip — it has not actually narrowed anything', () => {
    render(<VacancySearchFilters {...baseProps} hasHoursData hoursRange={[0, 40]} />)
    expect(screen.queryByText(/uur\/week/)).toBeNull()
  })

  it('clicking the hours chip\'s × resets the range to fully open, without opening the popover', async () => {
    const user = userEvent.setup()
    const onHoursRangeChange = vi.fn()
    render(<VacancySearchFilters {...baseProps} hasHoursData hoursRange={[8, 32]} onHoursRangeChange={onHoursRangeChange} />)
    await user.click(screen.getByRole('button', { name: "Filter 'Uren per week' verwijderen" }))
    expect(onHoursRangeChange).toHaveBeenCalledWith([0, 40])
  })

  it('an active "Inzetbaar vanaf" shows as a removable chip with a DD-MM-YYYY label', () => {
    render(<VacancySearchFilters {...baseProps} hasAvailableFromData availableFrom="2026-08-20" />)
    expect(screen.getByText('Inzetbaar vanaf: 20-08-2026')).toBeInTheDocument()
  })

  it('clicking the "Inzetbaar vanaf" chip\'s × clears it to \'\'', async () => {
    const user = userEvent.setup()
    const onAvailableFromChange = vi.fn()
    render(<VacancySearchFilters {...baseProps} hasAvailableFromData availableFrom="2026-08-20" onAvailableFromChange={onAvailableFromChange} />)
    await user.click(screen.getByRole('button', { name: "Filter 'Inzetbaar vanaf' verwijderen" }))
    expect(onAvailableFromChange).toHaveBeenCalledWith('')
  })

  it('the badge on "Meer filters" counts exactly the active secondary filters', () => {
    render(<VacancySearchFilters {...baseProps} hasHoursData hoursRange={[8, 32]} hasAvailableFromData availableFrom="2026-08-20" />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

// FILTER-VLAK-1 (Danny 13-08, rustplan step 1+2): the three fixed triggers
// carry their own label + count, no separate field label; the reset link and
// the active secondary chips only render on a SITUATIONAL second row, and only
// while something is genuinely active — this pins that structure.
describe('VacancySearchFilters · single-row structure (FILTER-VLAK-1)', () => {
  it('renders no bare field labels beside the three fixed triggers — the label lives inside the trigger', () => {
    render(<VacancySearchFilters {...baseProps} statuses={['open']} />)
    // The trigger carries the label + a count badge, never a separate label span.
    const trigger = screen.getByRole('button', { name: 'Vacaturestatus' })
    expect(trigger).toHaveTextContent('Vacaturestatus')
    expect(trigger).toHaveTextContent('1')
  })

  it('shows no second row at all while every filter is at rest', () => {
    render(<VacancySearchFilters {...baseProps} />)
    expect(screen.queryByRole('button', { name: 'Filters herstellen' })).toBeNull()
    expect(screen.queryByText(/uur\/week/)).toBeNull()
  })

  it('the active hours chip and the reset link appear TOGETHER once a filter narrows the search', () => {
    render(<VacancySearchFilters {...baseProps} hasHoursData hoursRange={[8, 32]} filtersDirty />)
    expect(screen.getByText('8–32 uur/week')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filters herstellen' })).toBeInTheDocument()
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

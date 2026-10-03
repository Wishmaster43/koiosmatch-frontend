/**
 * FilterValueControl — unit tests for the operator-driven value control
 * (FILTER-VALUE-1). Real i18n is not initialized (mirrors EdgeFilterPanel.test.tsx),
 * so labels render as their raw i18n keys; assertions target those raw keys.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FilterValueControl from './FilterValueControl'

// Mocks the WHOLE module (never the real LookupsContext/LookupsProvider) so
// this suite keeps its deliberate i18n-free isolation (DATETIME-IMPORT-LES) —
// the real context's own translateSeedList pulls in useTranslation/i18n-init.
vi.mock('@/context/LookupsContext', () => ({
  useLookupsOptional: () => ({
    statuses: [{ value: 'available', label: 'Available', color: '#000' }],
    phases: [], candidateTypes: [], funnelTypes: [],
  }),
}))

describe('FilterValueControl · day-count operators', () => {
  it('reads/writes a plain day-count string', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="date_older_than_days" value="30" onChange={onChange} ariaLabel="value" />)
    const input = screen.getByLabelText('value') as HTMLInputElement
    expect(input.value).toBe('30')
    fireEvent.change(input, { target: { value: '45' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith('45')
  })
})

describe('FilterValueControl · date_* operators', () => {
  it('starts in fixed mode for a stored YYYY-MM-DD value and writes the raw ISO date', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="date_gte" value="2026-10-02" onChange={onChange} ariaLabel="value" />)
    expect(screen.getByDisplayValue('2026-10-02')).toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue('2026-10-02'), { target: { value: '2026-12-01' } })
    expect(onChange).toHaveBeenCalledWith('2026-12-01')
  })

  it('parses now-90d back as minus/90/days — never auto-promoted to weeks/months', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="date_gte" value="now-90d" onChange={onChange} ariaLabel="value" />)
    // Relative mode is already selected (the stored value parses as relative).
    expect(screen.getByText('canvas.dateModeRelative')).toBeInTheDocument()
    const amount = screen.getAllByLabelText('value').pop() as HTMLInputElement
    expect(amount.value).toBe('90')
    expect(screen.getAllByText('canvas.unitDays').length).toBeGreaterThan(0)
  })

  it('parses a non-multiple day count (now-10d) back into days, never silently rounding', () => {
    render(<FilterValueControl operator="date_gte" value="now-10d" onChange={vi.fn()} ariaLabel="value" />)
    const amount = screen.getAllByLabelText('value').pop() as HTMLInputElement
    expect(amount.value).toBe('10')
    expect(screen.getAllByText('canvas.unitDays').length).toBeGreaterThan(0)
  })

  it('days is the default unit, so typing 2 is written as now-2d', () => {
    const onChange = vi.fn()
    const { rerender } = render(<FilterValueControl operator="date_gte" value="now" onChange={onChange} ariaLabel="value" />)
    fireEvent.click(screen.getByText('canvas.dateModeRelative'))
    rerender(<FilterValueControl operator="date_gte" value="now" onChange={onChange} ariaLabel="value" />)
    const amount = screen.getAllByLabelText('value').pop() as HTMLInputElement
    fireEvent.change(amount, { target: { value: '2' } })
    fireEvent.blur(amount)
    expect(onChange).toHaveBeenCalledWith('now-2d')
  })

  // ADDENDUM 4 (CMBE confirmed): weeks/months store NATIVELY ('w'/'m' suffix),
  // never converted to a day count any more.
  it('switching the unit to weeks stores the amount natively (2 weeks -> now-2w)', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="date_gte" value="now-2d" onChange={onChange} ariaLabel="value" />)
    // Unit menu's trigger is named by the hidden label (current value: days).
    fireEvent.click(screen.getByRole('button', { name: /^canvas\.unitDays/ }))
    fireEvent.click(screen.getByText('canvas.unitWeeks'))
    expect(onChange).toHaveBeenCalledWith('now-2w')
  })

  it('REGRESSION: "2 weeks" writes now-2w (ADDENDUM 4, never ×7 into days)', () => {
    const onChange = vi.fn()
    const { rerender } = render(<FilterValueControl operator="date_gte" value="now" onChange={onChange} ariaLabel="value" />)
    fireEvent.click(screen.getByText('canvas.dateModeRelative'))
    rerender(<FilterValueControl operator="date_gte" value={onChange.mock.calls.at(-1)?.[0]} onChange={onChange} ariaLabel="value" />)
    fireEvent.click(screen.getByRole('button', { name: /^canvas\.unitDays/ }))
    fireEvent.click(screen.getByText('canvas.unitWeeks'))
    rerender(<FilterValueControl operator="date_gte" value={onChange.mock.calls.at(-1)?.[0]} onChange={onChange} ariaLabel="value" />)
    const amount = screen.getAllByLabelText('value').pop() as HTMLInputElement
    fireEvent.change(amount, { target: { value: '2' } })
    fireEvent.blur(amount)
    expect(onChange).toHaveBeenLastCalledWith('now-2w')
  })

  it('REGRESSION: now-14d reads back as 14 DAYS, never promoted to 2 weeks', () => {
    render(<FilterValueControl operator="date_gte" value="now-14d" onChange={vi.fn()} ariaLabel="value" />)
    const amount = screen.getAllByLabelText('value').pop() as HTMLInputElement
    expect(amount.value).toBe('14')
    expect(screen.getAllByText('canvas.unitDays').length).toBeGreaterThan(0)
  })

  it('reads a stored now-3m back as 3 months', () => {
    render(<FilterValueControl operator="date_gte" value="now-3m" onChange={vi.fn()} ariaLabel="value" />)
    const amount = screen.getAllByLabelText('value').pop() as HTMLInputElement
    expect(amount.value).toBe('3')
    expect(screen.getAllByText('canvas.unitMonths').length).toBeGreaterThan(0)
  })

  it('REGRESSION: typing "3" then "30" in days mode keeps the input at 30 and the unit at days (never re-promotes to months mid-typing)', () => {
    const onChange = vi.fn()
    const { rerender } = render(<FilterValueControl operator="date_gte" value="now-1d" onChange={onChange} ariaLabel="value" />)
    const amountFirst = screen.getAllByLabelText('value').pop() as HTMLInputElement
    fireEvent.change(amountFirst, { target: { value: '3' } })
    rerender(<FilterValueControl operator="date_gte" value={onChange.mock.calls.at(-1)?.[0]} onChange={onChange} ariaLabel="value" />)
    const amountSecond = screen.getAllByLabelText('value').pop() as HTMLInputElement
    fireEvent.change(amountSecond, { target: { value: '30' } })
    rerender(<FilterValueControl operator="date_gte" value={onChange.mock.calls.at(-1)?.[0]} onChange={onChange} ariaLabel="value" />)
    const amountFinal = screen.getAllByLabelText('value').pop() as HTMLInputElement
    expect(amountFinal.value).toBe('30')
    expect(screen.getAllByText('canvas.unitDays').length).toBeGreaterThan(0)
    expect(onChange).toHaveBeenLastCalledWith('now-30d')
  })

  it('REGRESSION: starting from now, picking weeks then typing 2 writes now-2w (the chosen unit is not lost when the amount was 0)', () => {
    const onChange = vi.fn()
    const { rerender } = render(<FilterValueControl operator="date_gte" value="now" onChange={onChange} ariaLabel="value" />)
    fireEvent.click(screen.getByText('canvas.dateModeRelative'))
    rerender(<FilterValueControl operator="date_gte" value={onChange.mock.calls.at(-1)?.[0]} onChange={onChange} ariaLabel="value" />)
    fireEvent.click(screen.getByRole('button', { name: /^canvas\.unitDays/ }))
    fireEvent.click(screen.getByText('canvas.unitWeeks'))
    rerender(<FilterValueControl operator="date_gte" value={onChange.mock.calls.at(-1)?.[0]} onChange={onChange} ariaLabel="value" />)
    const amount = screen.getAllByLabelText('value').pop() as HTMLInputElement
    fireEvent.change(amount, { target: { value: '2' } })
    fireEvent.blur(amount)
    expect(onChange).toHaveBeenLastCalledWith('now-2w')
  })

  it('REGRESSION (lens 2): an external wire change (another condition after a delete) resyncs the relative fields, while its own write never resets them', () => {
    const onChange = vi.fn()
    const { rerender } = render(<FilterValueControl operator="date_gte" field="x" value="now-90d" onChange={onChange} ariaLabel="v" />)
    const amount = screen.getByRole('spinbutton') as HTMLInputElement
    expect(amount.value).toBe('90')
    // The panel re-keys the row: this control now receives a different condition's value.
    rerender(<FilterValueControl operator="date_gte" field="x" value="now+5d" onChange={onChange} ariaLabel="v" />)
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('5')
    // Its own write echoes back as the new prop and must not reset the fields.
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } })
    const written = onChange.mock.calls.at(-1)?.[0]
    expect(written).toBe('now+12d')
    rerender(<FilterValueControl operator="date_gte" field="x" value={written} onChange={onChange} ariaLabel="v" />)
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('12')
  })

  it('fixed mode never shows an ISO string as text outside the native date input (DATUM-1)', () => {
    render(<FilterValueControl operator="date_lt" value="2026-10-02" onChange={vi.fn()} ariaLabel="value" />)
    // The ISO string only lives inside the native <input type="date">'s value attribute.
    const dateInput = screen.getByDisplayValue('2026-10-02')
    expect(dateInput.tagName).toBe('INPUT')
    expect((dateInput as HTMLInputElement).type).toBe('date')
  })
})

describe('FilterValueControl · list operators (in / not_in)', () => {
  it('renders existing values as chips and adds a typed value on Enter', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="in" value="actief,verwijderd" onChange={onChange} ariaLabel="value" />)
    expect(screen.getByText('actief')).toBeInTheDocument()
    expect(screen.getByText('verwijderd')).toBeInTheDocument()
    const input = screen.getByLabelText('value')
    fireEvent.change(input, { target: { value: 'extern' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('actief,verwijderd,extern')
  })

  it('removing a chip rewrites the comma-separated string', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="not_in" value="a,b,c" onChange={onChange} ariaLabel="value" />)
    fireEvent.click(screen.getAllByLabelText('canvas.removeValue')[0])
    expect(onChange).toHaveBeenCalledWith('b,c')
  })

  // REGRESSION (02-10, measured on the seeded Yesway AI-agent workflow): the stored
  // not_in value is a real ARRAY, not a comma string; the chip editor crashed with
  // "text.split is not a function". The array form must render and be preserved.
  it('REGRESSION: a seeded ARRAY value renders every item as a chip and removal writes an array back', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="not_in" value={['a', 'b', 'c']} onChange={onChange} ariaLabel="value" />)
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
    expect(screen.getByText('c')).toBeInTheDocument()
    fireEvent.click(screen.getAllByLabelText('canvas.removeValue')[1])
    expect(onChange).toHaveBeenCalledWith(['a', 'c'])
  })

  it('adding to an ARRAY value keeps the array form (never flips the stored shape)', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="in" value={['a']} onChange={onChange} ariaLabel="value" />)
    const input = screen.getByLabelText('value')
    fireEvent.change(input, { target: { value: 'b' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['a', 'b'])
  })
})

describe('FilterValueControl · array value on a non-list operator', () => {
  it('shows the comma-joined text in the plain input instead of crashing', () => {
    render(<FilterValueControl operator="=" value={['a', 'b']} onChange={vi.fn()} ariaLabel="value" />)
    expect(screen.getByLabelText('value')).toHaveValue('a,b')
  })
})

describe('FilterValueControl · boolean field (unchanged)', () => {
  it('renders the yes/no menu and saves a real boolean', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="=" field="whatsapp_consent" value={undefined} onChange={onChange} ariaLabel="value" />)
    fireEvent.click(screen.getByRole('button', { name: /^value/ }))
    fireEvent.click(screen.getByText('common:yes'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('FilterValueControl · default text operators', () => {
  it('falls back to the plain text input for an untyped operator', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="contains" value="Anna" onChange={onChange} ariaLabel="value" />)
    const input = screen.getByLabelText('value') as HTMLInputElement
    expect(input.value).toBe('Anna')
    fireEvent.change(input, { target: { value: 'Anna2' } })
    expect(onChange).toHaveBeenCalledWith('Anna2')
  })

  it('renders no mapping button when there are no upstream variables', () => {
    render(<FilterValueControl operator="contains" value="Anna" onChange={vi.fn()} ariaLabel="value" />)
    expect(screen.queryByTitle('canvas.mapField')).not.toBeInTheDocument()
  })
})

// FILTER-MAPPING-1 — picking "1. SM employees · Status" inserts the confirmed
// token into the value (Build-exactly-this #1/#4).
describe('FilterValueControl · mapping ("{ }") affordance', () => {
  const variables = [
    { nodeId: 'n1', moduleType: 'sm_candidates', customName: '1. SM employees', hasRun: true,
      fields: [{ token: '{{1.status}}', label: 'status', sample: 'Status' }] },
  ]

  it('plain text input: inserting a mapped field appends its token', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="contains" value="" onChange={onChange} ariaLabel="value" variables={variables} />)
    fireEvent.click(screen.getByTitle('canvas.mapField'))
    fireEvent.click(screen.getByText('Status'))
    expect(onChange).toHaveBeenCalledWith('{{1.status}}')
  })

  it('list operator: inserting a mapped field adds it as a chip, shown with its module · field label', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="in" value="actief" onChange={onChange} ariaLabel="value" variables={variables} />)
    fireEvent.click(screen.getByTitle('canvas.mapField'))
    fireEvent.click(screen.getByText('Status'))
    expect(onChange).toHaveBeenCalledWith('actief,{{1.status}}')
  })

  it('a token already stored in the list renders as "module · field", not the raw token', () => {
    render(<FilterValueControl operator="not_in" value="{{1.status}}" onChange={vi.fn()} ariaLabel="value" variables={variables} />)
    expect(screen.getByText('1. SM employees · Status')).toBeInTheDocument()
    expect(screen.queryByText('{{1.status}}')).not.toBeInTheDocument()
  })
})

// FILTER-MAPPING-1 — a field with a known `source` lookup renders a searchable
// multi-select of the lookup's values instead of free chips (Build-exactly-this #2).
describe('FilterValueControl · known-vocabulary (source) picker', () => {
  it('in/not_in: the add control lists the lookup options and stores the picked slug', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="in" value="" onChange={onChange} ariaLabel="value" source="candidate_statuses" />)
    fireEvent.click(screen.getByText('fields.valuePlaceholder'))
    fireEvent.click(screen.getByText('Available'))
    expect(onChange).toHaveBeenCalledWith('available')
  })

  it('=/!=: a single searchable lookup value replaces the free text input', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="=" value="" onChange={onChange} ariaLabel="value" source="candidate_statuses" />)
    fireEvent.click(screen.getByText('fields.valuePlaceholder'))
    fireEvent.click(screen.getByText('Available'))
    expect(onChange).toHaveBeenCalledWith('available')
  })

  it('an unknown source keeps the free chip editor (no fake affordance)', () => {
    render(<FilterValueControl operator="in" value="actief" onChange={vi.fn()} ariaLabel="value" source="something_else" />)
    expect(screen.getByLabelText('value')).toBeInTheDocument()
  })

  // A chip for a known-source value must show the lookup's own label, never
  // the raw stored slug — only the dropdown's options used to translate it.
  it('a stored source value renders its lookup label on the chip, not the raw slug', () => {
    const onChange = vi.fn()
    render(<FilterValueControl operator="in" value="available" onChange={onChange} ariaLabel="value" source="candidate_statuses" />)
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.queryByText('available')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('canvas.removeValue'))
    expect(onChange).toHaveBeenCalledWith('')
  })
})

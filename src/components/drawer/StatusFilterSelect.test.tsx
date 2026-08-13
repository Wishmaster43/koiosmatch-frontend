/**
 * useStatusFilter · tenant-configured default (TENANT-DEFAULT-1, Danny 02-08). The
 * "active only" guess was a heuristic on a TENANT-RENAMEABLE lookup — a tenant who
 * renamed that status got no default at all, silently. These tests cover the
 * setting that REPLACES the guess: absent (`undefined`) reproduces the exact
 * original guess; `STATUS_FILTER_ALL` is an explicit choice the guess must never
 * override; and a stale/deleted status id falls back to "all" rather than
 * filtering to a value nothing can ever match — the same failure mode the
 * original guess-heuristic guard exists to prevent.
 *
 * MOVED (Danny 03-08, TAKEN-TOOLBAR-1) from pages/customers/drawer/ alongside the
 * component itself — see StatusFilterSelect.tsx's own docblock for why.
 */
import { describe, it, expect } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import { useStatusFilter, STATUS_FILTER_ALL } from './StatusFilterSelect'
import type { LookupOption } from '@/types/common'

interface Row { statusId: string }
// Must satisfy LookupOption, which carries an index signature — a bare local
// interface does not, and the hook takes LookupOption[].
type Status = LookupOption & { id: string }

// Minimal harness — exposes the hook's own decision (`value`, `filtered.length`) via
// data attributes, with no UI chrome in the way of the assertion.
function Harness({ rows, statuses, tenantDefault, settingsLoaded }: {
  rows: Row[]; statuses: Status[]; tenantDefault?: string | null; settingsLoaded?: boolean
}) {
  const { value, filtered } = useStatusFilter(rows, statuses, r => r.statusId, tenantDefault, settingsLoaded)
  return <div data-testid="result" data-value={value.join(',')} data-count={filtered.length} />
}

const statuses: Status[] = [
  { id: 's-active', value: 'active', label: 'Actief' },
  { id: 's-inactive', value: 'inactive', label: 'Inactief' },
]
const rows: Row[] = [{ statusId: 's-active' }, { statusId: 's-inactive' }]

describe('useStatusFilter · absent tenant default reproduces the ORIGINAL guess', () => {
  it('proposes the active-like status once both statuses and rows are loaded', () => {
    render(<Harness rows={rows} statuses={statuses} />)
    const el = screen.getByTestId('result')
    expect(el).toHaveAttribute('data-value', 's-active')
    expect(el).toHaveAttribute('data-count', '1')
  })

  it('never proposes anything when no row actually carries the guessed status', () => {
    const noActiveRows: Row[] = [{ statusId: 's-inactive' }]
    render(<Harness rows={noActiveRows} statuses={statuses} />)
    const el = screen.getByTestId('result')
    expect(el).toHaveAttribute('data-value', '')
    expect(el).toHaveAttribute('data-count', '1')
  })
})

describe('useStatusFilter · STATUS_FILTER_ALL is a real, explicit choice', () => {
  it('stays "all" (every row) even though a guessable active status exists — the guess never overrides it', () => {
    render(<Harness rows={rows} statuses={statuses} tenantDefault={STATUS_FILTER_ALL} />)
    const el = screen.getByTestId('result')
    expect(el).toHaveAttribute('data-value', '')
    expect(el).toHaveAttribute('data-count', '2')
  })
})

describe('useStatusFilter · a specific tenant-chosen status id', () => {
  it('applies it once the lookup has resolved, replacing the guess entirely', () => {
    render(<Harness rows={rows} statuses={statuses} tenantDefault="s-inactive" />)
    const el = screen.getByTestId('result')
    expect(el).toHaveAttribute('data-value', 's-inactive')
    expect(el).toHaveAttribute('data-count', '1')
  })

  it('falls back to "all" when the chosen status no longer exists in the current lookup', () => {
    // Guards the exact bug class the docblock warns about: a default pointing at a value
    // no row (and here, no STATUS) carries would otherwise hide every row forever.
    render(<Harness rows={rows} statuses={statuses} tenantDefault="s-deleted" />)
    const el = screen.getByTestId('result')
    expect(el).toHaveAttribute('data-value', '')
    expect(el).toHaveAttribute('data-count', '2')
  })

  it('waits for the lookup to resolve before applying — never against an empty statuses list', () => {
    render(<Harness rows={rows} statuses={[]} tenantDefault="s-inactive" />)
    const el = screen.getByTestId('result')
    expect(el).toHaveAttribute('data-value', '')
    expect(el).toHaveAttribute('data-count', '2')
  })
})

describe('useStatusFilter · settingsLoaded guards the SECOND async race (the /settings blob itself)', () => {
  it('decides nothing while settingsLoaded is false, even with a tenant default and resolved statuses/rows', () => {
    // Mirrors the real race: /settings has not answered yet, so a caller reading a
    // tenant default off it cannot yet tell "absent" from "not loaded" — the hook must
    // not guess in the meantime, or it will lock in the wrong answer for good.
    render(<Harness rows={rows} statuses={statuses} tenantDefault="s-inactive" settingsLoaded={false} />)
    const el = screen.getByTestId('result')
    expect(el).toHaveAttribute('data-value', '')
    expect(el).toHaveAttribute('data-count', '2')
  })

  it('applies the real tenant default once settingsLoaded flips true — never fell back to the guess in the meantime', () => {
    const { rerender } = render(<Harness rows={rows} statuses={statuses} tenantDefault={null} settingsLoaded={false} />)
    rerender(<Harness rows={rows} statuses={statuses} tenantDefault="s-inactive" settingsLoaded />)
    const el = screen.getByTestId('result')
    expect(el).toHaveAttribute('data-value', 's-inactive')
  })
})

// K2-FE (13-08): `alwaysMatch` — the BE's "a vacancy without a status stays eligible"
// rule has no lookup value a status-less row could be selected by, so it needs a row
// to bypass the selection entirely rather than being represented by a key in `value`.
interface GuessRow { statusId: string }
function GuessHarness({ rows, statuses, alwaysMatch }: {
  rows: GuessRow[]; statuses: Status[]; alwaysMatch?: (row: GuessRow) => boolean
}) {
  const { filtered } = useStatusFilter(rows, statuses, r => r.statusId, undefined, true,
    opts => opts.map(o => String(o.id)), alwaysMatch)
  return <div data-testid="result" data-titles={filtered.map(r => r.statusId).join(',')} />
}

describe('useStatusFilter · alwaysMatch bypasses the selection', () => {
  it('keeps a status-less row visible even though the default selection only carries real status ids', () => {
    const rowsWithStatusless: GuessRow[] = [...rows, { statusId: '' }]
    render(<GuessHarness rows={rowsWithStatusless} statuses={statuses} alwaysMatch={r => r.statusId === ''} />)
    const el = screen.getByTestId('result')
    // Both real-status rows (matched by the guess) AND the status-less row (matched by
    // `alwaysMatch`) survive the filter.
    expect(el).toHaveAttribute('data-titles', 's-active,s-inactive,')
  })

  it('without alwaysMatch, a row whose key matches nothing selected is dropped (original behaviour unchanged)', () => {
    const rowsWithStatusless: GuessRow[] = [...rows, { statusId: '' }]
    render(<GuessHarness rows={rowsWithStatusless} statuses={statuses} />)
    const el = screen.getByTestId('result')
    expect(el).toHaveAttribute('data-titles', 's-active,s-inactive')
  })
})

// K2-FE control-round regression: a flag-derived guess must apply even when it
// matches ZERO rows — an all-closed customer shows an honest empty list, exactly
// like its open_vacancies_count column. The row-intersection guard only protects
// name-based guesses.
describe('useStatusFilter · strictGuess', () => {
  it('applies the flag-derived default even when no row carries a matching status', () => {
    const statuses = [
      { id: 'u1', value: 'u1', label: 'Open', isClosed: false },
      { id: 'u2', value: 'u2', label: 'Gesloten', isClosed: true },
    ]
    const rows = [{ statusId: 'u2' }, { statusId: 'u2' }] // all closed
    const { result } = renderHook(() => useStatusFilter(
      rows, statuses, r => String(r.statusId), null, true,
      opts => opts.filter(o => (o as { isClosed?: boolean }).isClosed !== true).map(o => String(o.value)),
      undefined,
      true, // strictGuess
    ))
    expect(result.current.value).toEqual(['u1'])
    expect(result.current.filtered).toEqual([]) // honest zero — column parity
  })
})

import { describe, it, expect } from 'vitest'
import { escapeCsvCell } from './csv'

// CSV formula-injection mitigation (C-14): a cell starting with = + - @ must never
// reach a spreadsheet unguarded — Excel/Sheets would execute it as a formula.
describe('escapeCsvCell', () => {
  it('quote-wraps a plain string', () => {
    expect(escapeCsvCell('hello')).toBe('"hello"')
  })

  it('doubles internal quotes', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('prefixes a leading = with an apostrophe (formula injection)', () => {
    expect(escapeCsvCell('=cmd|"/c calc"!A1')).toBe('"\'=cmd|""/c calc""!A1"')
  })

  it('prefixes a leading + - or @', () => {
    expect(escapeCsvCell('+1234')).toBe('"\'+1234"')
    expect(escapeCsvCell('-1234')).toBe('"\'-1234"')
    expect(escapeCsvCell('@SUM(A1:A2)')).toBe('"\'@SUM(A1:A2)"')
  })

  it('prefixes a leading tab or carriage return', () => {
    expect(escapeCsvCell('\t=1+1')).toBe('"\'\t=1+1"')
  })

  it('leaves a finite number unquoted', () => {
    expect(escapeCsvCell(42)).toBe('42')
    expect(escapeCsvCell(-3.5)).toBe('-3.5')
  })

  it('renders null/undefined as an empty quoted cell', () => {
    expect(escapeCsvCell(null)).toBe('""')
    expect(escapeCsvCell(undefined)).toBe('""')
  })
})

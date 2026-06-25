import { describe, it, expect } from 'vitest'
import { buildShiftsFilterGroups } from './buildShiftsFilterGroups'

// Identity t so labels are predictable; no-op setters (we assert structure only).
const noop = () => {}
const baseArgs = {
  t: (k) => k,
  seriesLabel: (k) => k,
  period: 'month',
  selectedYears: [2026],
  selectedMonths: [],
  visible: ['totaal'],
  selectedJobTypes: [],
  selectedCustomers: [],
  selectedLocations: [],
  filterOptions: { job_types: ['Verzorgende IG'], locations: [{ id: 1, name: 'Loc A', customer: 'Klant X' }] },
  fixedCustomers: [],
  fixedLocationIds: [],
  setPeriod: noop, toggleYear: noop, setSelectedMonths: noop, setVisible: noop,
  setSelectedJobTypes: noop, setSelectedCustomers: noop, setSelectedLocations: noop,
}
const keysOf = (args) => buildShiftsFilterGroups(args).map(g => g.key)

describe('buildShiftsFilterGroups', () => {
  it('includes the months group only in month period', () => {
    expect(keysOf(baseArgs)).toContain('maanden')
    expect(keysOf({ ...baseArgs, period: 'quarter' })).not.toContain('maanden')
  })

  it('always has period · years · series', () => {
    const keys = keysOf(baseArgs)
    expect(keys).toEqual(expect.arrayContaining(['periode', 'jaren', 'reeksen']))
  })

  it('shows the job-type group only when options exist', () => {
    expect(keysOf(baseArgs)).toContain('functie')
    expect(keysOf({ ...baseArgs, filterOptions: { job_types: [], locations: [] } })).not.toContain('functie')
  })

  it('hides customer + location groups when a fixed scope is set', () => {
    expect(keysOf(baseArgs)).toEqual(expect.arrayContaining(['klant', 'locatie']))
    expect(keysOf({ ...baseArgs, fixedLocationIds: ['9'] })).not.toContain('locatie')
    expect(keysOf({ ...baseArgs, fixedCustomers: ['Klant X'] })).not.toContain('klant')
  })

  it('builds customer options as unique sorted customer names', () => {
    const groups = buildShiftsFilterGroups({
      ...baseArgs,
      filterOptions: { job_types: [], locations: [
        { id: 1, name: 'A', customer: 'Zorg B' },
        { id: 2, name: 'B', customer: 'Aha A' },
        { id: 3, name: 'C', customer: 'Zorg B' },
      ] },
    })
    const klant = groups.find(g => g.key === 'klant')
    expect(klant.options.map(o => o.value)).toEqual(['Aha A', 'Zorg B'])
  })
})

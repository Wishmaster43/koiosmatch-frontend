/**
 * buildMatchFilterGroups — seam test for the new branch/scored-unscored/
 * date-range/archived groups (parity sweep, half 2). Asserts the archived
 * group's onToggle flips the SAME showArchived flag useMatches sends as its
 * fetch param (?include_archived=1), and the score-state checkbox drives the
 * two distinct booleans, not a single toggle that would collide.
 */
import { describe, it, expect, vi } from 'vitest'
import '@/i18n'
import i18n from '@/i18n'
import { buildMatchFilterGroups } from './matchFilterGroups'

const tog = (set: (fn: (p: string[]) => string[]) => void) => (v: string | number) =>
  set(p => p.includes(String(v)) ? p.filter(x => x !== String(v)) : [...p, String(v)])

function build(overrides: Partial<Parameters<typeof buildMatchFilterGroups>[0]> = {}) {
  const setShowArchived = vi.fn()
  const setKpiScored = vi.fn()
  const setKpiUnscored = vi.fn()
  const setDateRange = vi.fn()
  const setContractFormFilter = vi.fn()
  const setContractTypeFilter = vi.fn()
  const args = {
    t: i18n.getFixedT('nl', 'matches'),
    tog,
    stageFilter: [], setStageFilter: vi.fn(),
    ownerFilter: [], setOwnerFilter: vi.fn(),
    clientFilter: [], setClientFilter: vi.fn(),
    branchFilter: [], setBranchFilter: vi.fn(),
    contractFormFilter: [], setContractFormFilter,
    contractTypeFilter: [], setContractTypeFilter,
    kpiScored: false, setKpiScored,
    kpiUnscored: false, setKpiUnscored,
    dateRange: null, setDateRange,
    showArchived: false, setShowArchived,
    stageData: [], ownerData: [], clientData: [],
    branchOptions: [{ value: 'Amsterdam', label: 'Amsterdam', count: 4 }],
    contractFormOptions: [],
    contractTypeOptions: [],
    ...overrides,
  } as Parameters<typeof buildMatchFilterGroups>[0]
  return { groups: buildMatchFilterGroups(args), setShowArchived, setKpiScored, setKpiUnscored, setDateRange, setContractFormFilter, setContractTypeFilter }
}

describe('buildMatchFilterGroups · parity groups (half 2)', () => {
  it('emits an archived checkbox group whose onToggle flips the request-driving flag', () => {
    const { groups, setShowArchived } = build()
    const archived = groups.find(g => g.key === 'archived') as unknown as { onToggle: () => void }
    archived.onToggle()
    const updater = setShowArchived.mock.calls[0][0] as (v: boolean) => boolean
    expect(updater(false)).toBe(true)
  })

  it('routes the scored/unscored checkbox picks to their OWN distinct setters', () => {
    const { groups, setKpiScored, setKpiUnscored } = build()
    const scored = groups.find(g => g.key === 'scored') as { onToggle: (v: string) => void }
    scored.onToggle('scored')
    expect(setKpiScored).toHaveBeenCalledTimes(1)
    expect(setKpiUnscored).not.toHaveBeenCalled()
    scored.onToggle('unscored')
    expect(setKpiUnscored).toHaveBeenCalledTimes(1)
  })

  it('emits a branch group from the loaded rows, never a hardcoded list', () => {
    const { groups } = build()
    const branch = groups.find(g => g.key === 'branch') as { options: { value: string }[] }
    expect(branch.options.map(o => o.value)).toEqual(['Amsterdam'])
  })

  it('emits a date-range group that calls setDateRange with the real from/to on change', () => {
    const { groups, setDateRange } = build()
    const range = groups.find(g => g.key === 'dateRange') as { onFromChange: (v: string) => void }
    range.onFromChange('2026-02-01')
    expect(setDateRange).toHaveBeenCalledWith({ from: '2026-02-01', to: '' })
  })

  it('omits the contract-form group when no options are loaded (default arg, no crash)', () => {
    const { groups } = build()
    expect(groups.find(g => g.key === 'contractForm')).toBeUndefined()
  })

  it('emits a contract-form group from the loaded options and routes onToggle to its own setter', () => {
    const { groups, setContractFormFilter } = build({
      contractFormOptions: [{ value: 'zzp', label: 'ZZP', count: 3 }],
    })
    const contractForm = groups.find(g => g.key === 'contractForm') as { label: string; options: { value: string }[]; onToggle: (v: string) => void }
    expect(contractForm.label).toBe(i18n.getFixedT('nl', 'matches')('cols.contractForm'))
    expect(contractForm.options.map(o => o.value)).toEqual(['zzp'])
    contractForm.onToggle('zzp')
    expect(setContractFormFilter).toHaveBeenCalledTimes(1)
  })

  it('omits the contract-type group when no options are loaded (default arg, no crash)', () => {
    const { groups } = build()
    expect(groups.find(g => g.key === 'contractType')).toBeUndefined()
  })

  it('emits a contract-type group from the loaded options and routes onToggle to its own setter', () => {
    const { groups, setContractTypeFilter } = build({
      contractTypeOptions: [{ value: 'uitzendbeding', label: 'Uitzendbeding', count: 4 }],
    })
    const contractType = groups.find(g => g.key === 'contractType') as { label: string; options: { value: string }[]; onToggle: (v: string) => void }
    expect(contractType.label).toBe('Contractsoort')
    expect(contractType.options.map(o => o.value)).toEqual(['uitzendbeding'])
    contractType.onToggle('uitzendbeding')
    expect(setContractTypeFilter).toHaveBeenCalledTimes(1)
  })
})

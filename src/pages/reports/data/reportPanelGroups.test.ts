/**
 * buildReportPanelGroups — pure-function test (§0.3 split of
 * useReportPanelGroups.ts). Given filter state + resolved options + `t`, the
 * builder must return the exact group set for each report, gated correctly.
 */
import { describe, it, expect, vi, type Mock } from 'vitest'
import { buildReportPanelGroups } from './reportPanelGroups'
import { COMPARE_OFF } from '../reportCompareMode'
import type { ReportFilterOptions } from '../hooks/useReportFilterOptions'
import type { ReportPanelFilterState } from './reportPanelGroups'

// Identity translator — the builder only ever wraps a key, never interpolates.
const t = ((key: string) => key) as unknown as import('i18next').TFunction

// Empty option lists for every dimension — group PRESENCE/absence is what
// this test asserts, not option contents (covered by useReportFilterOptions).
const emptyOptions: ReportFilterOptions = {
  acceptsCustomer: true,
  statusOptions: [], ownerOptions: [], branchOptions: [], customerOptions: [],
  sourceOptions: [], phaseOptions: [], contractFormOptions: [], stageOptions: [], rejectionReasonOptions: [],
  teamOptions: [], taskTypePanelOptions: [], taskPriorityPanelOptions: [], directionOptions: [], originOptions: [],
  stopReasonOptions: [], waTypeOptions: [],
}

// Fresh no-op filter state — every setter is a stub since the builder is
// exercised for its RETURN VALUE, not for state mutation.
function makeFilters(): ReportPanelFilterState {
  return {
    status: [], setStatus: vi.fn(), ownerId: [], setOwnerId: vi.fn(),
    locationId: [], setLocationId: vi.fn(), customerId: [], setCustomerId: vi.fn(),
    source: [], setSource: vi.fn(), phase: [], setPhase: vi.fn(),
    contractForm: [], setContractForm: vi.fn(), stage: [], setStage: vi.fn(),
    rejectionReason: [], setRejectionReason: vi.fn(),
    taskType: [], setTaskType: vi.fn(), priority: [], setPriority: vi.fn(), teamId: [], setTeamId: vi.fn(),
    direction: [], setDirection: vi.fn(), escalated: null, setEscalated: vi.fn(),
    customerIds: [], setCustomerIds: vi.fn(), stopReason: [], setStopReason: vi.fn(), messageType: [], setMessageType: vi.fn(),
    origin: [], setOrigin: vi.fn(),
    valueMin: null, setValueMin: vi.fn(), valueMax: null, setValueMax: vi.fn(),
  }
}

describe('buildReportPanelGroups', () => {
  it('returns only the period group when the report is not filterable', () => {
    const groups = buildReportPanelGroups({
      t, active: 'candidates', filterable: false, acceptsStatusBranch: true,
      period: 'month', setPeriod: vi.fn(), compareInPanel: false, compareMode: COMPARE_OFF, setCompareMode: vi.fn(),
      filters: makeFilters(), options: emptyOptions,
    })
    expect(groups.map(g => g.key)).toEqual(['period'])
  })

  it('adds status/owner/branch + the candidate dimensions for the candidates report', () => {
    const groups = buildReportPanelGroups({
      t, active: 'candidates', filterable: true, acceptsStatusBranch: true,
      period: 'month', setPeriod: vi.fn(), compareInPanel: false, compareMode: COMPARE_OFF, setCompareMode: vi.fn(),
      filters: makeFilters(), options: emptyOptions,
    })
    expect(groups.map(g => g.key)).toEqual(['period', 'status', 'owner', 'branch', 'customer', 'source', 'phase', 'contractForm'])
  })

  it('adds the whatsapp dimensions and omits status/branch/customer (acceptsStatusBranch=false, whatsapp is not customer-filterable)', () => {
    const groups = buildReportPanelGroups({
      t, active: 'whatsapp', filterable: true, acceptsStatusBranch: false,
      period: 'month', setPeriod: vi.fn(), compareInPanel: false, compareMode: COMPARE_OFF, setCompareMode: vi.fn(),
      filters: makeFilters(), options: { ...emptyOptions, acceptsCustomer: false },
    })
    expect(groups.map(g => g.key)).toEqual(['period', 'owner', 'direction', 'messageType', 'escalated'])
  })

  it('adds the compare radio (and its custom date range) when compareInPanel is on', () => {
    const groups = buildReportPanelGroups({
      t, active: 'candidates', filterable: false, acceptsStatusBranch: true,
      period: 'month', setPeriod: vi.fn(), compareInPanel: true,
      compareMode: { kind: 'custom', from: '2026-01-01', to: '2026-01-31' }, setCompareMode: vi.fn(),
      filters: makeFilters(), options: emptyOptions,
    })
    expect(groups.map(g => g.key)).toEqual(['period', 'compare', 'compareRange'])
  })

  it('calls onToggle through to the matching setter for a search-select group', () => {
    const filters = makeFilters()
    const groups = buildReportPanelGroups({
      t, active: 'candidates', filterable: true, acceptsStatusBranch: true,
      period: 'month', setPeriod: vi.fn(), compareInPanel: false, compareMode: COMPARE_OFF, setCompareMode: vi.fn(),
      filters, options: emptyOptions,
    })
    const phaseGroup = groups.find(g => g.key === 'phase')
    phaseGroup?.onToggle?.('lead')
    // The onToggle passes the shared toggleMulti updater to the setter — assert
    // the ACTUAL toggle semantics (add when absent, remove when present), not
    // just that the setter fired (a call-count-only assertion survives a
    // broken toggle body, which is exactly what mutation testing caught).
    const updater = (filters.setPhase as Mock).mock.calls[0][0]
    expect(updater([])).toEqual(['lead'])
    expect(updater(['lead'])).toEqual([])
  })

  it('adds the opportunities value number-range group', () => {
    const groups = buildReportPanelGroups({
      t, active: 'opportunities', filterable: true, acceptsStatusBranch: true,
      period: 'month', setPeriod: vi.fn(), compareInPanel: false, compareMode: COMPARE_OFF, setCompareMode: vi.fn(),
      filters: makeFilters(), options: emptyOptions,
    })
    expect(groups.map(g => g.key)).toContain('value')
    expect(groups.find(g => g.key === 'value')?.type).toBe('number-range')
  })
})

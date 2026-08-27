/**
 * useReportPanelGroups — hook-level test. Mirrors ReportsPage.test.tsx's lookup
 * stubs (same STABLE-REFERENCE contract: a fresh literal per render would drive
 * the register/unregister effect into a loop) but exercises the hook directly
 * via a tiny host component, so this is a unit test of the extraction itself,
 * not a re-test of ReportsPage's own rendering.
 */
import { describe, it, expect, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { RightPanelProvider, useRightPanel } from '@/context/RightPanelContext'
import { useReportPanelGroups } from './useReportPanelGroups'
import { COMPARE_OFF } from '../reportCompareMode'
import type { ReportId } from '../reportIds'

// Lookup sources the hook reads — stubbed to small, deterministic, STABLE
// option sets (same contract as ReportsPage.test.tsx).
const candidateStatusOptions = [{ value: 'available', label: 'Available' }]
const customerStatusOptions = [{ value: 'active', label: 'Active' }]
const userRows = [{ id: 'u1', name: 'Anna de Vries' }]
const branchRows = [{ value: 'utrecht', label: 'Utrecht' }]
const candidateLookups = { statuses: candidateStatusOptions, phases: [], candidateTypes: [] }
const customerLookupsValue = { statuses: customerStatusOptions }
const usersQueryResult = { data: userRows }
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => candidateLookups }))
vi.mock('@/lib/useCustomerLookups', () => ({ useCustomerLookups: () => customerLookupsValue }))
vi.mock('@/lib/queries', () => ({ useUsers: () => usersQueryResult }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => branchRows }))
const vacancyStatusOptions = [{ value: 'vs1', label: 'Open' }]
const taskStatusOptions = [{ value: 'ts1', label: 'To do' }]
const taskTypeIdOptions: Array<{ value: string; label: string }> = []
const taskPriorityIdOptions: Array<{ value: string; label: string }> = []
const matchStatusesValue = { statuses: [{ value: 'open', label: 'Active' }] }
const customerOptionsValue: Array<{ value: string; label: string }> = []
vi.mock('../reportStatusLookups', () => ({
  useVacancyStatusIdOptions: () => vacancyStatusOptions,
  useTaskStatusIdOptions: () => taskStatusOptions,
  useTaskTypeIdOptions: () => taskTypeIdOptions,
  useTaskPriorityIdOptions: () => taskPriorityIdOptions,
}))
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => matchStatusesValue }))
vi.mock('@/hooks/useCustomerOptions', () => ({ useCustomerOptions: () => customerOptionsValue }))
const stableLookup = vi.hoisted(() => ({
  stages: { stages: [] as unknown[] }, statuses: { statuses: [] as unknown[] }, sources: { sources: [] as unknown[] },
  appStages: { stages: [] as unknown[] }, reasons: { reasons: [] as unknown[] }, teams: { teams: [] as unknown[] },
}))
vi.mock('@/lib/useOpportunityStages', () => ({ useOpportunityStages: () => stableLookup.stages }))
vi.mock('@/lib/useOutreachStatuses', () => ({ useOutreachStatuses: () => stableLookup.statuses }))
vi.mock('@/lib/useApplicationSources', () => ({ useApplicationSources: () => stableLookup.sources }))
vi.mock('@/hooks/useApplicationStages', () => ({ useApplicationStages: () => stableLookup.appStages }))
vi.mock('@/lib/useRejectionReasons', () => ({ useRejectionReasons: () => stableLookup.reasons }))
vi.mock('@/lib/useTeams', () => ({ useTeams: () => stableLookup.teams }))

interface RadioGroup { key: string }

// STABLE no-op setters — a fresh function literal per render would break the
// hook's own useMemo dependency array and register/unregister into an
// infinite loop, exactly the "unstable reference" class of bug documented on
// the hook itself (mirrors the real useState setters ReportsPage passes,
// which React itself keeps stable across renders).
const noopSetPeriod = () => {}
const noopSetCompareMode = () => {}

// Host component: runs the hook for a given `active` report and reports both
// its own return value and whatever landed in the shared right panel.
function Host({ active, onFilters }: { active: ReportId; onFilters: (f: { status: unknown[] }) => void }) {
  const { filters } = useReportPanelGroups({
    active, period: 'month', setPeriod: noopSetPeriod, compareInPanel: false, compareMode: COMPARE_OFF, setCompareMode: noopSetCompareMode,
  })
  onFilters(filters as { status: unknown[] })
  return null
}

interface RadioGroupWithToggle { key: string; onToggle?: (v: string | number) => void }

// Host that also exposes the raw filterGroups so a test can drive a real
// onToggle on the mounted (not remounted) hook instance.
function ToggleHost({ active, onGroups }: { active: ReportId; onGroups: (groups: RadioGroupWithToggle[]) => void }) {
  useReportPanelGroups({
    active, period: 'month', setPeriod: noopSetPeriod, compareInPanel: false, compareMode: COMPARE_OFF, setCompareMode: noopSetCompareMode,
  })
  const { filterGroups } = useRightPanel()
  onGroups(filterGroups as unknown as RadioGroupWithToggle[])
  return null
}

function Capture({ onGroups }: { onGroups: (groups: RadioGroup[]) => void }) {
  const { filterGroups } = useRightPanel()
  onGroups(filterGroups as unknown as RadioGroup[])
  return null
}

describe('useReportPanelGroups', () => {
  it('registers period + status/owner/branch + the candidate dimensions for the candidates report', () => {
    let latest: RadioGroup[] = []
    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <Host active="candidates" onFilters={() => {}} />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toEqual(['period', 'status', 'owner', 'branch', 'source', 'phase', 'contractForm'])
  })

  // RESET-ON-SWITCH (group set): remounting with a different `active` never
  // carries the previous report's dimension groups.
  it('registers a different dimension set when the active report switches (tasks has no candidate dimensions)', () => {
    let latest: RadioGroup[] = []
    const { unmount } = render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <Host active="candidates" onFilters={() => {}} />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toContain('phase')
    unmount()

    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <Host active="tasks" onFilters={() => {}} />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toEqual(['period', 'status', 'owner', 'branch', 'taskType', 'priority', 'team'])
    expect(latest.map(g => g.key)).not.toContain('phase')
  })

  // RESET-ON-SWITCH (selection value): a SINGLE mounted hook instance, toggle
  // a real filter value via the group's own onToggle, then rerender the SAME
  // hook with a different `active` — the reset effect (useReportPanelGroups.ts:91-99)
  // must clear that selection back to empty. This is the assertion the group-set
  // test above cannot make, because it remounts a fresh hook per report instead
  // of switching `active` on a live one.
  it('clears a selected status value when the active report switches on a live hook', () => {
    let groups: RadioGroupWithToggle[] = []
    const { rerender } = render(
      <RightPanelProvider>
        <ToggleHost active="candidates" onGroups={g => { groups = g }} />
      </RightPanelProvider>,
    )
    const statusGroup = groups.find(g => g.key === 'status')
    expect(statusGroup).toBeDefined()
    act(() => { statusGroup!.onToggle!('available') })
    // Re-read after the toggle: `selected` must now carry the picked value.
    const toggledStatus = groups.find(g => g.key === 'status') as unknown as { selected: unknown[] }
    expect(toggledStatus.selected).toEqual(['available'])

    // Switch the active report on the SAME hook instance (no unmount).
    act(() => {
      rerender(
        <RightPanelProvider>
          <ToggleHost active="tasks" onGroups={g => { groups = g }} />
        </RightPanelProvider>,
      )
    })
    const statusAfterSwitch = groups.find(g => g.key === 'status') as unknown as { selected: unknown[] }
    expect(statusAfterSwitch.selected).toEqual([])
  })

  it('unregisters its groups on unmount', () => {
    let latest: RadioGroup[] = []
    const { unmount } = render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <Host active="candidates" onFilters={() => {}} />
      </RightPanelProvider>,
    )
    expect(latest.length).toBeGreaterThan(0)
    unmount()
    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
      </RightPanelProvider>,
    )
    expect(latest).toHaveLength(0)
  })

  it('returns a filters object with the panel-driven arrays, empty by default', () => {
    let captured: { status: unknown[] } | undefined
    render(
      <RightPanelProvider>
        <Host active="candidates" onFilters={f => { captured = f }} />
      </RightPanelProvider>,
    )
    expect(captured).toMatchObject({ status: [] })
  })
})

/**
 * buildReportPanelGroups — the right-panel filter config for every /reports/*
 * page. Pure function (§0.3 size split of useReportPanelGroups.ts): filter
 * state + setters, resolved options and `t` come in, group config goes out —
 * mirrors buildVacancyFilterGroups/buildCandidateFilterGroups. No hooks, no
 * lookup fetching — those live in useReportFilterOptions.ts; the caller
 * (useReportPanelGroups.ts) owns state/effects and registration.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { ReportFilterGroup } from '@/types/reports'
import type { ReportId } from '../reportIds'
import type { ReportPeriod } from '@/types/analytics'
import type { ReportCompareMode } from '../reportCompareMode'
import { COMPARE_OFF } from '../reportCompareMode'
import type { ReportFilterOptions } from '../hooks/useReportFilterOptions'

type MultiState = Array<string | number>
type SetMulti = Dispatch<SetStateAction<MultiState>>

export interface ReportPanelFilterState {
  status: MultiState; setStatus: SetMulti
  ownerId: MultiState; setOwnerId: SetMulti
  locationId: MultiState; setLocationId: SetMulti
  customerId: MultiState; setCustomerId: SetMulti
  source: MultiState; setSource: SetMulti
  phase: MultiState; setPhase: SetMulti
  contractForm: MultiState; setContractForm: SetMulti
  stage: MultiState; setStage: SetMulti
  rejectionReason: MultiState; setRejectionReason: SetMulti
  taskType: MultiState; setTaskType: SetMulti
  priority: MultiState; setPriority: SetMulti
  teamId: MultiState; setTeamId: SetMulti
  direction: MultiState; setDirection: SetMulti
  escalated: boolean | null; setEscalated: Dispatch<SetStateAction<boolean | null>>
  customerIds: MultiState; setCustomerIds: SetMulti
  stopReason: MultiState; setStopReason: SetMulti
  messageType: MultiState; setMessageType: SetMulti
  origin: MultiState; setOrigin: SetMulti
  valueMin: number | null; setValueMin: Dispatch<SetStateAction<number | null>>
  valueMax: number | null; setValueMax: Dispatch<SetStateAction<number | null>>
}

interface BuildArgs {
  t: TFunction
  active: ReportId
  filterable: boolean
  acceptsStatusBranch: boolean
  period: ReportPeriod
  setPeriod: (p: ReportPeriod) => void
  compareInPanel: boolean
  compareMode: ReportCompareMode
  setCompareMode: (m: ReportCompareMode) => void
  filters: ReportPanelFilterState
  options: ReportFilterOptions
}

// Toggles a value in/out of a multi-select array — the shared onToggle shape
// every search-select group below uses.
function toggleMulti(set: SetMulti) {
  return (v: string | number) => set(s => (s.includes(v) ? s.filter(x => x !== v) : [...s, v]))
}

// Pure builder: composes the reports right-hand filter panel — period/compare
// (universal) + status/owner/branch/customer (gated per report) + each
// report's own WAVE 1c dimensions. See the file docblock above for the split.
export function buildReportPanelGroups({
  t, active, filterable, acceptsStatusBranch, period, setPeriod,
  compareInPanel, compareMode, setCompareMode, filters: f, options: o,
}: BuildArgs): ReportFilterGroup[] {
  const groups: ReportFilterGroup[] = [{
    key: 'period',
    label: t('period.label'),
    type: 'radio',
    noChip: true,
    selected: [period],
    onToggle: (v: string | number) => setPeriod(String(v) as ReportPeriod),
    options: [
      { value: 'day', label: t('period.day') },
      { value: 'week', label: t('period.week') },
      { value: 'month', label: t('period.month') },
    ],
  }]
  // Compare group (RAPPORT-COMPARE-2) — radio like the period group; a custom
  // window adds the shared date-range group underneath. noChip mirrors period:
  // "off" is the empty state, the radio itself is the one honest control.
  if (compareInPanel) {
    groups.push({
      key: 'compare',
      label: t('compare.label'),
      type: 'radio',
      noChip: true,
      selected: [compareMode.kind],
      onToggle: (v: string | number) => {
        const kind = String(v)
        if (kind === 'previous_period') setCompareMode({ kind: 'previous_period' })
        else if (kind === 'previous_year') setCompareMode({ kind: 'previous_year' })
        else if (kind === 'custom') setCompareMode({ kind: 'custom', from: '', to: '' })
        else setCompareMode(COMPARE_OFF)
      },
      options: (['off', 'previous_period', 'previous_year', 'custom'] as const)
        .map(value => ({ value, label: t(`compare.mode.${value}`) })),
    })
    if (compareMode.kind === 'custom') {
      groups.push({
        key: 'compareRange',
        label: t('compare.mode.custom'),
        type: 'date-range',
        from: compareMode.from,
        to: compareMode.to,
        onFromChange: (v: string) => setCompareMode({ kind: 'custom', from: v, to: compareMode.kind === 'custom' ? compareMode.to : '' }),
        onToChange: (v: string) => setCompareMode({ kind: 'custom', from: compareMode.kind === 'custom' ? compareMode.from : '', to: v }),
      })
    }
  }
  if (!filterable) return groups

  // Each report's own axis vocabulary for the status/owner labels — candidates/
  // customers keep their existing `<ns>.axes.*` pair; applications/tasks have
  // their own analytics.json axis labels; vacancies/matches/opportunities/
  // outreach have no dedicated axis label yet so they borrow the generic
  // `customers.axes.*` pair — the same fallback VacancyReportAxes already
  // uses for its own bars.
  const axisNs = active === 'customers' ? 'customers' : 'candidates'
  const statusLabel = active === 'customers' || active === 'candidates' ? t(`${axisNs}.axes.status`)
    : active === 'applications' ? t('applications.axes.bucket')
    : active === 'tasks' ? t('tasks.axes.status')
    : t('customers.axes.status')
  const ownerLabel = active === 'customers' || active === 'candidates' ? t(`${axisNs}.axes.owner`)
    : active === 'applications' ? t('applications.axes.owner')
    : active === 'tasks' ? t('tasks.axes.assignee')
    : active === 'whatsapp' ? t('whatsapp.axes.owner')
    : t('customers.axes.owner')
  const branchLabel = active === 'tasks' ? t('tasks.axes.branch') : t('common:filters.branch')
  // WHATSAPP-NARROW-1: whatsapp's own route drops status[]/location_id[] —
  // acceptsStatusBranch mirrors that so the panel never shows a dimension the
  // server would 422 or silently drop (reportFilterParams.ts).
  if (acceptsStatusBranch) {
    groups.push({
      key: 'status', type: 'search-select', label: statusLabel,
      selected: f.status, onToggle: toggleMulti(f.setStatus),
      options: o.statusOptions,
    })
  }
  groups.push({
    key: 'owner', type: 'search-select', label: ownerLabel,
    selected: f.ownerId, onToggle: toggleMulti(f.setOwnerId),
    options: o.ownerOptions,
  })
  if (acceptsStatusBranch) {
    groups.push({
      key: 'branch', type: 'search-select', label: branchLabel,
      selected: f.locationId, onToggle: toggleMulti(f.setLocationId),
      options: o.branchOptions,
    })
  }
  // customer_id[] only exists on the reports whose table actually carries a
  // customer/client FK (vacancies' client_id, applications' inherited via the
  // vacancy, opportunities' own customer_id) — see reportFilterParams.ts's
  // CUSTOMER_FILTERABLE_REPORT_IDS.
  if (o.acceptsCustomer) {
    groups.push({
      key: 'customer', type: 'search-select', label: t('applications.axes.customer'),
      selected: f.customerId, onToggle: toggleMulti(f.setCustomerId),
      options: o.customerOptions,
    })
  }
  // WAVE 1c: the per-page extra dimensions, gated to the exact report(s)
  // whose segmentQuery() reads them (mirrors buildReportQueryParams's own gate).
  if (active === 'candidates') {
    groups.push(
      { key: 'source', type: 'search-select', label: t('candidates.axes.source'),
        selected: f.source, onToggle: toggleMulti(f.setSource), options: o.sourceOptions },
      { key: 'phase', type: 'search-select', label: t('candidates.axes.phase'),
        selected: f.phase, onToggle: toggleMulti(f.setPhase), options: o.phaseOptions },
      { key: 'contractForm', type: 'search-select', label: t('candidates.axes.contractForm'),
        selected: f.contractForm, onToggle: toggleMulti(f.setContractForm), options: o.contractFormOptions },
    )
  }
  if (active === 'applications') {
    groups.push(
      { key: 'stage', type: 'search-select', label: t('applications.axes.stage'),
        selected: f.stage, onToggle: toggleMulti(f.setStage), options: o.stageOptions },
      { key: 'source', type: 'search-select', label: t('applications.axes.source'),
        selected: f.source, onToggle: toggleMulti(f.setSource), options: o.sourceOptions },
      { key: 'rejectionReason', type: 'search-select', label: t('applications.axes.rejectionReason'),
        selected: f.rejectionReason, onToggle: toggleMulti(f.setRejectionReason), options: o.rejectionReasonOptions },
      // vacancy_id[] stays UNWIRED: no shared vacancy-options lookup hook
      // exists today (a search-select over GET /vacancies?per_page=… is not
      // allowed per §4 — every filterable list already has its own combobox
      // hook, and building a new one is out of this wave's file list).
    )
  }
  if (active === 'matches') {
    groups.push(
      { key: 'customerIds', type: 'search-select', label: t('applications.axes.customer'),
        selected: f.customerIds, onToggle: toggleMulti(f.setCustomerIds), options: o.customerOptions },
      { key: 'origin', type: 'search-select', label: t('matches.axes.origin'),
        selected: f.origin, onToggle: toggleMulti(f.setOrigin), options: o.originOptions },
      { key: 'contractForm', type: 'search-select', label: t('matches.axes.contractForm'),
        selected: f.contractForm, onToggle: toggleMulti(f.setContractForm), options: o.contractFormOptions },
      // stop_reason: CMBE-gemeten 27-08 — the server applies it to the
      // terminations slice + its drill ONLY (deliberate: the column lives on
      // match_terminations). The label carries that scope so the picker
      // promises exactly what it filters (§3 honest affordance).
      { key: 'stopReason', type: 'search-select', label: t('matches.axes.stopReason'),
        selected: f.stopReason, onToggle: toggleMulti(f.setStopReason), options: o.stopReasonOptions },
    )
  }
  if (active === 'tasks') {
    groups.push(
      { key: 'taskType', type: 'search-select', label: t('tasks.axes.type'),
        selected: f.taskType, onToggle: toggleMulti(f.setTaskType), options: o.taskTypePanelOptions },
      { key: 'priority', type: 'search-select', label: t('tasks.axes.priority'),
        selected: f.priority, onToggle: toggleMulti(f.setPriority), options: o.taskPriorityPanelOptions },
      { key: 'team', type: 'search-select', label: t('tasks.axes.team'),
        selected: f.teamId, onToggle: toggleMulti(f.setTeamId), options: o.teamOptions },
    )
  }
  if (active === 'whatsapp') {
    groups.push(
      { key: 'direction', type: 'search-select', label: t('whatsapp.axes.direction'),
        selected: f.direction, onToggle: toggleMulti(f.setDirection), options: o.directionOptions },
      // type[] is first-class server-side (message_type filter + by_type axis,
      // CMBE-gemeten 27-08); options are the tenant message-type lookup.
      { key: 'messageType', type: 'search-select', label: t('whatsapp.axes.type'),
        selected: f.messageType, onToggle: toggleMulti(f.setMessageType), options: o.waTypeOptions },
      { key: 'escalated', type: 'radio', label: t('whatsapp.axes.escalated'), noChip: f.escalated === null,
        selected: [f.escalated === null ? 'any' : f.escalated ? 'true' : 'false'],
        onToggle: (v: string | number) => f.setEscalated(v === 'any' ? null : v === 'true'),
        options: [
          { value: 'any', label: t('whatsapp.axes.escalatedAny') },
          { value: 'true', label: t('common:yes') },
          { value: 'false', label: t('common:no') },
        ] },
    )
  }
  if (active === 'opportunities') {
    groups.push({
      key: 'value', type: 'number-range', label: t('opportunities.axes.value'),
      min: f.valueMin, max: f.valueMax,
      onMinChange: (v: number | null) => f.setValueMin(v), onMaxChange: (v: number | null) => f.setValueMax(v),
    })
  }
  return groups
}

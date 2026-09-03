/**
 * useReportPanelGroups — owns the right-hand filter panel for ReportsPage
 * (extracted from ReportsPage.tsx, §3: > ~400 lines = split). Holds every
 * panel-driven filter dimension's state and the reset-on-report-switch effect;
 * option lists come from useReportFilterOptions.ts and group assembly is the
 * pure buildReportPanelGroups (../data/reportPanelGroups) — this hook wires
 * state + options into that builder and registers the result into
 * RightPanelContext. Returns the `filters` object the active report's own
 * hook/drill reads — ReportsPage stays a thin container that only resolves
 * the active report and renders it.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '@/context/RightPanelContext'
import { useReportFilterOptions } from './useReportFilterOptions'
import { buildReportPanelGroups } from '../data/reportPanelGroups'
import { isFilterableReport, acceptsStatusBranchFilter } from '../reportFilterParams'
import type { ReportCompareMode } from '../reportCompareMode'
import type { ReportFilterState } from '../reportFilterParams'
import type { ReportId } from '../reportIds'
import type { ReportPeriod } from '@/types/analytics'

// Central filter-panel hook shared by every /reports/* page: owns each panel dimension's
// state, resolves the report-specific option lists, and assembles/registers the groups
// so ReportsPage itself stays a thin container (see file docblock above).
export function useReportPanelGroups({ active, period, setPeriod, compareInPanel, compareMode, setCompareMode }: {
  active: ReportId
  period: ReportPeriod
  setPeriod: (p: ReportPeriod) => void
  compareInPanel: boolean
  compareMode: ReportCompareMode
  setCompareMode: (m: ReportCompareMode) => void
}): { filters: ReportFilterState; filterable: boolean } {
  const { t } = useTranslation('analytics')
  const { registerFilters, unregisterFilters } = useRightPanel()
  const filterable = isFilterableReport(active)

  // RAPPORT-FILTERS-1/2: status/owner/branch(+customer), wired for every report on
  // FILTERABLE_REPORT_IDS. The panel and both hooks read this exact same state — a
  // report's own hook and its drilldown build request params from this one object
  // via `buildReportQueryParams`, so bar and lade can never disagree.
  const [status, setStatus] = useState<Array<string | number>>([])
  const [ownerId, setOwnerId] = useState<Array<string | number>>([])
  const [locationId, setLocationId] = useState<Array<string | number>>([])
  const [customerId, setCustomerId] = useState<Array<string | number>>([])
  // WAVE 1c: the per-page dimensions each filterable report's own segmentQuery()
  // reads — see reportFilterParams.ts's buildReportQueryParams for the exact
  // report→field gating.
  const [source, setSource] = useState<Array<string | number>>([])
  const [phase, setPhase] = useState<Array<string | number>>([])
  const [contractForm, setContractForm] = useState<Array<string | number>>([])
  const [stage, setStage] = useState<Array<string | number>>([])
  const [rejectionReason, setRejectionReason] = useState<Array<string | number>>([])
  const [taskType, setTaskType] = useState<Array<string | number>>([])
  const [priority, setPriority] = useState<Array<string | number>>([])
  const [teamId, setTeamId] = useState<Array<string | number>>([])
  const [direction, setDirection] = useState<Array<string | number>>([])
  const [escalated, setEscalated] = useState<boolean | null>(null)
  const [customerIds, setCustomerIds] = useState<Array<string | number>>([])
  const [stopReason, setStopReason] = useState<Array<string | number>>([])
  const [messageType, setMessageType] = useState<Array<string | number>>([])
  const [origin, setOrigin] = useState<Array<string | number>>([])
  const [valueMin, setValueMin] = useState<number | null>(null)
  const [valueMax, setValueMax] = useState<number | null>(null)
  const filters: ReportFilterState = useMemo(() => ({
    status, ownerId, locationId, customerId,
    source, phase, contractForm,
    stage, vacancyId: [], rejectionReason,
    taskType, priority, teamId,
    direction, escalated,
    customerIds, origin, stopReason, messageType,
    valueMin, valueMax,
  }), [status, ownerId, locationId, customerId, source, phase, contractForm, stage, rejectionReason,
    taskType, priority, teamId, direction, escalated, customerIds, origin, stopReason, messageType, valueMin, valueMax])
  const acceptsStatusBranch = acceptsStatusBranchFilter(active)

  // Reset every dimension on EVERY report switch: vocabularies are per report
  // (a candidate status carried onto opportunities 422s there), so a selection
  // never lingers invisibly across pages (Opus wave-B2 — the old `filterable`
  // guard became dead code once all nine reports were filterable).
  useEffect(() => {
    setStatus([]); setOwnerId([]); setLocationId([]); setCustomerId([])
    setSource([]); setPhase([]); setContractForm([])
    setStage([]); setRejectionReason([])
    setTaskType([]); setPriority([]); setTeamId([])
    setDirection([]); setEscalated(null)
    setCustomerIds([]); setOrigin([]); setStopReason([]); setMessageType([])
    setValueMin(null); setValueMax(null)
  }, [active])

  // Every report's option list (status/owner/branch/customer + WAVE 1c per-page
  // vocabularies) — split into its own hook (useReportFilterOptions.ts).
  const options = useReportFilterOptions(active, filterable)

  // Group assembly is the pure builder (../data/reportPanelGroups) — state,
  // options and `t` in, group config out. Memoised on every value the builder
  // reads so a stale panel never lingers after a toggle.
  const panelGroups = useMemo(() => buildReportPanelGroups({
    t, active, filterable, acceptsStatusBranch, period, setPeriod,
    compareInPanel, compareMode, setCompareMode,
    filters: {
      status, setStatus, ownerId, setOwnerId, locationId, setLocationId, customerId, setCustomerId,
      source, setSource, phase, setPhase, contractForm, setContractForm,
      stage, setStage, rejectionReason, setRejectionReason,
      taskType, setTaskType, priority, setPriority, teamId, setTeamId,
      direction, setDirection, escalated, setEscalated,
      customerIds, setCustomerIds, stopReason, setStopReason, messageType, setMessageType,
      origin, setOrigin, valueMin, setValueMin, valueMax, setValueMax,
    },
    options,
  }), [t, active, filterable, acceptsStatusBranch, period, setPeriod, compareInPanel, compareMode, setCompareMode,
    status, ownerId, locationId, customerId, source, phase, contractForm, stage, rejectionReason,
    taskType, priority, teamId, direction, escalated, customerIds, stopReason, messageType, origin,
    valueMin, valueMax, options])

  // Registration into the shared right panel — the same panel every other page
  // renders through. Unregisters on unmount so the panel never shows a stale group.
  useEffect(() => {
    registerFilters('reports-page', panelGroups)
    return () => unregisterFilters('reports-page')
  }, [panelGroups, registerFilters, unregisterFilters])

  return { filters, filterable }
}

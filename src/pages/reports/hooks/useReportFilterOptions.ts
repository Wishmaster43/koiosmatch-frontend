/**
 * useReportFilterOptions — resolves every option list the reports filter panel
 * needs (§0.3 split of useReportPanelGroups.ts, mirrors buildVacancyFilterGroups's
 * options/state separation). Pure lookup-fetching + reshaping, no panel-group
 * assembly and no filter STATE — that stays in useReportPanelGroups.ts, and the
 * assembly itself moves to the pure buildReportPanelGroups (../data/reportPanelGroups).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLookups } from '@/context/LookupsContext'
import { useCustomerLookups } from '@/lib/useCustomerLookups'
import { useUsers } from '@/lib/queries'
import { useLocations } from '@/lib/useLocations'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useCustomerOptions } from '@/hooks/useCustomerOptions'
import { useApplicationSources } from '@/lib/useApplicationSources'
import { useApplicationStages } from '@/hooks/useApplicationStages'
import { useRejectionReasons } from '@/lib/useRejectionReasons'
import { useTeams } from '@/lib/useTeams'
import { useOpportunityStages } from '@/lib/useOpportunityStages'
import { useOutreachStatuses } from '@/lib/useOutreachStatuses'
import { useMatchStopReasons } from '@/hooks/useMatchStopReasons'
import { useWaMessageTypes } from '@/hooks/useWaMessageTypes'
import {
  useVacancyStatusIdOptions, useTaskStatusIdOptions, useTaskTypeIdOptions, useTaskPriorityIdOptions,
} from '../reportStatusLookups'
import { CUSTOMER_FILTERABLE_REPORT_IDS } from '../reportFilterParams'
import type { ReportId } from '../reportIds'

// Central options hook: every report's option list, gated the same way the
// original hook gated its fetches (customer options only fetch when filterable
// AND the active report accepts a customer dimension).
export function useReportFilterOptions(active: ReportId, filterable: boolean) {
  const { t } = useTranslation('analytics')
  const acceptsCustomer = (CUSTOMER_FILTERABLE_REPORT_IDS as readonly string[]).includes(active)

  // Lookup sources for the filter options — each entity keeps its OWN status
  // vocabulary (deployability/vacancy lifecycle/funnel bucket/match state/task
  // board), while owner (users) and branch (locations) are shared tenant lookups.
  // Vacancy/task statuses are validated by the backend against their raw lookup
  // ID, never the slug (see reportStatusLookups.ts) — a dedicated fetch, not the
  // page-scoped VacancyLookupsContext/TaskLookupsContext (unmounted here).
  const { statuses: candidateStatuses, phases: tenantPhases, candidateTypes } = useLookups()
  const { statuses: customerStatuses } = useCustomerLookups()
  const { data: users = [] } = useUsers() as { data?: Array<{ id?: string | number; name?: string }> }
  const locations = useLocations()
  const vacancyStatusOptions = useVacancyStatusIdOptions()
  const taskStatusOptions = useTaskStatusIdOptions()
  const taskTypeOptions = useTaskTypeIdOptions()
  const taskPriorityOptions = useTaskPriorityIdOptions()
  const { statuses: matchStatusesRaw } = useMatchStatuses()
  // Reshapes the raw match-status lookup into the panel's {value,label} option shape.
  const matchStatusOptions = useMemo(() => matchStatusesRaw.map(s => ({ value: s.value, label: s.label })), [matchStatusesRaw])
  const { stages: opportunityStages } = useOpportunityStages()
  const { statuses: outreachStatuses } = useOutreachStatuses()
  // The applications panel filter narrows on the FLAG-derived funnel bucket
  // (active/matched/rejected/placed, ApplicationsReport::BUCKET_VALUES) — a fixed,
  // non-tenant vocabulary, so its options are i18n labels, never a lookup fetch.
  const applicationBucketOptions = useMemo(
    () => (['active', 'matched', 'rejected', 'placed'] as const).map(k => ({ value: k, label: t(`applications.buckets.${k}`) })),
    [t],
  )
  const customerOptions = useCustomerOptions(filterable && acceptsCustomer)
  const statusOptions = active === 'customers' ? customerStatuses
    : active === 'vacancies' ? vacancyStatusOptions
    : active === 'applications' ? applicationBucketOptions
    : active === 'matches' ? matchStatusOptions
    : active === 'tasks' ? taskStatusOptions
    : active === 'opportunities' ? opportunityStages
    : active === 'outreach' ? outreachStatuses
    : candidateStatuses
  // Maps tenant users to owner options, dropping any without an id so the panel never
  // offers a selectable empty value.
  const ownerOptions = useMemo(() => users.map(u => ({ value: u.id ?? '', label: u.name || '—' })).filter(o => o.value !== ''), [users])
  const branchOptions = useMemo(() => locations.map(l => ({ value: l.value, label: l.label })), [locations])

  // WAVE 1c per-page vocabulary sources — only fetched behind `filterable` /
  // the exact report(s) that read them, so an unrelated report never fires an
  // extra GET it will never use.
  // LOOKUP-I18N-1: useApplicationSources already returns { value, label } rows
  // (value = raw backend name for the filter param, label = translated display) —
  // no local remap needed any more.
  const { sources: sourceOptions } = useApplicationSources()
  const phaseOptions = useMemo(() => tenantPhases.map(p => ({ value: p.value, label: p.label })), [tenantPhases])
  // 'none' sentinel mirrors the backend's own "no contract form" bucket both
  // candidates and matches already draw (AppliesReportFilters.php contract_form.*).
  const contractFormOptions = useMemo(
    () => [{ value: 'none', label: t('candidates.axes.contractFormNone') }, ...candidateTypes.map(c => ({ value: c.value, label: c.label }))],
    [candidateTypes, t],
  )
  const { stages: applicationStages } = useApplicationStages()
  // Prepends the 'none' sentinel (mirrors the backend's own "no stage" bucket) ahead
  // of the tenant's own funnel stages.
  const stageOptions = useMemo(
    () => [{ value: 'none', label: t('applications.axes.stageNone') }, ...applicationStages.map(s => ({ value: s.value, label: s.label }))],
    [applicationStages, t],
  )
  const { reasons: rejectionReasonOptions } = useRejectionReasons()
  const { teams } = useTeams()
  // Prepends the 'none' sentinel for tasks that have no team assigned.
  const teamOptions = useMemo(
    () => [{ value: 'none', label: t('tasks.noTeam') }, ...teams.map(tm => ({ value: tm.value, label: tm.label }))],
    [teams, t],
  )
  // Prepends the 'none' sentinel ahead of the shared task-type lookup options.
  const taskTypePanelOptions = useMemo(
    () => [{ value: 'none', label: t('tasks.filters.typeNone') }, ...taskTypeOptions], [taskTypeOptions, t],
  )
  // Prepends the 'none' sentinel ahead of the shared task-priority lookup options.
  const taskPriorityPanelOptions = useMemo(
    () => [{ value: 'none', label: t('tasks.filters.priorityNone') }, ...taskPriorityOptions], [taskPriorityOptions, t],
  )
  // Static, translated inbound/outbound options — not a tenant lookup, so built inline.
  const directionOptions = useMemo(
    () => (['inbound', 'outbound'] as const).map(v => ({ value: v, label: t(`whatsapp.axes.directionValues.${v}`) })), [t],
  )
  // Tenant stop reasons (no seed by design — see the hook doc) for the scoped
  // terminations filter; tenant WhatsApp message types for the type[] filter.
  const { reasons: stopReasonRows } = useMatchStopReasons()
  const stopReasonOptions = useMemo(
    () => (stopReasonRows ?? []).map(r => ({ value: r.value, label: r.label })), [stopReasonRows])
  const { data: waTypeRows } = useWaMessageTypes()
  const waTypeOptions = useMemo(
    // 'none' first: the server's TYPE_NONE sentinel (WhatsappReport, CMBE-gemeten
    // 27-08) folds NULL/empty message_type; label mirrors the by_type axis bucket.
    () => [{ value: 'none', label: t('whatsapp.axes.typeNone') }, ...(waTypeRows ?? []).flatMap(r => (r.value ? [{ value: r.value, label: r.label }] : []))], [waTypeRows, t])
  // Static, translated match-origin options (funnel vs. direct match) — not a lookup.
  const originOptions = useMemo(
    () => [{ value: 'funnel', label: t('matches.viaFunnel') }, { value: 'direct', label: t('matches.direct') }], [t],
  )

  // Stable return object: every field above is already individually memoised,
  // but the OBJECT wrapping them must be too — an unmemoised object literal here
  // would give buildReportPanelGroups's caller a new `options` reference on every
  // render, which (via its own useMemo dependency) would re-register the panel
  // group list every render and loop the register/unregister effect forever.
  return useMemo(() => ({
    acceptsCustomer,
    statusOptions, ownerOptions, branchOptions, customerOptions,
    sourceOptions, phaseOptions, contractFormOptions, stageOptions, rejectionReasonOptions,
    teamOptions, taskTypePanelOptions, taskPriorityPanelOptions, directionOptions, originOptions,
    stopReasonOptions, waTypeOptions,
  }), [acceptsCustomer, statusOptions, ownerOptions, branchOptions, customerOptions,
    sourceOptions, phaseOptions, contractFormOptions, stageOptions, rejectionReasonOptions,
    teamOptions, taskTypePanelOptions, taskPriorityPanelOptions, directionOptions, originOptions,
    stopReasonOptions, waTypeOptions])
}

export type ReportFilterOptions = ReturnType<typeof useReportFilterOptions>

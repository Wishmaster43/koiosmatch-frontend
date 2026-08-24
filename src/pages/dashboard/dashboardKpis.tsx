/**
 * buildDashboardKpis — every KPI block the dashboard can show (live value; 🟡
 * metrics read "—" until the backend feed lands — see docs/plans/DASHBOARD-PLAN.md).
 * Pure builder (§0.3 size split): the page passes its live feeds + helpers in;
 * KPI_ROWS (templates.ts) decides per role which of these render.
 * K1 (DASH-KPI-SERVER-FE-1, BE K-168): every KPI VALUE now reads from the server's
 * `kpis` block (GET /dashboard) — the server computes, the FE only renders. No more
 * client-side att-merge fallbacks, opp/meta-total derivations or local counts.
 */
import type { ReactNode } from 'react'
import { Users, CheckCircle, AlertCircle, AlertTriangle, Target, Euro, Briefcase, CalendarCheck, TrendingUp, MessageSquare, Zap, FileText, CalendarClock, Link2, PhoneOff, Hourglass, CalendarX2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface DashboardKpi { id: string; label: string; value: ReactNode; sub: string; color: string; bg: string; Icon: LucideIcon; onClick?: () => void }

interface BuildArgs {
  t: (k: string) => string
  // Server-computed KPI values (GET /dashboard `kpis`, K-168): null = no
  // right/module for this key (render '—'); 0 = a real zero; a module-gated
  // key absent from the object entirely hides its tile (useDashboardViewModel).
  kpis: Record<string, number | null | undefined>
  num: (v?: number | null) => string
  eur: (v?: unknown) => string
  // pipeline_hours is not (yet) a pinned server key, so the hours-mode value
  // still reads the raw opportunities feed.
  opp: { pipeline_hours?: number | null } | null
  valueInHours: boolean
  onNavigate?: (page: string, intent?: Record<string, unknown>) => void
}

export function buildDashboardKpis({ t, kpis, num, eur, opp, valueInHours, onNavigate }: BuildArgs): Record<string, DashboardKpi> {
  return {
    candidates:        { id: 'candidates', label: t('kpi.candidatesTotal'), value: num(kpis.candidates_total), sub: t('kpi.inAts'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: Users, onClick: () => onNavigate?.('candidates', {}) },
    stale:             { id: 'stale', label: t('kpi.notContacted6m'), value: num(kpis.stale_6m), sub: t('kpi.attentionNeeded'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: AlertCircle, onClick: () => onNavigate?.('candidates', { attention: 'stale6m' }) },
    never:             { id: 'never', label: t('kpi.neverContacted'), value: num(kpis.never_contacted), sub: t('kpi.attentionNeeded'), color: 'var(--color-danger-text)', bg: 'var(--color-danger-bg)', Icon: AlertCircle, onClick: () => onNavigate?.('candidates', { attention: 'neverContacted' }) },
    tasks:             { id: 'tasks', label: t('kpi.openTasks'), value: num(kpis.tasks), sub: t('kpi.linkedToCandidates'), color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', Icon: CheckCircle, onClick: () => onNavigate?.('tasks', { kpi: 'open' }) },
    opps:              { id: 'opps', label: t('kpi.opportunities'), value: num(kpis.opps_total), sub: t('kpi.openOpportunities'), color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', Icon: Target, onClick: () => onNavigate?.('opportunities', {}) },
    // Deal magnitude follows the tenant setting (euro vs hours) — same rule as the
    // opportunities page. Hours mode shows the hours sum once the feed carries it (DASH-HOURS).
    pipeline:          { id: 'pipeline', label: valueInHours ? t('kpi.pipelineHours') : t('kpi.pipelineValue'),
      value: valueInHours
        ? (opp?.pipeline_hours != null ? num(opp.pipeline_hours) : '—')
        : (kpis.pipeline_value != null ? eur(kpis.pipeline_value) : '—'),
      sub: t('kpi.sumOpenOpps'), color: 'var(--color-success-text)', bg: 'var(--color-success-bg)', Icon: valueInHours ? CalendarClock : Euro, onClick: () => onNavigate?.('opportunities', {}) },
    placements:        { id: 'placements', label: t('kpi.placements'), value: num(kpis.placements), sub: t('kpi.placementsSub'), color: 'var(--color-success-text)', bg: 'var(--color-success-bg)', Icon: Briefcase, onClick: () => onNavigate?.('matches', {}) },
    intakes:           { id: 'intakes', label: t('kpi.intakes'), value: num(kpis.intake_planned), sub: t('kpi.intakesSub'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: CalendarCheck, onClick: () => onNavigate?.('candidates', { attention: 'intakePlanned' }) },
    fillRate:          { id: 'fillRate', label: t('kpi.fillRate'), value: kpis.fill_rate != null ? `${kpis.fill_rate}%` : '—', sub: t('kpi.fillRateSub'), color: 'var(--color-success-text)', bg: 'var(--color-success-bg)', Icon: TrendingUp, onClick: () => onNavigate?.('vacancies', {}) },
    // Live vacancy count (non-archived) — replaced the feed-less Invulgraad card.
    openVacancies:     { id: 'openVacancies', label: t('kpi.openVacancies'), value: num(kpis.open_vacancies), sub: t('kpi.openVacanciesSub'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: Briefcase, onClick: () => onNavigate?.('vacancies', {}) },
    incompleteRuns:    { id: 'incompleteRuns', label: t('kpi.incompleteRuns'), value: num(kpis.incomplete_runs), sub: t('kpi.incompleteRunsSub'), color: 'var(--color-danger-text)', bg: 'var(--color-danger-bg)', Icon: Zap, onClick: () => onNavigate?.('aiagents', {}) },
    activeConv:        { id: 'activeConv', label: t('kpi.activeConv'), value: num(kpis.active_conversations), sub: t('kpi.activeConvSub'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: MessageSquare, onClick: () => onNavigate?.('whatsapp', { tab: 'messages' }) },
    missingDocs:       { id: 'missingDocs', label: t('kpi.missingDocs'), value: num(kpis.missing_documents), sub: t('kpi.missingDocsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: FileText, onClick: () => onNavigate?.('candidates', {}) },
    expiringContracts: { id: 'expiringContracts', label: t('kpi.expiringContracts'), value: num(kpis.expiring_contracts), sub: t('kpi.expiringContractsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: CalendarClock, onClick: () => onNavigate?.('matches', {}) },
    couplingErrors:    { id: 'couplingErrors', label: t('kpi.couplingErrors'), value: num(kpis.coupling_errors), sub: t('kpi.couplingErrorsSub'), color: 'var(--color-danger-text)', bg: 'var(--color-danger-bg)', Icon: Link2, onClick: () => onNavigate?.('candidates', {}) },
    openShifts:        { id: 'openShifts', label: t('kpi.openShifts'), value: num(kpis.open_shifts), sub: t('kpi.openShiftsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: CalendarClock, onClick: () => onNavigate?.('planning', {}) },
    occupancy:         { id: 'occupancy', label: t('kpi.occupancy'), value: kpis.occupancy != null ? `${kpis.occupancy}%` : '—', sub: t('kpi.occupancySub'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: TrendingUp, onClick: () => onNavigate?.('planning', {}) },
    // Escalations, failed workflows (real count now from ai_runs), overdue tasks, uncalled call-lists, expiring sales opps.
    escalations:       { id: 'escalations', label: t('kpi.escalations'), value: num(kpis.escalations), sub: t('kpi.escalationsSub'), color: 'var(--color-danger-text)', bg: 'var(--color-danger-bg)', Icon: AlertTriangle, onClick: () => onNavigate?.('whatsapp', { tab: 'escalations' }) },
    failedWf:          { id: 'failedWf', label: t('kpi.failedWf'), value: num(kpis.failed_workflows), sub: t('kpi.failedWfSub'), color: 'var(--color-danger-text)', bg: 'var(--color-danger-bg)', Icon: Zap, onClick: () => onNavigate?.('workflows', {}) },
    tasksOverdue:      { id: 'tasksOverdue', label: t('kpi.tasksOverdue'), value: num(kpis.tasks_overdue), sub: t('kpi.tasksOverdueSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: AlertCircle, onClick: () => onNavigate?.('tasks', { kpi: 'overdue' }) },
    uncalledCallist:   { id: 'uncalledCallist', label: t('kpi.uncalledCallist'), value: num(kpis.calllist_uncalled), sub: t('kpi.uncalledCallistSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: PhoneOff, onClick: () => onNavigate?.('outreach', {}) },
    expiringOpps:      { id: 'expiringOpps', label: t('kpi.expiringOpps'), value: num(kpis.expiring_opps), sub: t('kpi.expiringOppsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: CalendarClock, onClick: () => onNavigate?.('opportunities', { kpi: 'expiring' }) },
    // D6 — kpis.app_too_long_in_stage / kpis.app_missing_appointment (always
    // present per K-168; null = viewer lacks the right → honest '—').
    // SEMANTIC-INTENT-1: tiles emit an intent, not a raw server param — the destination
    // page (ApplicationsPage) interprets it and activates its own server filter, mirroring
    // onNavigate('candidates', { attention: 'stale6m' }) / ('tasks', { kpi: 'overdue' }).
    tooLongInStage:    { id: 'tooLongInStage', label: t('kpi.tooLongInStage'), value: num(kpis.app_too_long_in_stage), sub: t('kpi.tooLongInStageSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: Hourglass, onClick: () => onNavigate?.('applications', { attention: 'tooLongInStage' }) },
    missingApptApps:   { id: 'missingApptApps', label: t('kpi.missingApptApps'), value: num(kpis.app_missing_appointment), sub: t('kpi.missingApptAppsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: CalendarX2, onClick: () => onNavigate?.('applications', { attention: 'missingAppointment' }) },
  }
}

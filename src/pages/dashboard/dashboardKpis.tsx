/**
 * buildDashboardKpis — every KPI block the dashboard can show (live value; 🟡
 * metrics read "—" until the backend feed lands — see docs/DASHBOARD-PLAN.md).
 * Pure builder (§0.3 size split): the page passes its live feeds + helpers in;
 * KPI_ROWS (templates.ts) decides per role which of these render.
 */
import type { ReactNode } from 'react'
import { Users, CheckCircle, AlertCircle, AlertTriangle, Target, Euro, Briefcase, CalendarCheck, TrendingUp, MessageSquare, Zap, FileText, CalendarClock, Link2, PhoneOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface DashboardKpi { id: string; label: string; value: ReactNode; sub: string; color: string; bg: string; Icon: LucideIcon; onClick?: () => void }

interface BuildArgs {
  t: (k: string) => string
  // Attention/metrics merged from every backend source (see the page).
  att: Record<string, number | null | undefined>
  num: (v?: number | null) => string
  eur: (v?: unknown) => string
  opp: { total?: number | null; pipeline_value?: number | null; pipeline_hours?: number | null } | null
  valueInHours: boolean
  candidateTotalLabel: ReactNode
  matchesTotal: number | null
  vacanciesTotal: number | null
  incompleteRuns: number
  conversationsCount: number
  onNavigate?: (page: string, intent?: Record<string, unknown>) => void
}

export function buildDashboardKpis({ t, att, num, eur, opp, valueInHours, candidateTotalLabel, matchesTotal, vacanciesTotal, incompleteRuns, conversationsCount, onNavigate }: BuildArgs): Record<string, DashboardKpi> {
  return {
    candidates:        { id: 'candidates', label: t('kpi.candidatesTotal'), value: candidateTotalLabel, sub: t('kpi.inAts'), color: 'var(--color-primary)', bg: 'var(--color-primary-bg)', Icon: Users, onClick: () => onNavigate?.('candidates', {}) },
    stale:             { id: 'stale', label: t('kpi.notContacted6m'), value: num(att.stale_6m), sub: t('kpi.attentionNeeded'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: AlertCircle, onClick: () => onNavigate?.('candidates', { attention: 'stale6m' }) },
    never:             { id: 'never', label: t('kpi.neverContacted'), value: num(att.never_contacted), sub: t('kpi.attentionNeeded'), color: 'var(--color-danger)', bg: 'var(--color-danger-bg)', Icon: AlertCircle, onClick: () => onNavigate?.('candidates', { attention: 'neverContacted' }) },
    tasks:             { id: 'tasks', label: t('kpi.openTasks'), value: num(att.tasks), sub: t('kpi.linkedToCandidates'), color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', Icon: CheckCircle, onClick: () => onNavigate?.('tasks', { kpi: 'open' }) },
    opps:              { id: 'opps', label: t('kpi.opportunities'), value: num(opp?.total), sub: t('kpi.openOpportunities'), color: '#8B5CF6', bg: '#F3E8FF', Icon: Target, onClick: () => onNavigate?.('opportunities', {}) },
    // Deal magnitude follows the tenant setting (euro vs hours) — same rule as the
    // opportunities page. Hours mode shows the hours sum once the feed carries it (DASH-HOURS).
    pipeline:          { id: 'pipeline', label: valueInHours ? t('kpi.pipelineHours') : t('kpi.pipelineValue'),
      value: valueInHours
        ? ((opp as { pipeline_hours?: number } | null)?.pipeline_hours != null ? num((opp as { pipeline_hours?: number }).pipeline_hours) : '—')
        : (opp?.pipeline_value != null ? eur(opp.pipeline_value) : '—'),
      sub: t('kpi.sumOpenOpps'), color: 'var(--color-success)', bg: 'var(--color-success-bg)', Icon: valueInHours ? CalendarClock : Euro, onClick: () => onNavigate?.('opportunities', {}) },
    placements:        { id: 'placements', label: t('kpi.placements'), value: num(att.placements ?? matchesTotal), sub: t('kpi.placementsSub'), color: 'var(--color-success)', bg: 'var(--color-success-bg)', Icon: Briefcase, onClick: () => onNavigate?.('matches', {}) },
    intakes:           { id: 'intakes', label: t('kpi.intakes'), value: num(att.intake_planned ?? att.intakes), sub: t('kpi.intakesSub'), color: 'var(--color-primary)', bg: 'var(--color-primary-bg)', Icon: CalendarCheck, onClick: () => onNavigate?.('candidates', { attention: 'intakePlanned' }) },
    fillRate:          { id: 'fillRate', label: t('kpi.fillRate'), value: att.fill_rate != null ? `${att.fill_rate}%` : '—', sub: t('kpi.fillRateSub'), color: 'var(--color-success)', bg: 'var(--color-success-bg)', Icon: TrendingUp, onClick: () => onNavigate?.('vacancies', {}) },
    // Live vacancy count (non-archived) — replaced the feed-less Invulgraad card.
    openVacancies:     { id: 'openVacancies', label: t('kpi.openVacancies'), value: num(att.open_vacancies ?? vacanciesTotal), sub: t('kpi.openVacanciesSub'), color: 'var(--color-primary)', bg: 'var(--color-primary-bg)', Icon: Briefcase, onClick: () => onNavigate?.('vacancies', {}) },
    incompleteRuns:    { id: 'incompleteRuns', label: t('kpi.incompleteRuns'), value: num(att.incomplete_runs ?? incompleteRuns), sub: t('kpi.incompleteRunsSub'), color: 'var(--color-danger)', bg: 'var(--color-danger-bg)', Icon: Zap, onClick: () => onNavigate?.('aiagents', {}) },
    activeConv:        { id: 'activeConv', label: t('kpi.activeConv'), value: num(att.active_conversations ?? conversationsCount), sub: t('kpi.activeConvSub'), color: 'var(--color-primary)', bg: 'var(--color-primary-bg)', Icon: MessageSquare, onClick: () => onNavigate?.('whatsapp', { tab: 'messages' }) },
    missingDocs:       { id: 'missingDocs', label: t('kpi.missingDocs'), value: num(att.missing_documents), sub: t('kpi.missingDocsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: FileText, onClick: () => onNavigate?.('candidates', {}) },
    expiringContracts: { id: 'expiringContracts', label: t('kpi.expiringContracts'), value: num(att.expiring_contracts), sub: t('kpi.expiringContractsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: CalendarClock, onClick: () => onNavigate?.('matches', {}) },
    couplingErrors:    { id: 'couplingErrors', label: t('kpi.couplingErrors'), value: num(att.coupling_errors), sub: t('kpi.couplingErrorsSub'), color: 'var(--color-danger)', bg: 'var(--color-danger-bg)', Icon: Link2, onClick: () => onNavigate?.('candidates', {}) },
    openShifts:        { id: 'openShifts', label: t('kpi.openShifts'), value: num(att.open_shifts), sub: t('kpi.openShiftsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: CalendarClock, onClick: () => onNavigate?.('planning', {}) },
    occupancy:         { id: 'occupancy', label: t('kpi.occupancy'), value: att.occupancy != null ? `${att.occupancy}%` : '—', sub: t('kpi.occupancySub'), color: 'var(--color-primary)', bg: 'var(--color-primary-bg)', Icon: TrendingUp, onClick: () => onNavigate?.('planning', {}) },
    // Escalations, failed workflows (real count now from ai_runs), overdue tasks, uncalled call-lists, expiring sales opps.
    escalations:       { id: 'escalations', label: t('kpi.escalations'), value: num(att.escalations), sub: t('kpi.escalationsSub'), color: 'var(--color-danger)', bg: 'var(--color-danger-bg)', Icon: AlertTriangle, onClick: () => onNavigate?.('whatsapp', { tab: 'escalations' }) },
    failedWf:          { id: 'failedWf', label: t('kpi.failedWf'), value: num(att.failed_workflows ?? incompleteRuns), sub: t('kpi.failedWfSub'), color: 'var(--color-danger)', bg: 'var(--color-danger-bg)', Icon: Zap, onClick: () => onNavigate?.('workflows', {}) },
    tasksOverdue:      { id: 'tasksOverdue', label: t('kpi.tasksOverdue'), value: num(att.tasks_overdue), sub: t('kpi.tasksOverdueSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: AlertCircle, onClick: () => onNavigate?.('tasks', { kpi: 'overdue' }) },
    uncalledCallist:   { id: 'uncalledCallist', label: t('kpi.uncalledCallist'), value: num(att.calllist_uncalled), sub: t('kpi.uncalledCallistSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: PhoneOff, onClick: () => onNavigate?.('outreach', {}) },
    expiringOpps:      { id: 'expiringOpps', label: t('kpi.expiringOpps'), value: num(att.expiring_opps), sub: t('kpi.expiringOppsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: CalendarClock, onClick: () => onNavigate?.('opportunities', { kpi: 'expiring' }) },
  }
}

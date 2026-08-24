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
import { translateDrill } from './drillTranslate'
import type { DashDrillDescriptor } from '@/types/dashboard'

export interface DashboardKpi { id: string; label: string; value: ReactNode; sub: string; color: string; bg: string; Icon: LucideIcon; onClick?: () => void }

interface BuildArgs {
  t: (k: string) => string
  // Server-computed KPI values (GET /dashboard `kpis`, K-168): null = no
  // right/module for this key (render '—'); 0 = a real zero; a module-gated
  // key absent from the object entirely hides its tile (useDashboardViewModel).
  kpis: Record<string, number | null | undefined>
  // K-173 fase 2 — per-KPI drill descriptor, keyed by the SAME key as `kpis`
  // (the server computes both from one query, so the keys mirror each other).
  // Absent key = pre-K-173 server → fall back to the hardcoded intent below.
  // Present key with value `null` = this tile has no drill → no onClick at all
  // (never a dead cell that silently keeps the old hardcoded intent).
  drills?: Record<string, DashDrillDescriptor | null>
  num: (v?: number | null) => string
  eur: (v?: unknown) => string
  // pipeline_hours is not (yet) a pinned server key, so the hours-mode value
  // still reads the raw opportunities feed.
  opp: { pipeline_hours?: number | null } | null
  valueInHours: boolean
  onNavigate?: (page: string, intent?: Record<string, unknown>) => void
}

export function buildDashboardKpis({ t, kpis, drills = {}, num, eur, opp, valueInHours, onNavigate }: BuildArgs): Record<string, DashboardKpi> {
  // K-173 fase 2 — resolve a tile's onClick: a present drill descriptor navigates
  // via entity+params (the exact filters that reproduce this tile's own number);
  // an explicit `null` descriptor means no drill (undefined onClick, no dead
  // cell); an ABSENT key (older server, no K-173 yet) keeps the tile's own
  // hardcoded intent as fallback.
  const resolveClick = (serverKey: string, fallback: () => void): (() => void) | undefined => {
    // null value = the viewer lacks the right for this number — an honest '—'
    // must not click through into a 403 list (Opus lane-3 minor).
    if (serverKey in kpis && kpis[serverKey] === null) return undefined
    if (serverKey in drills) {
      const d = drills[serverKey]
      if (!d) return undefined
      // Server params → page intent through the ONE measured translation
      // (drillTranslate). Untranslatable descriptor → the legacy intent, never
      // raw params an intent-reader would silently drop (Opus slotgolf B1/B2).
      const translated = translateDrill(d)
      return translated ? () => onNavigate?.(translated.page, translated.intent) : fallback
    }
    return fallback
  }
  return {
    candidates:        { id: 'candidates', label: t('kpi.candidatesTotal'), value: num(kpis.candidates_total), sub: t('kpi.inAts'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: Users, onClick: resolveClick('candidates_total', () => onNavigate?.('candidates', {})) },
    stale:             { id: 'stale', label: t('kpi.notContacted6m'), value: num(kpis.stale_6m), sub: t('kpi.attentionNeeded'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: AlertCircle, onClick: resolveClick('stale_6m', () => onNavigate?.('candidates', { attention: 'stale6m' })) },
    never:             { id: 'never', label: t('kpi.neverContacted'), value: num(kpis.never_contacted), sub: t('kpi.attentionNeeded'), color: 'var(--color-danger-text)', bg: 'var(--color-danger-bg)', Icon: AlertCircle, onClick: resolveClick('never_contacted', () => onNavigate?.('candidates', { attention: 'neverContacted' })) },
    tasks:             { id: 'tasks', label: t('kpi.openTasks'), value: num(kpis.tasks), sub: t('kpi.linkedToCandidates'), color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', Icon: CheckCircle, onClick: resolveClick('tasks', () => onNavigate?.('tasks', { kpi: 'open' })) },
    opps:              { id: 'opps', label: t('kpi.opportunities'), value: num(kpis.opps_total), sub: t('kpi.openOpportunities'), color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', Icon: Target, onClick: resolveClick('opps_total', () => onNavigate?.('opportunities', {})) },
    // Deal magnitude follows the tenant setting (euro vs hours) — same rule as the
    // opportunities page. Hours mode shows the hours sum once the feed carries it (DASH-HOURS).
    pipeline:          { id: 'pipeline', label: valueInHours ? t('kpi.pipelineHours') : t('kpi.pipelineValue'),
      value: valueInHours
        ? (opp?.pipeline_hours != null ? num(opp.pipeline_hours) : '—')
        : (kpis.pipeline_value != null ? eur(kpis.pipeline_value) : '—'),
      sub: t('kpi.sumOpenOpps'), color: 'var(--color-success-text)', bg: 'var(--color-success-bg)', Icon: valueInHours ? CalendarClock : Euro, onClick: resolveClick('pipeline_value', () => onNavigate?.('opportunities', {})) },
    placements:        { id: 'placements', label: t('kpi.placements'), value: num(kpis.placements), sub: t('kpi.placementsSub'), color: 'var(--color-success-text)', bg: 'var(--color-success-bg)', Icon: Briefcase, onClick: resolveClick('placements', () => onNavigate?.('matches', {})) },
    intakes:           { id: 'intakes', label: t('kpi.intakes'), value: num(kpis.intake_planned), sub: t('kpi.intakesSub'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: CalendarCheck, onClick: resolveClick('intake_planned', () => onNavigate?.('candidates', { attention: 'intakePlanned' })) },
    fillRate:          { id: 'fillRate', label: t('kpi.fillRate'), value: kpis.fill_rate != null ? `${kpis.fill_rate}%` : '—', sub: t('kpi.fillRateSub'), color: 'var(--color-success-text)', bg: 'var(--color-success-bg)', Icon: TrendingUp, onClick: resolveClick('fill_rate', () => onNavigate?.('vacancies', {})) },
    // Live vacancy count (non-archived) — replaced the feed-less Invulgraad card.
    openVacancies:     { id: 'openVacancies', label: t('kpi.openVacancies'), value: num(kpis.open_vacancies), sub: t('kpi.openVacanciesSub'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: Briefcase, onClick: resolveClick('open_vacancies', () => onNavigate?.('vacancies', {})) },
    incompleteRuns:    { id: 'incompleteRuns', label: t('kpi.incompleteRuns'), value: num(kpis.incomplete_runs), sub: t('kpi.incompleteRunsSub'), color: 'var(--color-danger-text)', bg: 'var(--color-danger-bg)', Icon: Zap, onClick: resolveClick('incomplete_runs', () => onNavigate?.('aiagents', {})) },
    activeConv:        { id: 'activeConv', label: t('kpi.activeConv'), value: num(kpis.active_conversations), sub: t('kpi.activeConvSub'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: MessageSquare, onClick: resolveClick('active_conversations', () => onNavigate?.('whatsapp', { tab: 'messages' })) },
    missingDocs:       { id: 'missingDocs', label: t('kpi.missingDocs'), value: num(kpis.missing_documents), sub: t('kpi.missingDocsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: FileText, onClick: resolveClick('missing_documents', () => onNavigate?.('candidates', {})) },
    expiringContracts: { id: 'expiringContracts', label: t('kpi.expiringContracts'), value: num(kpis.expiring_contracts), sub: t('kpi.expiringContractsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: CalendarClock, onClick: resolveClick('expiring_contracts', () => onNavigate?.('matches', {})) },
    couplingErrors:    { id: 'couplingErrors', label: t('kpi.couplingErrors'), value: num(kpis.coupling_errors), sub: t('kpi.couplingErrorsSub'), color: 'var(--color-danger-text)', bg: 'var(--color-danger-bg)', Icon: Link2, onClick: resolveClick('coupling_errors', () => onNavigate?.('candidates', {})) },
    openShifts:        { id: 'openShifts', label: t('kpi.openShifts'), value: num(kpis.open_shifts), sub: t('kpi.openShiftsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: CalendarClock, onClick: resolveClick('open_shifts', () => onNavigate?.('planning', {})) },
    occupancy:         { id: 'occupancy', label: t('kpi.occupancy'), value: kpis.occupancy != null ? `${kpis.occupancy}%` : '—', sub: t('kpi.occupancySub'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: TrendingUp, onClick: resolveClick('occupancy', () => onNavigate?.('planning', {})) },
    // Escalations, failed workflows (real count now from ai_runs), overdue tasks, uncalled call-lists, expiring sales opps.
    escalations:       { id: 'escalations', label: t('kpi.escalations'), value: num(kpis.escalations), sub: t('kpi.escalationsSub'), color: 'var(--color-danger-text)', bg: 'var(--color-danger-bg)', Icon: AlertTriangle, onClick: resolveClick('escalations', () => onNavigate?.('whatsapp', { tab: 'escalations' })) },
    failedWf:          { id: 'failedWf', label: t('kpi.failedWf'), value: num(kpis.failed_workflows), sub: t('kpi.failedWfSub'), color: 'var(--color-danger-text)', bg: 'var(--color-danger-bg)', Icon: Zap, onClick: resolveClick('failed_workflows', () => onNavigate?.('workflows', {})) },
    tasksOverdue:      { id: 'tasksOverdue', label: t('kpi.tasksOverdue'), value: num(kpis.tasks_overdue), sub: t('kpi.tasksOverdueSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: AlertCircle, onClick: resolveClick('tasks_overdue', () => onNavigate?.('tasks', { kpi: 'overdue' })) },
    uncalledCallist:   { id: 'uncalledCallist', label: t('kpi.uncalledCallist'), value: num(kpis.calllist_uncalled), sub: t('kpi.uncalledCallistSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: PhoneOff, onClick: resolveClick('calllist_uncalled', () => onNavigate?.('outreach', {})) },
    expiringOpps:      { id: 'expiringOpps', label: t('kpi.expiringOpps'), value: num(kpis.expiring_opps), sub: t('kpi.expiringOppsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: CalendarClock, onClick: resolveClick('expiring_opps', () => onNavigate?.('opportunities', { kpi: 'expiring' })) },
    // D6 — kpis.app_too_long_in_stage / kpis.app_missing_appointment (always
    // present per K-168; null = viewer lacks the right → honest '—').
    // SEMANTIC-INTENT-1: tiles emit an intent, not a raw server param — the destination
    // page (ApplicationsPage) interprets it and activates its own server filter, mirroring
    // onNavigate('candidates', { attention: 'stale6m' }) / ('tasks', { kpi: 'overdue' }).
    tooLongInStage:    { id: 'tooLongInStage', label: t('kpi.tooLongInStage'), value: num(kpis.app_too_long_in_stage), sub: t('kpi.tooLongInStageSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: Hourglass, onClick: resolveClick('app_too_long_in_stage', () => onNavigate?.('applications', { attention: 'tooLongInStage' })) },
    missingApptApps:   { id: 'missingApptApps', label: t('kpi.missingApptApps'), value: num(kpis.app_missing_appointment), sub: t('kpi.missingApptAppsSub'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: CalendarX2, onClick: resolveClick('app_missing_appointment', () => onNavigate?.('applications', { attention: 'missingAppointment' })) },
    // Full-vocabulary tiles (kpiKeyMap completion): every server kpi_row key can
    // now render — a stored row must never lose tiles to a missing mapping.
    candidatesNew:     { id: 'candidatesNew', label: t('kpi.candidatesNew'), value: num(kpis.candidates_new), sub: t('kpi.inPeriod'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: Users, onClick: resolveClick('candidates_new', () => onNavigate?.('candidates', {})) },
    noFollowup:        { id: 'noFollowup', label: t('kpi.noFollowup'), value: num(kpis.no_followup), sub: t('kpi.attentionNeeded'), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', Icon: AlertCircle, onClick: resolveClick('no_followup', () => onNavigate?.('candidates', { attention: 'noFollowup' })) },
    leadsPipeline:     { id: 'leadsPipeline', label: t('kpi.leadsPipeline'), value: num(kpis.leads_pipeline), sub: t('kpi.openOpportunities'), color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', Icon: Target, onClick: resolveClick('leads_pipeline', () => onNavigate?.('opportunities', {})) },
    vacanciesActive:   { id: 'vacanciesActive', label: t('kpi.vacanciesActive'), value: num(kpis.vacancies_active), sub: t('kpi.vacanciesActiveSub'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: Briefcase, onClick: resolveClick('vacancies_active', () => onNavigate?.('vacancies', {})) },
    intakesDone:       { id: 'intakesDone', label: t('kpi.intakesDone'), value: num(kpis.intakes), sub: t('kpi.inPeriod'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: CalendarCheck, onClick: resolveClick('intakes', () => onNavigate?.('candidates', {})) },
    matchesTotal:      { id: 'matchesTotal', label: t('kpi.matchesTotal'), value: num(kpis.matches_total ?? kpis.matches), sub: t('kpi.matchesTotalSub'), color: 'var(--color-success-text)', bg: 'var(--color-success-bg)', Icon: Briefcase, onClick: resolveClick('matches_total', () => onNavigate?.('matches', {})) },
    messagesSent:      { id: 'messagesSent', label: t('kpi.messagesSent'), value: num(kpis.messages_sent), sub: t('kpi.inPeriod'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: MessageSquare, onClick: resolveClick('messages_sent', () => onNavigate?.('whatsapp', { tab: 'messages' })) },
    shiftsPlanned:     { id: 'shiftsPlanned', label: t('kpi.shiftsPlanned'), value: num(kpis.shifts_planned), sub: t('kpi.inPeriod'), color: 'var(--color-primary-text)', bg: 'var(--color-primary-bg)', Icon: CalendarClock, onClick: resolveClick('shifts_planned', () => onNavigate?.('planning', {})) },
  }
}

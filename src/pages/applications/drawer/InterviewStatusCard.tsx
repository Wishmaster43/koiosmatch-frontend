/**
 * InterviewStatusCard — the compact "who's talking to whom, right now" summary
 * for the live interview session: agent, flow, turn, step and elapsed time.
 * Every visibility field stays optional, so a payload that carries only
 * category/step/total still renders the calm branches instead of inventing a
 * value (§3 no fake affordances).
 *
 * INTERVIEW-VISIBILITY-1 is LIVE (measured 01-08 in InterviewSessionResource):
 * `flow_name` comes off the flow relation and the agent is resolved
 * DETERMINISTICALLY (InterviewSession::resolveAgent — vacancy-coupled agent, then
 * the flow's persona, then the oldest agent on the flow ordered by created_at,
 * id), so both are presented plainly here. This card is DRAWER-ONLY on purpose:
 * `agent`, `turn` and `duration_seconds` exist only on the detail resource, so no
 * table, board or KPI may render them.
 *
 * INTERVIEW-STOP-1 is LIVE (measured 31-07). `POST /applications/{id}/stop-interview`
 * and `POST /applications/{id}/resume-interview` are registered inside the tenant
 * group behind `permission:applications.update` and answer `{status: 'paused' |
 * 'active', paused_at}`. Consequences encoded in useInterviewSessionActions:
 *  · both routes target the APPLICATION id — the interview session id is never sent,
 *    so the buttons do NOT gate on `interview.id` (the LIST payload has no session id,
 *    which made the control read "unavailable" until the detail fetch landed);
 *  · a 404 is the backend's ordinary "no open interview session for this application"
 *    reply — it shows a notice and the control stays retryable, it does NOT mean the
 *    route is missing (that stale reading permanently killed the button);
 *  · the action responses carry only status/paused_at, so a success reconciles from a
 *    `GET /applications/{id}` refetch — the backend derives `turn` (and who paused)
 *    itself, and this card must show that, not a local guess.
 *
 * The flow/workflow override pickers and their own PATCH flows live in
 * useInterviewOverrides; the stop/resume state machine lives in
 * useInterviewSessionActions (SIZE-SPLIT-B extraction, zero behaviour change).
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { resolveDurationSeconds, splitDuration } from '../data/interviewDuration'
import { Hand, PlayCircle } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import SoftChip from '@/components/ui/SoftChip'
import StatusPill from '@/components/ui/StatusPill'
// HUISSTIJL-1: shared typography atom — the three plain 11px/muted lines
// below are exact matches for the house Caption scale.
import { Caption } from '@/components/ui/typography'
import { useAuth } from '@/context/AuthContext'
import { translateInterviewStatus } from '@/lib/interviewStatus'
import { interviewCategoryColor } from '../data/applicationsShared'
import { useInterviewOverrides } from './useInterviewOverrides'
import { useInterviewSessionActions } from './useInterviewSessionActions'
import type { ApplicationInterview } from '@/types/application'
import type { InterviewWorkflowRef } from '@/types/vacancy'
import type { Id } from '@/types/common'

// Soft-chip colour per turn (§4 semantic tokens, never ad-hoc hex) — who is
// currently expected to act in the conversation.
const TURN_COLOR: Record<string, string> = {
  agent: 'var(--color-info)',
  candidate: 'var(--color-primary)',
  // Finished: nobody is on turn, so it reads as neutral, not as a call to act.
  completed: 'var(--text-muted)',
  pending: 'var(--text-muted)',
  recruiter: 'var(--color-success)',
}

const cardStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
}

// Decorative separator between the meta line's segments — hidden from assistive
// tech since every segment around it already carries its own accessible text.
const MetaDot = () => <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 12 }}>·</span>

// Live interview summary card (see the module doc above): every field renders defensively as optional, and the stop/resume controls gate on the application id, never the interview session id (see the INTERVIEW-STOP-1 note).
export default function InterviewStatusCard({
  interview, applicationId, interviewFlowId, interviewWorkflowId, interviewWorkflow, hasInterviewWorkflowField = false,
}: {
  interview: ApplicationInterview | null; applicationId?: Id; interviewFlowId?: Id | null
  // INTERVIEW-WORKFLOW-1 (Appendix D/E): this application's own workflow override,
  // presence-gated the same way as the vacancy's own field (VacancyAgentTab).
  interviewWorkflowId?: Id | null
  // The already-resolved nested ref (folder/name/agent) off the application
  // detail — same MEDIUM fix as VacancyAgentTab's `selectOptions`: seeds the
  // InterviewWorkflowPicker's fallback option so a linked workflow missing from
  // the fetched list never shows the raw id in the trigger.
  interviewWorkflow?: InterviewWorkflowRef | null
  hasInterviewWorkflowField?: boolean
}) {
  const { t } = useTranslation('applications')
  const auth = useAuth()
  // Mirrors ApplicationsPage's own canManage gate and the route's own
  // `permission:applications.update` middleware — same permission string, same
  // source of truth. The backend re-checks (403); the UI only hides what the
  // user may not do.
  const canManage = auth?.hasPermission?.('applications.update') ?? false

  // Flow/workflow override pickers, own state + own PATCH — extracted hook.
  const { flowOverridePicker, workflowOverridePicker } = useInterviewOverrides({
    applicationId, interviewFlowId, interviewWorkflowId, interviewWorkflow, hasInterviewWorkflowField, canManage,
  })

  // Stop/resume state machine — extracted hook.
  const {
    refreshed, noSession, busy, canStop, stopDisabledReason, canResume, resumeDisabledReason, onStop, onResume,
  } = useInterviewSessionActions({ interview, applicationId, canManage })

  // No session at all yet — a calm placeholder, not an empty blank area.
  if (!interview) {
    return (
      <div style={cardStyle}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('interview.status.none')}</span>
        {flowOverridePicker}
        {workflowOverridePicker}
      </div>
    )
  }

  // INTERVIEW-SIBLING-1: this session was borrowed from a sibling application of
  // the same candidate on the same flow — an honest note instead of implying this
  // application's own live progress; no stop/resume actions (a second session on
  // the same flow is blocked server-side).
  if (interview.sessionScope === 'candidate') {
    return (
      <div style={cardStyle}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {t('interview.status.borrowedFromSibling')}
        </span>
        {flowOverridePicker}
        {workflowOverridePicker}
      </div>
    )
  }

  const live = refreshed ?? interview
  const category = live.category
  const turn = live.turn
  const durationSeconds = resolveDurationSeconds(live)
  // ONE-STATUS-STORY-1: a terminal session (completed/disqualified) is done — no
  // "whose turn" and no step position left to report, so the render below
  // collapses to ONE status chip instead of three axes that all read "Afgerond".
  const isTerminal = category === 'completed' || category === 'disqualified'
  // The negative branch is a real backend signal (see the duration span's own
  // comment below), never a fabricated zero — kept separate from "no timing
  // data at all" (null) so the render can tell the two apart.
  const duration = durationSeconds != null && durationSeconds >= 0 ? splitDuration(durationSeconds) : null
  const negativeDuration = durationSeconds != null && durationSeconds < 0
  // True when this payload carries ANY of the visibility fields. The detail
  // contract always does, so in the drawer this is effectively always true; a
  // block reduced to category/step (a list-shaped object handed in) gets ONE calm
  // notice instead of four separate "unknown" chips.
  const hasVisibilityData = Boolean(live.agent || live.flowName || live.turn || durationSeconds != null)

  return (
    <div style={cardStyle}>
      {/* I1 (Danny 08-08 screenshot): ONE calm meta line — avatar, name, flow,
          status chip, turn chip, step, current status — instead of the previous
          layout where the agent/flow sat in their own stacked title+subtitle
          block and pushed the chips onto separately wrapped lines. Every segment
          stays its OWN text node (so exact-text lookups and i18n keys are
          unaffected) joined visually by a middle dot; the row wraps as a group
          only once it truly runs out of horizontal room. Elapsed time moves to
          its own line below — it isn't part of this "who/where" summary and its
          long phrase was itself crowding the rest off the row. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Agent identity, stated plainly: the backend resolves the running agent
            deterministically (vacancy-coupled → flow persona → oldest by
            created_at/id), so the name is a fact, not a best guess. "Unknown
            agent" only for a payload that carries no agent at all (list rows). */}
        <Avatar initials={(live.agent?.name?.[0] ?? '?').toUpperCase()} size={26} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          {live.agent?.name || t('interview.status.noAgent')}
        </span>
        {/* The flow's own name (interview_flows.name) — tenant-authored, so it may
            already read e.g. "Zorgintake (9 stappen)" on its own. Rendered as
            PLAIN TEXT: no in-app surface shows a single interview flow today
            (#settings/ai/koios is connection/models/rates only — measured), and
            a link to a screen that cannot show the flow is a fake affordance
            (§3). `flowId` stays mapped (InterviewSessionResource.php:81) for the
            day a flow screen exists. */}
        {live.flowName && (
          <>
            <MetaDot />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{live.flowName}</span>
          </>
        )}

        {/* ONE-STATUS-STORY-1: a finished session shows exactly ONE status chip —
            the current-status label (or the category label when the flow never
            reported one) — never the turn chip + category chip + plain-text
            current-status trio that all collapsed to "Afgerond" together. A
            running session drops the category chip (duplicate of the turn chip's
            own activity signal) and keeps the turn chip + step readout instead. */}
        {isTerminal ? (
          <StatusPill
            // The terminal WORD leads: use the current-status label only when it
            // is itself terminal (COMPLETED/DISQUALIFIED) — a terminal session
            // whose current_status is a mid-flow step must never carry that step
            // name as the only status text with "finished" left to colour alone (§6).
            label={live.currentStatus && ['COMPLETED', 'DISQUALIFIED'].includes(live.currentStatus)
              ? translateInterviewStatus(t, live.currentStatus)
              : t(`interview.category.${category}`)}
            color={interviewCategoryColor(category)}
          />
        ) : (
          <>
            {/* Turn — soft chip, colour + TEXT (never colour-only, §6 a11y). */}
            {turn && <SoftChip label={t(`interview.status.turn.${turn}`)} color={TURN_COLOR[turn]} round />}

            {/* DD-FE-11 (08-08 drill-down audit, "Stap 2 van 12" read as the ONLY
                signal): the flow's own current-step NAME is now the PRIMARY
                progress readout — see @/lib/interviewStatus for why an
                unknown flow-authored value is never shown raw. The numeric
                position is kept, but demoted to a small muted suffix right after
                the name (never dropped) — mirrors the equally-ordered interview
                cell in ApplicationStatusStrip (name main, step count muted after).
                ONE dot introduces the whole progress unit; the row's own `gap`
                already spaces the name/count pair inside it. */}
            {(live.currentStatus || live.total > 0) && <MetaDot />}
            {live.currentStatus && (
              <span style={{ fontSize: 12, color: 'var(--text)' }}>
                {translateInterviewStatus(t, live.currentStatus)}
              </span>
            )}
            {/* INTERVIEW-STEP-COUNT-1: prefer the question-only count
                (questionStepsTotal), falling back to the legacy step/total pair
                when a payload lacks it (tolerant, §9). */}
            {((live.questionStepsTotal ?? 0) > 0 || live.total > 0) && (
              <Caption>
                {(live.questionStepsTotal ?? 0) > 0
                  ? t('interview.stepOf', { step: live.questionStepIndex ?? '–', total: live.questionStepsTotal ?? 0 })
                  : t('interview.stepOf', { step: live.step ?? '–', total: live.total })}
              </Caption>
            )}
          </>
        )}
      </div>

      {/* ELAPSED time since the interview started — deliberately NOT called
          conversation duration: the backend counts wall clock from session
          creation, so nights and weekends are inside this number. The tooltip
          spells that out; the value sits in its OWN span so label and value
          stay two distinct, independently queryable nodes. */}
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }} title={t('interview.status.durationHint')}>
        {t('interview.status.duration')}:{' '}
        <span>
          {duration ? (
            duration.days > 0
              ? t('interview.status.durationDays', duration)
              : duration.hours > 0
                ? t('interview.status.durationHours', duration)
                : t('interview.status.durationMinutes', { count: duration.minutes })
          ) : negativeDuration ? (
            // A negative raw span is a real backend signal, not "no data": Carbon's
            // signed diffInSeconds(completed_at ?? now()) can go negative on seeded
            // rows where completed_at predates created_at — the house dash, never a
            // fabricated "0 min" (§3 no fake affordance).
            '—'
          ) : t('interview.status.durationUnknown')}
        </span>
      </span>

      {!hasVisibilityData && (
        <Caption style={{ fontStyle: 'italic' }}>
          {t('interview.status.visibilityPending')}
        </Caption>
      )}

      {/* Stop/takeover + resume — authorization-gated (hidden, not just disabled,
          for a user who may not manage this application). Resume only shows once
          the session is actually paused; stop always shows (disabled otherwise),
          mirroring the original single-button precedent. */}
      {canManage && (
        <div style={{ display: 'flex', gap: 8 }}>
          {/* House buttons (HUISSTIJL-1): the stop/takeover action keeps its danger
              tint, resume is the accent action — identity from Button, never local. */}
          <Button variant="dangerSoft" size="sm" onClick={onStop} disabled={!canStop || busy}
            aria-label={t('interview.status.takeover')} title={stopDisabledReason ?? undefined}>
            <Hand size={12} />
            {busy ? t('interview.status.takeoverBusy') : t('interview.status.takeover')}
          </Button>
          {category === 'paused' && (
            <Button variant="primary" size="sm" onClick={onResume} disabled={!canResume || busy}
              aria-label={t('interview.resume')} title={resumeDisabledReason ?? undefined}>
              <PlayCircle size={12} />
              {busy ? t('interview.status.resumeBusy') : t('interview.resume')}
            </Button>
          )}
        </div>
      )}

      {/* The 404 answer, in words: this application has no running interview
          (any more). Informative — the buttons above stay clickable. */}
      {noSession && (
        <Caption style={{ fontStyle: 'italic' }}>
          {t('interview.status.noRunningSession')}
        </Caption>
      )}

      {flowOverridePicker}
      {workflowOverridePicker}
    </div>
  )
}

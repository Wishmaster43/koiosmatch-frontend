/**
 * InterviewsTab — the AI/WhatsApp interview(s) for an application: one card per
 * REAL InterviewSession (APP-INTERVIEW-HISTORY-1), with its outcome chip and the
 * full transcript. Empty state when there are none.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, FileText } from 'lucide-react'
import StatusPill from '@/components/ui/StatusPill'
import { GroupLabel } from '@/components/ui/typography'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/context/AuthContext'
import api, { unwrap } from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useDateFormat } from '@/lib/datetime'
import { isReversedInterviewRange } from '../data/interviewRange'
import Button from '@/components/ui/Button'
import { tintBg, tintBorder } from '@/lib/tint'
import { Caption } from '@/components/ui/typography'
import { useInterviewOptions } from '@/hooks/useInterviewOptions'
import InterviewStatusCard from './InterviewStatusCard'
import { mapInterview } from '../data/mapApplication'
import { resolveEffectiveInterviewWorkflow, type EffectiveInterviewWorkflow } from '../data/interviewWorkflowEffective'
import type { ApplicationDetail, ApplicationInterview, ApiApplication } from '@/types/application'
import type { Id } from '@/types/common'

type TranscriptMsg = ApplicationDetail['interviews'][number]['transcript'][number]

// The guard-skip reasons the 422 response carries for INTERVIEW-PERAPP-1
// (COORDINATION-LOG r22-07 audit round), extended by INTERVIEW-FLAG-1 with the
// no-linked-workflow/inactive/budget/engine-failure reasons — each maps to its
// own i18n message; an unknown/future code falls back to the generic
// action-failed notice (§3).
const START_INTERVIEW_REASONS = [
  'no_mobile_or_consent', 'no_active_connection', 'rejected_stage',
  'placed_stage', 'no_active_flow', 'no_candidate', 'send_failed', 'no_agent',
  'no_interview_workflow', 'workflow_inactive', 'budget_exceeded', 'workflow_failed',
  // 'already_running' reads its own existing alreadyRunning message (see onStart), not a reasons.* key.
  'already_running',
] as const
type StartInterviewReason = (typeof START_INTERVIEW_REASONS)[number]
const isStartInterviewReason = (v: unknown): v is StartInterviewReason =>
  typeof v === 'string' && (START_INTERVIEW_REASONS as readonly string[]).includes(v)

// W7: soft-chip colour per interview-session outcome (§4 semantic tokens, never ad-hoc
// hex). This is the REAL history contract's `status` (completed/failed/running) — a
// different axis from InterviewStatusCard's LIVE `category` (busy/completed/disqualified/
// paused), so it is its own small map rather than reusing interviewCategoryColor.
const HISTORY_STATUS_COLOR: Record<string, string> = {
  completed: 'var(--color-success)',
  failed: 'var(--color-danger)',
  running: 'var(--color-info)',
}

// W7: one transcript bubble, aligned by `direction` (outbound = us, right; inbound =
// candidate, left) — mirrors ConversationsSection's WhatsApp bubble convention. The real
// contract carries no author identity (data minimisation §9), so direction is the only
// signal; sent_at renders via the shared useDateFormat, never a raw ISO string.
function TranscriptBubble({ msg }: { msg: TranscriptMsg }) {
  const { formatDateTime } = useDateFormat()
  const isOut = msg.direction === 'outbound'
  const color = isOut ? 'var(--color-primary)' : 'var(--color-success)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOut ? 'flex-end' : 'flex-start', gap: 3 }}>
      {/* Canon (05-08): body text 12px, matching the candidate profile/notes prose convention.
          Bubble fill via the lib/tint house pair (neutral ink — a bubble, not a chip). */}
      <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: 10, fontSize: 12, color: 'var(--text)', lineHeight: 1.45,
        background: tintBg(color),
        border: tintBorder(color) }}>
        {msg.body || '—'}
      </div>
      {msg.sentAt && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDateTime(msg.sentAt)}</span>}
    </div>
  )
}

/**
 * StartInterviewAction — INTERVIEW-PERAPP-1 (now LIVE, contract-complete
 * 22-07): kicks off a fresh interview session for THIS application, when none
 * is running yet. Hidden entirely without applications.update (mirrors
 * InterviewStatusCard's canManage gate — same permission, same source).
 *
 * INTERVIEW-FLAG-1 (Danny 30-09, points 1-3: "Workflow is genoeg toch?" /
 * "Start interview moet wel kunnen maar dan start dus onderwater de
 * workflow"): the manual agent picker is GONE — the card is ONE line (the
 * effective workflow's caption) plus a single "Start interview" button, which
 * POSTs with NO body; the backend derives the agent from the effective
 * workflow (this application's own override, else the vacancy default) and
 * refuses with `no_interview_workflow` when nothing is linked. So the button
 * is only ENABLED when an effective workflow resolved at all (regardless of
 * whether it carries a known agent name) — never a dead affordance (§3).
 * Response handling: 201 = started, 200 = an idempotent dup on THIS SAME
 * application (existing session returned — still success, own toast so
 * "started" is never claimed for a session already running), 409
 * already_has_session = an OPEN session on a DIFFERENT application (specific
 * message), 422 = a guard skip with one of the known reasons (own message
 * each, unknown reasons fall back to the generic notice). The 404 honest-gate
 * stays as a safety net (§3) though it should no longer be hit in practice.
 */
function StartInterviewAction({ applicationId, effective, onStarted }: {
  applicationId: Id | undefined
  // The resolved workflow in effect, or null when none — computed once by the
  // parent (InterviewsTab) so this card and the status card's own caption
  // always agree on the same resolution.
  effective: EffectiveInterviewWorkflow | null
  onStarted: (iv: ApplicationInterview) => void
}) {
  const { t } = useTranslation('applications')
  const auth = useAuth()
  const canManage = auth?.hasPermission?.('applications.update') ?? false
  const [busy, setBusy] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  if (!canManage) return null

  // Real POST against the now-live contract — see the doc comment above for the
  // full 200/201/409/422 breakdown. A 404 (safety net only) disables the action
  // honestly; every other failure surfaces a message but stays retryable —
  // notably 422 send_failed, where the backend rolls the session back so a
  // simple re-click of this same button IS the retry (§3, no fake affordance).
  const onStart = async () => {
    if (busy || applicationId == null || !effective) return
    setBusy(true)
    try {
      // INTERVIEW-FLAG-1: no body — the server derives the agent from the
      // effective workflow, so the client no longer chooses or sends one.
      const res = await api.post(`/applications/${applicationId}/interview`)
      const raw = unwrap<NonNullable<ApiApplication['interview']>>(res)
      const iv = mapInterview(raw)
      if (iv) onStarted(iv)
      // 200 = the idempotent dup on this SAME application (existing session
      // returned) — never claim "started" for a session that was already running.
      notifySuccess(res.status === 200 ? t('interview.start.alreadyRunning') : t('interview.start.started'))
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const reason = (err as { response?: { data?: { reason?: string } } })?.response?.data?.reason
      if (status === 404) {
        setUnavailable(true)
        notifyError(t('interview.start.unavailable'))
      } else if (status === 409 && reason === 'already_has_session') {
        // A DIFFERENT application already has an open session for this candidate —
        // distinct from the 404 gate and from a generic failure (specific, actionable copy).
        notifyError(t('interview.start.alreadyHasSession'))
      } else if (reason === 'already_running') {
        notifyError(t('interview.start.alreadyRunning'))
      } else if (status === 422 && isStartInterviewReason(reason)) {
        notifyError(t(`interview.start.reasons.${reason}`))
      } else {
        notifyError(extractApiError(err, t('common:actionFailed')))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* The effective workflow's caption — the agent name only when the
            resolution actually carries one (a workflow without an embedded
            agent still starts; the server derives it). */}
        {effective && (
          <Caption>
            {effective.agentName
              ? t('interview.start.viaWorkflow', { workflow: effective.workflowName, agent: effective.agentName })
              : t('interview.start.viaWorkflowNoAgent', { workflow: effective.workflowName })}
          </Caption>
        )}
        {/* House Button (Danny 20-08, pasted this pill: "this one too") — the 05-08
            soft-tint predates PRIMAIR-VLAK-1; an accent ACTION wears the solid trio
            via Button, at the drawer sm standard. */}
        <Button variant="primary" onClick={onStart} disabled={busy || unavailable || !effective}
          title={!effective ? t('interview.start.needsWorkflow') : undefined}>
          {t('interview.start.label')}
        </Button>
      </div>
      {/* No effective workflow at all: disabled button + an honest reason (§3). */}
      {!effective && <Caption style={{ fontStyle: 'italic' }}>{t('interview.start.needsWorkflow')}</Caption>}
      {unavailable && (
        <Caption style={{ fontStyle: 'italic' }}>{t('interview.start.unavailable')}</Caption>
      )}
    </div>
  )
}


// The application drawer's interviews tab: schedule/history only. The live
// conversation thread moved to its own Gesprekken tab (GESPREK-CONSISTENT-1-FE,
// ApplicationConversationsSection) — ONE reader per drawer, never two copies,
// and reading/starting a conversation now works identically on every screen
// that shows the person, not scoped to this one application.
export default function InterviewsTab({ application: a, detailPhase }: { application: ApplicationDetail; detailPhase?: 'idle' | 'loading' | 'ready' | 'error' }) {
  const { t } = useTranslation('applications')

  const { formatDateTime } = useDateFormat()
  const interviews = a.interviews ?? []
  // Local override once a Flow-B "start interview" POST succeeds — the drawer's
  // own application object won't reflect it until the next fetch, so the status
  // card flips live off this override (mirrors InterviewStatusCard's own turn
  // override for the same class of problem: no refetch plumbing in this tab).
  const [startedOverride, setStartedOverride] = useState<ApplicationInterview | null>(null)
  const interview = startedOverride ?? a.interview


  // Hide the start action once a session exists (INCLUDING a borrowed sibling
  // session — INTERVIEW-SIBLING-1 forbids a second session on the same flow), or
  // once the application sits in a terminal bucket (rejected/matched) — starting a
  // NEW interview there makes no sense (bucket is the same flag-derived outcome
  // used across the tab).
  const canStartNew = !interview && a.bucket !== 'rejected' && a.bucket !== 'matched'

  // INTERVIEW-VISIBILITY-1: the ONE workflow resolution (own override, else the
  // vacancy default), shared by the start card and InterviewStatusCard's own
  // vacancy-default caption so they never disagree. The BE today only emits
  // `interview_workflow_id` on the application (no embedded `interview_workflow`
  // object yet), so the own workflow is looked up by id — same order as
  // `linkedWorkflow` in useInterviewOverrides — falling back to a.interviewWorkflow
  // for whichever contract version is actually live.
  const { workflowById: ownWorkflowById } = useInterviewOptions(a.hasInterviewWorkflowField)
  const listedOwnWorkflow = a.interviewWorkflowId != null ? ownWorkflowById.get(String(a.interviewWorkflowId)) : undefined
  // Normalise the tenant-list Workflow shape into the same InterviewWorkflowRef
  // shape as a.interviewWorkflow, mirroring useInterviewOverrides' own build.
  const ownWorkflow = listedOwnWorkflow
    ? { id: listedOwnWorkflow.id ?? '', name: listedOwnWorkflow.name ?? '', agent: listedOwnWorkflow.agent ?? null }
    : a.interviewWorkflow
  const effectiveWorkflow = resolveEffectiveInterviewWorkflow(ownWorkflow, a.vacancyInterviewWorkflow)

  // The list row carries no interviews[] (detail-only) and a deep-link opens on a
  // bare {id}: while the detail fetch runs — or after it FAILED — an empty state
  // would be a lie about data that simply is not here (yet). Honest states first.
  if (detailPhase === 'loading') {
    return (
      <Caption as="div" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0' }}>
        <Spinner size={14} /> {t('interview.loadingDetail', { defaultValue: 'Interviewgegevens laden…' })}
      </Caption>
    )
  }
  if (detailPhase === 'error') {
    return (
      <Caption as="div" style={{ padding: '24px 0' }}>
        {t('interview.detailError', { defaultValue: 'Interviewgegevens konden niet worden geladen. Sluit de drilldown en probeer opnieuw.' })}
      </Caption>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* INTERVIEW-VISIBILITY-1 (speculative): the live session's agent/turn/step/
          duration, distinct from the transcripts below (that's the per-run
          history; this is "where things stand right now"). Always rendered —
          shows its own honest placeholder when there is no session at all. */}
      <InterviewStatusCard
        interview={interview} applicationId={a.id}
        interviewWorkflowId={a.interviewWorkflowId} interviewWorkflow={a.interviewWorkflow}
        hasInterviewWorkflowField={a.hasInterviewWorkflowField}
        vacancyId={a.vacancy?.id} vacancyInterviewWorkflow={a.vacancyInterviewWorkflow}
      />
      {canStartNew && (
        <StartInterviewAction applicationId={a.id} effective={effectiveWorkflow} onStarted={setStartedOverride} />
      )}

      {/* ONE "nothing yet" message, never two (Danny 22-08, screenshot): while no
          live session exists either, the status card above already says so — the
          history's own empty state only adds noise then. It still shows once a
          live session exists without any FINISHED history behind it. */}
      {!interviews.length ? (interview != null && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 64, textAlign: 'center', color: 'var(--text-muted)' }}>
          <span style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <FileText size={22} style={{ opacity: 0.6 }} />
          </span>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('interview.empty')}</div>
        </div>
      )) : interviews.map(iv => (
        <div key={iv.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Header — WhatsApp affordance in the success token (F6: mirrors ProfileTab's
              waDigits() hover colour) rather than the brand's literal hex green. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0,
              // Icon (non-text) on the FIXED success fill: WCAG 1.4.11 bar is 3:1 and
              // white measures 3.3:1 there — audited; text on this fill would use on-success.
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <MessageCircle size={20} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('interview.title')}</div>
              {/* W7: started/finished from the real session columns — a range once
                  finished, "Started …" while still running (mirrors the drawer.placementPeriod
                  en-dash convention). A finished-before-started row (seeded data, see
                  isReversedInterviewRange's own doc comment) shows ONLY the finished
                  date rather than a reversed range that lies about event order — the
                  title tooltip names the data caveat honestly. */}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}
                title={isReversedInterviewRange(iv.startedAt, iv.finishedAt) ? t('interview.history.reversedDatesHint') : undefined}>
                {isReversedInterviewRange(iv.startedAt, iv.finishedAt)
                  ? (
                    <>
                      {t('interview.history.finishedOnly', { date: formatDateTime(iv.finishedAt) })}
                      {/* §6: the caveat must reach assistive tech too — a title
                          on a non-interactive div is mouse-only. */}
                      <span className="sr-only">{t('interview.history.reversedDatesHint')}</span>
                    </>
                  )
                  : iv.finishedAt
                    ? t('interview.history.period', { start: formatDateTime(iv.startedAt), end: formatDateTime(iv.finishedAt) })
                    : t('interview.history.startedAt', { date: formatDateTime(iv.startedAt) })}
              </div>
            </div>
            {/* W7: the session OUTCOME as a soft chip in its own colour — never a plain
                "done" badge, since the real contract's `status` is always one of
                completed/failed/running (never a boolean-ish "done"). */}
            {iv.status && <StatusPill label={t(`interview.history.status.${iv.status}`)} color={HISTORY_STATUS_COLOR[iv.status]} />}
          </div>

          {/* Transcript — canon (05-08): shared GroupLabel atom (11px muted uppercase). */}
          {iv.transcript.length > 0 && (
            <div>
              <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 8 }}>{t('interview.transcript')}</GroupLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {iv.transcript.map((m, i) => <TranscriptBubble key={i} msg={m} />)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

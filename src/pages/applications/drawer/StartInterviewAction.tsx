/**
 * StartInterviewAction — INTERVIEWS-SPLIT-1: the Flow B "start interview" card,
 * extracted verbatim from InterviewsTab.tsx (size split, no behaviour change).
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import api, { unwrap } from '@/lib/api'
import { withIdempotencyKey } from '@/lib/idempotency'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import Button from '@/components/ui/Button'
import { Caption } from '@/components/ui/typography'
import InterviewConsentRow from '../addmodal/InterviewConsentRow'
import { isInterviewSkipCode } from './interviewSkipReasons'
import { mapInterview } from '../data/mapApplication'
import QueuedInterviewNotice from './QueuedInterviewNotice'
import { useQueuedInterviewPoll } from './useQueuedInterviewPoll'
import type { EffectiveInterviewWorkflow } from '../data/interviewWorkflowEffective'
import type { ApplicationInterview, ApiApplication } from '@/types/application'
import type { Id } from '@/types/common'

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
 * POSTs with no body unless consent is ticked; the backend derives the agent from the effective
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
 * START-CONSENT-FE-1 (ONIX K-006, decision 1b = A: every start path records the
 * interview consent BEFORE the start): while the application has no recorded
 * consent the card carries the same unchecked consent row as the apply modals,
 * and a ticked row sends `interview_consent: true`. The server decides whether
 * the vacancy needs it (hidden = no), so the button never blocks on the row.
 */
export default function StartInterviewAction({ applicationId, effective, consentGivenAt, skippedAt, onStarted }: {
  applicationId: Id | undefined
  // The resolved workflow in effect, or null when none — computed once by the
  // parent (InterviewsTab) so this card and the status card's own caption
  // always agree on the same resolution.
  effective: EffectiveInterviewWorkflow | null
  // When the application's interview consent was recorded (null = not yet, so the card asks for it).
  consentGivenAt: string | null | undefined
  // The earlier skip the tab shows; a queued retry must not mistake it for a new verdict.
  skippedAt?: string | null
  onStarted: (iv: ApplicationInterview) => void
}) {
  const { t } = useTranslation('applications')
  const auth = useAuth()
  const canManage = auth?.hasPermission?.('applications.update') ?? false
  const [busy, setBusy] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  // Unchecked by default: the system never assumes consent (K-006).
  const [consent, setConsent] = useState(false)
  // Set once a ticked start reached the server: the BE records the consent before it judges the start.
  const [consentRecorded, setConsentRecorded] = useState(false)
  // Run id of a start the server queued (202); the poll waits for the session.
  const [queuedRunId, setQueuedRunId] = useState<string | null>(null)
  // Queue refusal flag (button returns with a notice) and the skipped_at held at the 202: only a different one is fresh.
  const [queueSkipped, setQueueSkipped] = useState(false)
  const skippedSnapshot = useRef<string | null>(null)

  // Reads the application and maps its interview block (same GET the drawer detail uses).
  const fetchInterview = async () => {
    const res = await api.get(`/applications/${applicationId}`)
    const raw = unwrap<ApiApplication>(res)?.interview
    const iv = mapInterview(raw)
    if (iv) return { kind: 'landed' as const, iv }
    // A refused start comes back as a skipped block, which is not a session.
    return raw?.status === 'skipped' && raw.skipped_at && raw.skipped_at !== skippedSnapshot.current
      ? { kind: 'skipped' as const } : null
  }
  // The session landed: hand it over once and announce the start.
  const { capped } = useQueuedInterviewPoll({
    applicationId, runId: queuedRunId, fetchInterview,
    onLanded: iv => { setQueuedRunId(null); onStarted(iv); notifySuccess(t('interview.start.started')) },
    onSkipped: () => { setQueuedRunId(null); setQueueSkipped(true) },
  })

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
      // INTERVIEW-FLAG-1: the server derives the agent from the effective workflow, so the
      // only body is the staff consent of START-CONSENT-FE-1, sent when the row was ticked.
      // Starting an interview session is irreversible-feeling: one Idempotency-Key per click.
      const body = consent && !consentRecorded ? { interview_consent: true } : undefined
      const res = await api.post(`/applications/${applicationId}/interview`, body, withIdempotencyKey())
      const raw = unwrap<NonNullable<ApiApplication['interview']>>(res)
      // 202 = queued behind a running worker: no session yet, so wait instead of faking one.
      const queued = raw as unknown as { status?: string; run_id?: string } | null
      if (res.status === 202 || queued?.status === 'queued') {
        setQueueSkipped(false)
        skippedSnapshot.current = skippedAt ?? null
        setQueuedRunId(queued?.run_id ?? 'queued')
        return
      }
      const iv = mapInterview(raw)
      if (iv) onStarted(iv)
      // 200 = the idempotent dup on this SAME application (existing session
      // returned) — never claim "started" for a session that was already running.
      notifySuccess(res.status === 200 ? t('interview.start.alreadyRunning') : t('interview.start.started'))
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const reason = (err as { response?: { data?: { reason?: string } } })?.response?.data?.reason
      // Recorded before the starter judges: 409, or 422 with a reason; stop asking again.
      if (consent && (status === 409 || (status === 422 && reason != null))) setConsentRecorded(true)
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
      } else if (status === 422 && isInterviewSkipCode(reason)) {
        // The consent, AI-disclosure and action-rule gates read the status card's own skip sentence.
        notifyError(t(`interview.skipReason.${reason}`))
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
      {/* START-CONSENT-FE-1: asked only while no consent is recorded AND Start can run (§3: no tick that goes nowhere). */}
      {!consentGivenAt && !consentRecorded && effective && !unavailable && (
        <InterviewConsentRow checked={consent} onChange={setConsent} style={{ marginBottom: 0 }} />
      )}
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
        {queuedRunId ? (
          <QueuedInterviewNotice state={capped ? 'capped' : 'queued'} />
        ) : (
          <Button variant="primary" onClick={onStart} disabled={busy || unavailable || !effective}
            title={!effective ? t('interview.start.needsWorkflow') : undefined}>
            {t('interview.start.label')}
          </Button>
        )}
      </div>
      {queueSkipped && !queuedRunId && <QueuedInterviewNotice state="skipped" />}
      {/* No effective workflow at all: disabled button + an honest reason (§3). */}
      {!effective && <Caption style={{ fontStyle: 'italic' }}>{t('interview.start.needsWorkflow')}</Caption>}
      {unavailable && (
        <Caption style={{ fontStyle: 'italic' }}>{t('interview.start.unavailable')}</Caption>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, FileText } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import StatusPill from '@/components/ui/StatusPill'
import { GroupLabel } from '@/components/ui/typography'
import ConversationsSection from '@/components/drawer/ConversationsSection'
import { useAuth } from '@/context/AuthContext'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useDateFormat } from '@/lib/datetime'
import { isReversedInterviewRange } from '../data/interviewRange'
import Button from '@/components/ui/Button'
import { tintBg, tintBorder } from '@/lib/tint'
import { Caption } from '@/components/ui/typography'
import { useAiAgents } from '../hooks/useAiAgents'
import InterviewStatusCard from './InterviewStatusCard'
import { mapInterview } from '../data/mapApplication'
import type { ApplicationDetail, ApplicationInterview, ApiApplication } from '@/types/application'
import type { Id } from '@/types/common'

type TranscriptMsg = ApplicationDetail['interviews'][number]['transcript'][number]

// The 7 guard-skip reasons the 422 response carries for INTERVIEW-PERAPP-1
// (COORDINATION-LOG r22-07 audit round) — each maps to its own i18n message;
// an unknown/future code falls back to the generic action-failed notice (§3).
const START_INTERVIEW_REASONS = [
  'no_mobile_or_consent', 'no_active_connection', 'rejected_stage',
  'placed_stage', 'no_active_flow', 'no_candidate', 'send_failed',
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
 * 22-07): lets a recruiter pick an AI agent and kick off a fresh interview
 * session for THIS application, when none is running yet. Hidden entirely
 * without applications.update (mirrors InterviewStatusCard's canManage gate —
 * same permission, same source). Response handling per the confirmed
 * contract: 201 = started, 200 = an idempotent dup on THIS SAME application
 * (existing session returned — still success, own toast so "started" is
 * never claimed for a session already running), 409 already_has_session = an
 * OPEN session on a DIFFERENT application (specific message, not the generic
 * fallback), 422 = a guard skip with one of 7 known reasons (own message
 * each, unknown reasons fall back to the generic notice). The 404 honest-gate
 * stays as a safety net (§3) though it should no longer be hit in practice.
 */
function StartInterviewAction({ applicationId, onStarted }: { applicationId: Id | undefined; onStarted: (iv: ApplicationInterview) => void }) {
  const { t } = useTranslation('applications')
  const auth = useAuth()
  const canManage = auth?.hasPermission?.('applications.update') ?? false
  const { options, loading, error } = useAiAgents(canManage)
  const [agentId, setAgentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  if (!canManage) return null

  // Real POST against the now-live contract — see the doc comment above for the
  // full 200/201/409/422 breakdown. A 404 (safety net only) disables the action
  // honestly; every other failure surfaces a message but stays retryable —
  // notably 422 send_failed, where the backend rolls the session back so a
  // simple re-click of this same button IS the retry (§3, no fake affordance).
  const onStart = async () => {
    if (!agentId) { notifyError(t('interview.start.noAgentChosen')); return }
    if (busy || applicationId == null) return
    setBusy(true)
    try {
      const res = await api.post(`/applications/${applicationId}/interview`, { agent_id: agentId })
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
        <CreatableSelect value={agentId || null} onChange={setAgentId} allowCreate={false}
          placeholder={loading ? t('common:loading') : t('interview.start.agentPlaceholder')}
          options={options.map(o => ({ value: String(o.value), label: o.label }))} />
        {/* House Button (Danny 20-08, pasted this pill: "Deze ook nog") — the 05-08
            soft-tint predates PRIMAIR-VLAK-1; an accent ACTION wears the solid trio
            via Button, at the drawer sm standard. */}
        <Button variant="primary" onClick={onStart} disabled={busy || unavailable}>
          {t('interview.start.label')}
        </Button>
      </div>
      {error && <span style={{ fontSize: 11, color: 'var(--color-danger-text)' }}>{t('interview.start.loadError')}</span>}
      {unavailable && (
        <Caption style={{ fontStyle: 'italic' }}>{t('interview.start.unavailable')}</Caption>
      )}
    </div>
  )
}


// Which /conversations query the live panel below should render — never both at
// once, so the panel below stays a single, unambiguous ConversationsSection call.
type ConversationScope = { params: Record<string, Id> } | null

/**
 * useConversationScope — CONV-APPLICATION-ID-1 (re-verified live 08-08 AFTER the
 * backend landing, on S-00001/Noud van Leeuwen): InterviewEngine::startForApplication()
 * now sets Conversation.application_id going forward (read in InterviewEngine.php), so
 * GET /conversations?application_id=<id> is the PRECISE per-application thread — no
 * longer mixes in another application's interview for the same candidate. But the fix
 * is code-forward only: the live re-measurement still shows S-00001's own thread
 * answering 0 rows for that scoped query — its Conversation row predates the write.
 * The model also keeps exactly ONE Conversation row per candidate
 * (`firstOrCreate(['candidate_id' => …])`), so an OLDER application's thread can later
 * get its application_id repointed at a newer interview on the same candidate — the
 * exact "mixes in threads from OTHER applications" bug this tab used to have with the
 * candidate_id-only link. So: try the precise application scope first; fall back to the
 * candidate-wide scope (the previous, honest link) ONLY when that precise read comes
 * back empty, never the other way around. Skips the network call entirely when there is
 * no candidate at all (`enabled` false, or no candidateId) — no conversation can exist.
 */
function useConversationScope(enabled: boolean, applicationId: Id | undefined, candidateId: Id | null): { scope: ConversationScope; resolved: boolean } {
  const [state, setState] = useState<{ scope: ConversationScope; resolved: boolean }>({ scope: null, resolved: false })
  useEffect(() => {
    let alive = true
    // No candidate at all, or the panel isn't offered — never was a conversation
    // possible; skip the round-trip and let the caller show its own honest notice.
    if (!enabled || candidateId == null) { setState({ scope: null, resolved: true }); return () => { alive = false } }
    // No application id (shouldn't happen on a real drawer) — the always-safe
    // candidate-wide scope, no preflight needed.
    if (applicationId == null) { setState({ scope: { params: { candidate_id: candidateId } }, resolved: true }); return () => { alive = false } }
    setState({ scope: null, resolved: false })
    api.get('/conversations', { params: { application_id: applicationId } })
      .then(r => {
        if (!alive) return
        const { rows } = unwrapList<{ id: Id }>(r)
        setState({
          scope: rows.length > 0 ? { params: { application_id: applicationId } } : { params: { candidate_id: candidateId } },
          resolved: true,
        })
      })
      .catch(() => {
        // The preflight itself failed — fall back to the candidate-wide scope (the
        // previously-working link) rather than blocking the panel on it entirely;
        // ConversationsSection still has its own error state for ITS OWN fetch.
        if (alive) setState({ scope: { params: { candidate_id: candidateId } }, resolved: true })
      })
    return () => { alive = false }
  }, [enabled, applicationId, candidateId])
  return state
}

/**
 * InterviewsTab — the AI/WhatsApp interview(s) for an application: one card per
 * REAL InterviewSession (APP-INTERVIEW-HISTORY-1), with its outcome chip and the
 * full transcript. Empty state when there are none.
 */
export default function InterviewsTab({ application: a }: { application: ApplicationDetail }) {
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
  // I2 (Danny 08-08 screenshot): only offer the live conversation panel once this
  // application has ever run an interview (a live session, or at least one row in
  // the history below) — this tab is interview-scoped, not general communication.
  const hasAnyInterviewActivity = Boolean(interview) || interviews.length > 0
  // CONV-APPLICATION-ID-1: resolve the precise vs. fallback scope (see the hook's
  // own doc comment above) — only ever runs the preflight while the panel is offered.
  const { scope, resolved } = useConversationScope(hasAnyInterviewActivity, a.id, a.candidateId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* INTERVIEW-VISIBILITY-1 (speculative): the live session's agent/turn/step/
          duration, distinct from the transcripts below (that's the per-run
          history; this is "where things stand right now"). Always rendered —
          shows its own honest placeholder when there is no session at all. */}
      <InterviewStatusCard interview={interview} applicationId={a.id} />
      {canStartNew && <StartInterviewAction applicationId={a.id} onStarted={setStartedOverride} />}

      {/* I2/CONV-APPLICATION-ID-1: the actual live WhatsApp dialogue, scoped to THIS
          application when the backend's per-application link resolves to a real
          thread, falling back to the candidate-wide link otherwise (see
          useConversationScope's doc comment for the full re-verification). Reuses
          the shared ConversationsSection exactly like the candidate drawer does. */}
      {hasAnyInterviewActivity && (
        <div>
          <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 8 }}>{t('interview.conversation.title')}</GroupLabel>
          {!resolved ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</span>
          ) : scope ? (
            <ConversationsSection threadsUrl="/conversations" threadsParams={scope.params} />
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t('interview.conversation.noCandidate')}
            </span>
          )}
        </div>
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

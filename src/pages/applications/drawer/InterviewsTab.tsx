import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, CheckCircle2, FileText } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useAuth } from '@/context/AuthContext'
import api, { unwrap } from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { BTN_H } from '@/config/buttonMetrics'
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

// A single transcript message (recruiter = out, candidate = in).
function Message({ msg }: { msg: TranscriptMsg }) {
  const isOut = msg.side === 'out'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg)',
      border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar initials={(msg.author?.[0] ?? '?').toUpperCase()} size={22} color={isOut ? 'var(--color-primary)' : undefined} />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{msg.author}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{msg.time}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45, paddingLeft: 30 }}>{msg.text}</div>
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
        <button type="button" onClick={onStart} disabled={busy || unavailable}
          style={{ height: BTN_H, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
            border: '1px solid var(--color-primary)', background: 'none', color: 'var(--color-primary)',
            cursor: busy || unavailable ? 'not-allowed' : 'pointer', opacity: busy || unavailable ? 0.6 : 1 }}>
          {t('interview.start.label')}
        </button>
      </div>
      {error && <span style={{ fontSize: 11, color: 'var(--color-danger)' }}>{t('interview.start.loadError')}</span>}
      {unavailable && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('interview.start.unavailable')}</span>
      )}
    </div>
  )
}

/**
 * InterviewsTab — the AI/WhatsApp interview(s) for an application: header,
 * summary and the full transcript. Empty state when there are none.
 */
export default function InterviewsTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation('applications')
  const interviews = a.interviews ?? []
  // Local override once a Flow-B "start interview" POST succeeds — the drawer's
  // own application object won't reflect it until the next fetch, so the status
  // card flips live off this override (mirrors InterviewStatusCard's own turn
  // override for the same class of problem: no refetch plumbing in this tab).
  const [startedOverride, setStartedOverride] = useState<ApplicationInterview | null>(null)
  const interview = startedOverride ?? a.interview
  // Hide the start action once a session exists, or once the application sits
  // in a terminal bucket (rejected/matched) — starting a NEW interview there
  // makes no sense (bucket is the same flag-derived outcome used across the tab).
  const canStartNew = !interview && a.bucket !== 'rejected' && a.bucket !== 'matched'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* INTERVIEW-VISIBILITY-1 (speculative): the live session's agent/turn/step/
          duration, distinct from the transcripts below (that's the per-run
          history; this is "where things stand right now"). Always rendered —
          shows its own honest placeholder when there is no session at all. */}
      <InterviewStatusCard interview={interview} applicationId={a.id} />
      {canStartNew && <StartInterviewAction applicationId={a.id} onStarted={setStartedOverride} />}

      {!interviews.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 64, textAlign: 'center', color: 'var(--text-muted)' }}>
          <span style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <FileText size={22} style={{ opacity: 0.6 }} />
          </span>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('interview.empty')}</div>
        </div>
      ) : interviews.map(iv => (
        <div key={iv.id} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header — WhatsApp affordance in the success token (F6: mirrors ProfileTab's
              waDigits() hover colour) rather than the brand's literal hex green. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <MessageCircle size={20} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('interview.title')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{iv.date} · {iv.time}</div>
            </div>
            {iv.status === 'done' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
                padding: '3px 10px', borderRadius: 99, background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                <CheckCircle2 size={12} /> {t('interview.done')}
              </span>
            )}
          </div>

          {/* Summary */}
          {iv.summary && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('interview.summary')}</div>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, margin: 0 }}>{iv.summary}</p>
            </div>
          )}

          {/* Transcript */}
          {iv.transcript.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('interview.transcript')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {iv.transcript.map((m, i) => <Message key={i} msg={m} />)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

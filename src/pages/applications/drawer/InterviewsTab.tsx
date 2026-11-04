/**
 * InterviewsTab — the AI/WhatsApp interview(s) for an application: one card per
 * REAL InterviewSession (APP-INTERVIEW-HISTORY-1), with its outcome chip and the
 * full transcript. Empty state when there are none.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, FileText } from 'lucide-react'
import StatusPill from '@/components/ui/StatusPill'
import { GroupLabel } from '@/components/ui/typography'
import Spinner from '@/components/ui/Spinner'
import { useDateFormat } from '@/lib/datetime'
import { isReversedInterviewRange } from '../data/interviewRange'
import { Caption } from '@/components/ui/typography'
import { useInterviewOptions } from '@/hooks/useInterviewOptions'
import InterviewStatusCard from './InterviewStatusCard'
import StartInterviewAction from './StartInterviewAction'
import TranscriptBubble from './TranscriptBubble'
import { resolveEffectiveInterviewWorkflow } from '../data/interviewWorkflowEffective'
import type { ApplicationDetail, ApplicationInterview } from '@/types/application'
import type { Id } from '@/types/common'

// W7: soft-chip colour per interview-session outcome (§4 semantic tokens, never ad-hoc
// hex). This is the REAL history contract's `status` (completed/failed/running) — a
// different axis from InterviewStatusCard's LIVE `category` (busy/completed/disqualified/
// paused), so it is its own small map rather than reusing interviewCategoryColor.
const HISTORY_STATUS_COLOR: Record<string, string> = {
  completed: 'var(--color-success)',
  failed: 'var(--color-danger)',
  running: 'var(--color-info)',
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
  // The workflow just saved in the status card (undefined = none saved this open): Start reads it at once, no drawer reopen.
  const [savedWorkflowId, setSavedWorkflowId] = useState<Id | null | undefined>(undefined)
  useEffect(() => { setSavedWorkflowId(undefined) }, [a.interviewWorkflowId])
  const ownWorkflowId = savedWorkflowId !== undefined ? savedWorkflowId : a.interviewWorkflowId
  const listedOwnWorkflow = ownWorkflowId != null ? ownWorkflowById.get(String(ownWorkflowId)) : undefined
  // Normalise the tenant-list Workflow shape into the same InterviewWorkflowRef
  // shape as a.interviewWorkflow, mirroring useInterviewOverrides' own build.
  const ownWorkflow = listedOwnWorkflow
    ? { id: listedOwnWorkflow.id ?? '', name: listedOwnWorkflow.name ?? '', agent: listedOwnWorkflow.agent ?? null }
    : savedWorkflowId !== undefined ? null : a.interviewWorkflow
  const effectiveWorkflow = resolveEffectiveInterviewWorkflow(ownWorkflow, a.vacancyInterviewWorkflow)

  // The list row carries no interviews[] (detail-only) and a deep-link opens on a
  // bare {id}: while the detail fetch runs — or after it FAILED — an empty state
  // would be a lie about data that simply is not here (yet). Honest states first.
  if (detailPhase === 'loading') {
    return (
      <Caption as="div" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0' }}>
        <Spinner size={14} /> {t('interview.loadingDetail')}
      </Caption>
    )
  }
  if (detailPhase === 'error') {
    return (
      <Caption as="div" style={{ padding: '24px 0' }}>
        {t('interview.detailError')}
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
        skipReason={a.interviewSkipReason} skippedAt={a.interviewSkippedAt}
        onWorkflowSaved={setSavedWorkflowId}
      />
      {canStartNew && (
        <StartInterviewAction applicationId={a.id} effective={effectiveWorkflow}
          consentGivenAt={a.interviewConsentGivenAt} skippedAt={a.interviewSkippedAt} onStarted={setStartedOverride} />
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

// VacancyAgentTab — the vacancy's linked AI interview agent + flow config, plus
// the INTERVIEW-BACKFILL-1 action that lets that agent pick up EXISTING
// applicants (never auto-fires, always confirmed first — AVG).
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { InterviewFlowSection } from '@/components/ai/management/InterviewFlowSection'
import api, { unwrap } from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import Button from '@/components/ui/Button'
import { useAiAgents } from '../hooks/useAiAgents'
import { useInterviewFlows } from '@/hooks/useInterviewFlows'
import { useInterviewWorkflows } from '@/hooks/useInterviewWorkflows'
import InterviewWorkflowPicker from '@/components/drawer/InterviewWorkflowPicker'
// HUISSTIJL-1: group labels (11/600/uppercase/muted) + hint text (11/muted) are the shared atoms.
import { GroupLabel, Caption } from '@/components/ui/typography'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

// One skipped applicant per INTERVIEW-BACKFILL-1's confirmed contract.
interface BackfillSkip { application_id?: Id; reason?: string }
interface BackfillResult { started?: number; skipped?: BackfillSkip[]; eligible_total?: number }

// The full skip-reason vocabulary (7 shared 422 guard reasons + the two
// backfill-only codes already_has_session/error) — every entry gets its own
// short i18n label for the grouped breakdown; anything unrecognised buckets
// under 'error' rather than rendering blank.
const BACKFILL_REASONS = [
  'no_mobile_or_consent', 'already_has_session', 'no_active_connection', 'rejected_stage',
  'placed_stage', 'no_active_flow', 'no_candidate', 'send_failed', 'error',
] as const
type BackfillReason = (typeof BACKFILL_REASONS)[number]
const normalizeBackfillReason = (v: string | undefined): BackfillReason =>
  (BACKFILL_REASONS as readonly string[]).includes(v ?? '') ? (v as BackfillReason) : 'error'

/**
 * BackfillInterviewsAction — INTERVIEW-BACKFILL-1 (now LIVE, contract-complete
 * 22-07): lets the linked agent pick up this vacancy's EXISTING applicants,
 * not just future ones. AVG: never auto-fires — always confirmed first (this
 * sends WhatsApp messages to real people), via the shared ConfirmDialog.
 * Result toast per the confirmed contract `{ started, skipped:[{application_id,
 * reason}], eligible_total }` — `eligible_total` counts only LIVE-stage
 * applications (rejected/placed never enter the pool), so the toast reads
 * "X of Y started" against that number, never the vacancy's raw applicant
 * count. When skips exist, they're grouped by reason and translated (mirrors
 * useCandidateStageBulk's `${count} ${label}` + join(', ') breakdown pattern
 * for a blocked-reason summary). The 404 honest-gate stays as a safety net
 * (§3) — also covers an unknown vacancy id, same "not available yet" notice.
 */
function BackfillInterviewsAction({ vacancyId, applicationsCount }: { vacancyId: Id | undefined; applicationsCount?: number }) {
  const { t } = useTranslation('vacancies')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  // Group skipped rows by reason → "{count} {label}" fragments, comma-joined —
  // the same shape as the toast body, e.g. "2 no WhatsApp consent, 1 already running".
  const summarizeSkips = (skipped: BackfillSkip[]): string => {
    const counts = new Map<BackfillReason, number>()
    for (const s of skipped) {
      const key = normalizeBackfillReason(s.reason)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([reason, count]) => `${count} ${t(`aiagent.backfill.reasons.${reason}`)}`)
      .join(', ')
  }

  // Real POST, only after explicit confirmation — a 404 disables the action
  // honestly; any other failure surfaces a message but stays retryable.
  const onConfirm = async () => {
    setConfirmOpen(false)
    if (vacancyId == null || busy) return
    setBusy(true)
    try {
      const res = await api.post(`/vacancies/${vacancyId}/start-interviews`)
      const result = unwrap<BackfillResult>(res)
      const started = result?.started ?? 0
      const skipped = result?.skipped ?? []
      const eligibleTotal = result?.eligible_total ?? started
      notifySuccess(skipped.length > 0
        ? t('aiagent.backfill.resultToastWithReasons', {
            started, eligibleTotal, skippedTotal: skipped.length, reasons: summarizeSkips(skipped),
          })
        : t('aiagent.backfill.resultToast', { started, eligibleTotal }))
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        setUnavailable(true)
        notifyError(t('aiagent.backfill.unavailable'))
      } else {
        notifyError(extractApiError(err, t('common:actionFailed')))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* House Button (Danny 20-08): this hand-drew the trio itself — the identity
          comes from Button, at the drawer sm standard. */}
      <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={busy || unavailable}
        style={{ alignSelf: 'flex-start' }}>
        {t('aiagent.backfill.button')}
      </Button>
      {unavailable && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{t('aiagent.backfill.unavailable')}</p>}
      <ConfirmDialog open={confirmOpen} onConfirm={onConfirm} onCancel={() => setConfirmOpen(false)}
        message={applicationsCount ? t('aiagent.backfill.confirmWithCount', { count: applicationsCount }) : t('aiagent.backfill.confirm')} />
    </>
  )
}

/**
 * VacancyAgentTab — its OWN tab (Danny 21-07, moved out of DetailsTab): the AI-agent
 * picker for this vacancy, and — once an agent is linked — the READ-ONLY interview
 * flow that agent carries (name/intro/statuses/dossier fields, via the shared
 * InterviewFlowSection). Linking an agent IS the interview on/off switch for this
 * vacancy (Option A: the agent carries its own flow, no separate flow field here).
 * Per-CANDIDATE interview progress/status lives on the APPLICATION, never here —
 * this tab only ever shows the interview's design/setup, never a status.
 */
export default function VacancyAgentTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: UpdateFn }) {
  const { t } = useTranslation('vacancies')
  // Own small fetch, always on (no shared edit/save chrome — a single field persists
  // immediately on change, mirroring MatchingTab's template picker).
  const { agents, options, loading, error } = useAiAgents(true)
  // INTERVIEW-FLOW-BINDING-1: the vacancy's own default-flow override — the
  // engine resolves module → application → vacancy → agent, so this only
  // matters once an agent is linked (an unlinked vacancy has no interview at all).
  const { options: flowOptions, describe: describeFlow, loading: flowsLoading, error: flowsError } = useInterviewFlows(true)
  // INTERVIEW-WORKFLOW-1 (Appendix D/E): the higher-level workflow link. Only
  // fetched while the picker can actually go live (presence gate below) — no
  // point loading the tenant's workflow list for a resource that cannot save it.
  const { options: workflowOptions, byId: workflowById, describe: describeWorkflow, loading: workflowsLoading, error: workflowsError } = useInterviewWorkflows(v.hasInterviewWorkflowField)

  const currentId = v.aiAgentId != null ? String(v.aiAgentId) : ''
  const linkedAgent = currentId ? agents.find(a => String(a.id) === currentId) : undefined
  const currentFlowId = v.interviewFlowId != null ? String(v.interviewFlowId) : ''

  // Picking (or clearing to '') persists immediately — null unlinks (VAC-AGENT-1:
  // no separate flow field, the agent carries its own).
  const pickAgent = (id: string) => {
    const picked = agents.find(a => String(a.id) === id)
    onUpdate?.(v.id, { aiAgentId: id || null, aiAgentName: id ? (picked?.name ?? v.aiAgentName) : '' })
  }

  // Picking (or clearing to '' → null) the default-flow override persists
  // immediately, same idiom as pickAgent — VAC-CLEAR-1: an empty value really
  // clears back to "no override" (the engine then falls back to the agent's own flow).
  const pickFlow = (id: string) => {
    onUpdate?.(v.id, { interviewFlowId: id || null })
  }

  // Picking (or clearing) the linked workflow persists immediately, same idiom
  // as pickAgent/pickFlow — VAC-CLEAR-1.
  const pickWorkflow = (id: string) => {
    onUpdate?.(v.id, { interviewWorkflowId: id || null })
  }

  // Seed the currently linked agent's already-resolved name (from the vacancy detail
  // itself) as a fallback option, so the picker never flashes the raw id while the
  // separate /ai/agents list is still loading or the tenant list is out of sync.
  const selectOptions = [
    { value: '', label: t('aiagent.none') },
    ...(currentId && v.aiAgentName && !options.some(o => String(o.value) === currentId)
      ? [{ value: currentId, label: v.aiAgentName }] : []),
    ...options.map(o => ({ value: String(o.value), label: o.label })),
  ]

  // INTERVIEW-WORKFLOW-1: once a workflow is actually linked, it resolves the
  // agent + flow itself — the pickers below become read-only derived display
  // rather than a second, contradicting source of truth (mirrors the flow
  // override's own "override set" branch further down, r2 C2).
  const isWorkflowLinked = v.hasInterviewWorkflowField && v.interviewWorkflowId != null

  // HIGH FIX: right after a fresh pick, `v.interviewWorkflow` may still be the
  // stale (null) nested ref for one render — `updateVacancy` only merges the UI
  // patch, and the PATCH-response re-sync in useVacancyRecord lands a tick
  // later. Resolve the display from the already-fetched workflow list first
  // (instant, no round trip needed) and fall back to the nested ref only when
  // the list hasn't loaded that id — never render the bare em-dash pair.
  const linkedWorkflow = v.interviewWorkflowId != null ? workflowById.get(String(v.interviewWorkflowId)) : undefined
  const derivedAgentName = linkedWorkflow?.agent?.name ?? v.interviewWorkflow?.agent?.name ?? '—'
  const derivedWorkflowName = linkedWorkflow?.name ?? v.interviewWorkflow?.name ?? '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* INTERVIEW-WORKFLOW-1 (Appendix D/E): the workflow link supersedes the
          agent+flow pair below once set. Presence-gated (§3): a tenant/backend
          not yet on this contract sees the field disabled with an honest notice,
          and the agent/flow pickers below keep working exactly as today. */}
      <div>
        <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 6 }}>{t('aiagent.workflow.sectionTitle')}</GroupLabel>
        <div style={{ ...blockStyle, padding: '10px 12px' }}>
          <InterviewWorkflowPicker
            value={v.interviewWorkflowId}
            onChange={pickWorkflow}
            options={workflowOptions}
            loading={workflowsLoading}
            error={workflowsError}
            disabled={!v.hasInterviewWorkflowField}
            notice={v.hasInterviewWorkflowField ? undefined : t('aiagent.workflow.unavailable')}
            linkedRef={v.interviewWorkflow}
            describe={describeWorkflow}
          />
        </div>
      </div>

      {/* Picker card — error state falls back to plain read-only text + notice, so the
          currently-linked agent stays visible even when the fresh list fails to load. */}
      <div>
        <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 6 }}>{t('aiagent.pickerLabel')}</GroupLabel>
        <div style={{ ...blockStyle, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isWorkflowLinked ? (
            // Derived display: the workflow resolves the agent, so a separate
            // picker here would be a second, contradicting source of truth.
            <span style={{ fontSize: 12, color: 'var(--text)' }}>
              {t('aiagent.workflow.derivedFrom', {
                agent: derivedAgentName,
                workflow: derivedWorkflowName,
              })}
            </span>
          ) : error ? (
            <>
              <span style={{ fontSize: 12, color: v.aiAgentName ? 'var(--text)' : 'var(--text-muted)' }}>{v.aiAgentName || t('aiagent.none')}</span>
              <span style={{ fontSize: 11, color: 'var(--color-danger-text)' }}>{t('aiagent.loadError')}</span>
            </>
          ) : (
            <>
              {/* Danny 14-08: the backfill button moves up NEXT TO the agent picker
                  (was buried at the tab's bottom) — only meaningful once an agent
                  is actually linked, so it only renders here once currentId is set. */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                  <CreatableSelect
                    value={currentId || null}
                    onChange={pickAgent}
                    allowCreate={false}
                    placeholder={loading ? t('common:loading') : t('aiagent.placeholder')}
                    options={selectOptions}
                  />
                </div>
                {currentId && <BackfillInterviewsAction vacancyId={v.id} applicationsCount={v.applicationsCount} />}
              </div>
              {!loading && options.length === 0 && (
                <Caption>{t('aiagent.empty')}</Caption>
              )}
            </>
          )}
          {/* Backfill runs unchanged regardless of workflow linkage — it only needs a
              linked agent id, which the workflow resolves onto aiAgentId server-side.
              Mirrors the original error-state exclusion (a failed agent-list load
              never offered the action either). Only fires for isWorkflowLinked,
              which has no picker row to sit beside — the picker branch above
              already renders it next to the CreatableSelect. */}
          {isWorkflowLinked && currentId && !error && <BackfillInterviewsAction vacancyId={v.id} applicationsCount={v.applicationsCount} />}
          {/* Calm, honest note — per-candidate interview PROGRESS lives on the
              application, this tab only ever shows the interview's setup (§3). */}
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{t('aiagent.explanation')}</p>
        </div>
      </div>

      {/* Interview flow resolution (FLOW-EDITOR-1, r2): vacancy override →
          agent fallback, both REAL now (the picker below writes
          vacancy.interview_flow_id; the engine honours application → vacancy →
          agent). The block always states the EFFECTIVE flow so a recruiter is
          never guessing which interview will run. */}
      <div>
        <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 6 }}>{t('aiagent.flowTitle')}</GroupLabel>
        {isWorkflowLinked ? (
          // Derived display (§3A): the workflow resolves its own flow — a second,
          // interactive flow picker here would contradict what actually runs.
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text)' }}>
            {t('aiagent.workflow.derivedFrom', {
              agent: derivedAgentName,
              workflow: derivedWorkflowName,
            })}
          </p>
        ) : (
          <>
        {currentId && (
          <div style={{ marginBottom: 8 }}>
            <CreatableSelect
              value={currentFlowId || null}
              onChange={pickFlow}
              allowCreate={false}
              clearable
              clearLabel={t('aiagent.flowPickerLabel')}
              placeholder={flowsLoading ? t('common:loading') : t('aiagent.flowPickerPlaceholder')}
              options={flowOptions}
            />
            {flowsError && <Caption style={{ color: 'var(--color-danger-text)' }}>{t('aiagent.loadError')}</Caption>}
          </div>
        )}
        {currentId ? (
          loading ? (
            <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
          ) : currentFlowId ? (
            // Override set: THIS flow runs — never the agent summary below it
            // (the engine's own resolution order; showing both contradicted
            // the screen the moment the picker was used, r2 C2).
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text)' }}>
              {t('aiagent.flowSource.fromVacancy', { flow: describeFlow(currentFlowId)?.label ?? currentFlowId })}
              {describeFlow(currentFlowId)?.inactive && (
                <span style={{ color: 'var(--color-danger-text)' }}> {t('aiagent.flowSource.inactiveWarning')}</span>
              )}
            </p>
          ) : (
            <>
              <InterviewFlowSection flow={linkedAgent?.interview_flow ?? null} />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                {linkedAgent?.interview_flow
                  ? t('aiagent.flowSource.fromAgent', { agent: linkedAgent?.name ?? v.aiAgentName ?? '' })
                  : t('aiagent.flowSource.agentHasNoFlow')}
              </p>
              {v.contractTypes.length === 0 && (
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('aiagent.flowSource.noContractType')}
                </p>
              )}
            </>
          )
        ) : (
          <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
            {t('aiagent.flowHint')}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
}

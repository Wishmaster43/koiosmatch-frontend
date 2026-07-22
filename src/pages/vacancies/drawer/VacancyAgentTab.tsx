import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { InterviewFlowSection } from '@/components/ai/management/InterviewFlowSection'
import api, { unwrap } from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { BTN_H } from '@/config/buttonMetrics'
import { useAiAgents } from '../hooks/useAiAgents'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

const groupTitle: CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }
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
  // the same shape as the toast body, e.g. "2 geen WhatsApp-toestemming, 1 loopt al".
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
      <button type="button" onClick={() => setConfirmOpen(true)} disabled={busy || unavailable}
        style={{ alignSelf: 'flex-start', height: BTN_H, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
          border: '1px solid var(--color-primary)', background: 'none', color: 'var(--color-primary)',
          cursor: busy || unavailable ? 'not-allowed' : 'pointer', opacity: busy || unavailable ? 0.6 : 1 }}>
        {t('aiagent.backfill.button')}
      </button>
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

  const currentId = v.aiAgentId != null ? String(v.aiAgentId) : ''
  const linkedAgent = currentId ? agents.find(a => String(a.id) === currentId) : undefined

  // Picking (or clearing to '') persists immediately — null unlinks (VAC-AGENT-1:
  // no separate flow field, the agent carries its own).
  const pickAgent = (id: string) => {
    const picked = agents.find(a => String(a.id) === id)
    onUpdate?.(v.id, { aiAgentId: id || null, aiAgentName: id ? (picked?.name ?? v.aiAgentName) : '' })
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Picker card — error state falls back to plain read-only text + notice, so the
          currently-linked agent stays visible even when the fresh list fails to load. */}
      <div>
        <div style={groupTitle}>{t('aiagent.pickerLabel')}</div>
        <div style={{ ...blockStyle, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {error ? (
            <>
              <span style={{ fontSize: 12, color: v.aiAgentName ? 'var(--text)' : 'var(--text-muted)' }}>{v.aiAgentName || t('aiagent.none')}</span>
              <span style={{ fontSize: 11, color: 'var(--color-danger)' }}>{t('aiagent.loadError')}</span>
            </>
          ) : (
            <>
              <CreatableSelect
                value={currentId || null}
                onChange={pickAgent}
                allowCreate={false}
                placeholder={loading ? t('common:loading') : t('aiagent.placeholder')}
                options={selectOptions}
              />
              {!loading && options.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('aiagent.empty')}</span>
              )}
            </>
          )}
          {/* Calm, honest note — per-candidate interview PROGRESS lives on the
              application, this tab only ever shows the interview's setup (§3). */}
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{t('aiagent.explanation')}</p>
        </div>
      </div>

      {/* Interview flow the linked agent carries — read-only, shared component. */}
      <div>
        <div style={groupTitle}>{t('aiagent.flowTitle')}</div>
        {currentId ? (
          loading ? (
            <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
          ) : (
            <InterviewFlowSection flow={linkedAgent?.interview_flow ?? null} />
          )
        ) : (
          <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
            {t('aiagent.flowHint')}
          </div>
        )}
      </div>

      {/* INTERVIEW-BACKFILL-1: only meaningful once an agent is actually linked —
          picks up applicants this vacancy already had, not just future ones. */}
      {currentId && (
        <div>
          <div style={groupTitle}>{t('aiagent.backfill.title')}</div>
          <BackfillInterviewsAction vacancyId={v.id} applicationsCount={v.applicationsCount} />
        </div>
      )}
    </div>
  )
}

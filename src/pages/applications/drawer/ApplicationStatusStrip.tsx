import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, RefreshCw, Save, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useDateFormat } from '@/lib/datetime'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import { humanizeInterviewStatus } from './InterviewStatusCard'
import type { ApplicationDetail } from '@/types/application'

// One label-above cell in the strip; every cell renders something calm even
// when its own data is missing (§0.3, four UI states — never a blank cell).
// Canon (05-08): label 11px muted, value 12px (candidate FieldRow convention).
function Cell({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{children}</div>
    </div>
  )
}

const mutedItalic: CSSProperties = { color: 'var(--text-muted)', fontStyle: 'italic' }
const mutedLine: CSSProperties = { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }
// Ghost icon-only trigger (mirrors GeocodeButton's 'ghost' variant, §3A reuse —
// the one subtle refresh-style affordance shape, never a bespoke button per page).
const recalcBtn = (busy: boolean): CSSProperties => ({
  background: 'none', border: 'none', padding: 2, display: 'flex',
  color: 'var(--text-muted)', opacity: busy ? 0.5 : 0.8, cursor: busy ? 'not-allowed' : 'pointer',
})

// MATCHSCORE-EDIT-1: the manual-override save/cancel pair — same shape as
// EditableFieldTable's own icon buttons (§3A in-place edit convention), scaled
// down (20px vs 26px) to fit this compact status-strip cell.
const scoreIconBtn = (disabled: boolean): CSSProperties => ({
  width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
})
// House field footprint for a short numeric input (mirrors RadiusMapPanel's km field).
const scoreInput: CSSProperties = {
  width: 46, padding: '3px 6px', fontSize: 12, borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--hover-bg)', color: 'var(--text)', outline: 'none',
}

// Whole days between an ISO date and now; null when the date is missing/unparseable.
function daysSince(iso: string | undefined, now: Date = new Date()): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000))
}

// Same score-colour thresholds as MatchScoreBlock (green ≥75, amber ≥50, red below)
// — read from there rather than re-invented so the two surfaces never drift apart.
const scoreColor = (v?: number | null): string => {
  const n = v ?? 0
  return n >= 75 ? 'var(--color-success)' : n >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
}

// The first FUTURE appointment (server order not guaranteed) — a past one is
// stale information, so it never wins over an upcoming one. A plain helper
// (not inline in the component body) keeps the Date.now() read out of render
// per the react-hooks purity rule; `now` is injectable for deterministic tests.
type Appointment = ApplicationDetail['appointments'][number]
function nextFutureAppointment(appointments: Appointment[], now: number = Date.now()): Appointment | undefined {
  return appointments
    .filter(ap => ap.when && new Date(ap.when).getTime() > now)
    .sort((x, y) => new Date(x.when).getTime() - new Date(y.when).getTime())[0]
}

interface ApplicationStatusStripProps {
  application: ApplicationDetail
  // S2/S3: jump the drawer to its OWN "appointments"/"interviews" tab. Not the
  // EntityLink pattern (that deep-links to a DIFFERENT entity's own page) —
  // appointments/interviews have no page of their own, they are tabs of THIS
  // same drawer, so there is nowhere to "open in a new tab" to; a plain
  // clickable link-styled text that switches tabs is the honest equivalent.
  onNavigateTab?: (id: string) => void
}

// A clickable, EntityLink-styled piece of text that switches the drawer's own
// active tab (no separate page to deep-link to, see the prop comment above).
function TabLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', textAlign: 'left',
        color: 'var(--color-primary-text)', cursor: 'pointer', textDecoration: 'none' }}
      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
      {children}
    </button>
  )
}

/**
 * ApplicationStatusStrip — a calm at-a-glance strip (Danny 25-07: "ik wil zoveel
 * mogelijk relevante informatie kunnen zien") with four cells: phase, match score,
 * next appointment and interview progress. Every cell honest-gates on its own data
 * and shows a muted italic fallback rather than a blank cell.
 *
 * W29 (verified live: POST /applications/{id}/score exists, ApplicationController::
 * score): the match-score cell carries a self-contained recalculate trigger that
 * (re)runs the deterministic scoring engine and renders the fresh percentage from
 * the response — no separate wiring needed from the drawer/page layer above.
 *
 * MATCHSCORE-EDIT-1 (verified live: UpdateApplicationRequest accepts
 * match_score 0-100): the same cell also carries a self-contained manual-override
 * pencil (PATCH /applications/{id} { match_score }), restoring the editing path
 * Danny reported lost. AI-Act (§AI-ACT-1): the score is AI-generated unless the
 * backend's own match_score_source says 'manual' — the manual note then replaces
 * the AI label, never both, mirroring components/match/MatchScoreBlock's identical
 * disclosure so the two surfaces never contradict each other.
 */
export default function ApplicationStatusStrip({ application: a, onNavigateTab }: ApplicationStatusStripProps) {
  const { t } = useTranslation(['applications', 'common'])
  const { formatDate, formatDateTime } = useDateFormat()
  // RAW-KEY-1: flow-authored status first through i18n (the three markers the
  // engine itself sets), else humanized — never the raw SCREAMING_SNAKE value.
  const interviewStatusLabel = (iv: NonNullable<ApplicationDetail['interview']>) => {
    const raw = iv.currentStatus
    if (!raw) return t(`interview.category.${iv.category}`)
    return t(`interview.currentStatus.${raw}`, { defaultValue: humanizeInterviewStatus(raw) })
  }
  // W29: gated on the same permission the POST /applications/{id}/score route
  // requires (applications.update) — self-contained like InterviewStatusCard's
  // own auth gate, hidden entirely (not disabled) for a user who may not trigger it.
  const auth = useAuth()
  const canManage = auth?.hasPermission?.('applications.update') ?? false
  const [recalculating, setRecalculating] = useState(false)
  // MATCHSCORE-EDIT-1: the freshest locally-known score, once either the
  // recalculate POST or the manual-override PATCH resolves — null until then.
  // Bundles score + provenance together so the two never drift apart (a score
  // without knowing whether it is AI or manual is not enough to render honestly).
  const [override, setOverride] = useState<{ score: number | null; source: string; aiScore: number | null } | null>(null)
  // Manual-edit UI state — a house pencil→number-input→save/✕ cycle, mirroring
  // EditableFieldTable's own in-place edit pattern (§3A) but self-contained here
  // (no drawer/page wiring, same shape as the recalculate trigger next to it).
  const [editingScore, setEditingScore] = useState(false)
  const [draftScore, setDraftScore] = useState('')
  const [savingScore, setSavingScore] = useState(false)

  // Alive guard, re-armed in SETUP (§9: StrictMode's double mount leaves a
  // cleanup-only ref permanently false and silently kills a later setState).
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  // A fresh prop (the drawer's own refetch, or a manual override saved elsewhere
  // on this same application) is the newer truth and must not be shadowed by a
  // stale local override (mirrors InterviewStatusCard's own guard).
  useEffect(() => { setOverride(null) }, [a.score, a.matchSource, a.aiScore])

  const score = override?.score ?? a.score
  const scoreSource = override?.source ?? a.matchSource ?? 'ai'
  const aiScoreValue = override?.aiScore ?? a.aiScore ?? null

  // POST /applications/{id}/score — (re)runs the deterministic scoring engine
  // server-side and returns the full detail. The engine treats a manual override
  // as sacred (ScoringEngine::score): it only refreshes ai_match_score and never
  // overwrites an already-manual match_score, so the response's own provenance
  // is read back rather than assumed — recalculating a manual score keeps it
  // manual, exactly like the backend does.
  const recalculateScore = async () => {
    if (recalculating || a.id == null) return
    setRecalculating(true)
    try {
      const res = await api.post(`/applications/${a.id}/score`)
      const body = unwrap<{ match_score?: number | null; match_score_source?: string; ai_match_score?: number | null }>(res)
      if (!alive.current) return
      setOverride({ score: body?.match_score ?? null, source: body?.match_score_source ?? 'ai', aiScore: body?.ai_match_score ?? null })
      notifySuccess(t('status.recalculateDone'))
    } catch (err) {
      if (alive.current) notifyError(extractApiError(err, t('common:actionFailed')))
    } finally {
      if (alive.current) setRecalculating(false)
    }
  }

  // Client-side UX guard only (§7 — the server is the source of truth):
  // an integer 0-100, same range the backend's UpdateApplicationRequest enforces.
  const draftScoreValid = draftScore !== '' && Number.isInteger(Number(draftScore))
    && Number(draftScore) >= 0 && Number(draftScore) <= 100

  const startEditScore = () => { setDraftScore(score != null ? String(score) : ''); setEditingScore(true) }
  const cancelEditScore = () => setEditingScore(false)

  // PATCH /applications/{id} { match_score } — the manual override
  // (UpdateApplicationRequest: 'match_score' => ['sometimes','integer','between:0,100']).
  // Its mere presence stamps match_score_source = 'manual' server-side, so the
  // AI-generated label is never shown again for this score until it is recalculated
  // (and even then only if the engine actually replaces it — see recalculateScore).
  const saveScore = async () => {
    if (!draftScoreValid || savingScore || a.id == null) return
    const value = Number(draftScore)
    setSavingScore(true)
    try {
      const res = await api.patch(`/applications/${a.id}`, { match_score: value })
      const body = unwrap<{ match_score?: number | null; match_score_source?: string; ai_match_score?: number | null }>(res)
      if (!alive.current) return
      setOverride({ score: body?.match_score ?? value, source: body?.match_score_source ?? 'manual', aiScore: body?.ai_match_score ?? aiScoreValue })
      setEditingScore(false)
      notifySuccess(t('status.scoreSaved'))
    } catch (err) {
      if (alive.current) notifyError(extractApiError(err, t('common:actionFailed')))
    } finally {
      if (alive.current) setSavingScore(false)
    }
  }

  // APP-STAGE-DURATIONS-1 (landed): the CURRENT stage's real entry timestamp,
  // read off the chronological stage_durations array (leftAt === null marks
  // the stage the application is in right now). Falls back to the list
  // contract's own current_stage_entered_at when the richer array is empty
  // (e.g. the drawer hasn't loaded the full detail yet), then to the
  // created-date "in process" line, then an honest "unknown" — never claims
  // days-since-created IS days-in-phase (that conflation was the old bug).
  const currentStage = a.stageDurations?.find(s => s.leftAt === null)
  const phaseEnteredAt = currentStage?.enteredAt ?? a.currentStageEnteredAt ?? null
  const daysInPhase = currentStage?.days ?? daysSince(phaseEnteredAt ?? undefined)
  const daysInProcess = daysSince(a.created)
  const nextAppointment = nextFutureAppointment(a.appointments ?? [])

  return (
    <SectionCard title={t('status.title')}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
        {/* Phase — soft chip + the TRUE time in this phase when stage_durations
            (or its list-contract fallback timestamp) is available; only falls
            back to the "in process" since-created line when neither exists —
            the two must never be conflated (APP-STAGE-DURATIONS-1). */}
        <Cell label={t('status.phase')}>
          <SoftChip label={a.phaseLabel ?? a.phaseKey ?? '—'} color={a.phaseColor} />
          {phaseEnteredAt != null ? (
            <>
              <div style={mutedLine}>{t('status.inPhase', { days: daysInPhase ?? 0, phase: a.phaseLabel ?? a.phaseKey ?? '' })}</div>
              <div style={mutedLine}>{t('status.phaseSince', { date: formatDate(phaseEnteredAt) })}</div>
            </>
          ) : daysInProcess !== null ? (
            <div style={mutedLine}>{`${t('status.inProcess')} · ${t('status.days', { count: daysInProcess })}`}</div>
          ) : (
            <div style={mutedLine}>{t('status.phaseUnknown')}</div>
          )}
        </Cell>

        {/* Match score — same thresholds/colours as MatchScoreBlock. W29: a
            subtle recalculate trigger sits next to the value/placeholder alike,
            so a never-scored application can still be scored from here.
            MATCHSCORE-EDIT-1: a pencil restores the manual override Danny
            reported missing ("ik kan de match score niet meer aanpassen") —
            a house pencil → number-input → save/✕ cycle, self-contained like
            the recalculate trigger next to it (no drawer/page wiring needed). */}
        <Cell label={t('status.matchScore')}>
          {editingScore ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="number" min={0} max={100} step={1} value={draftScore} disabled={savingScore}
                onChange={e => setDraftScore(e.target.value)} aria-label={t('status.matchScore')}
                autoFocus style={scoreInput} />
              <button type="button" onClick={saveScore} disabled={!draftScoreValid || savingScore}
                title={t('matchScore.save')} aria-label={t('matchScore.save')}
                style={{ ...scoreIconBtn(!draftScoreValid || savingScore), border: 'none', background: 'var(--color-primary)', color: 'var(--color-on-accent)' }}>
                <Save size={11} />
              </button>
              <button type="button" onClick={cancelEditScore} disabled={savingScore}
                title={t('matchScore.cancel')} aria-label={t('matchScore.cancel')}
                style={{ ...scoreIconBtn(savingScore), border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)' }}>
                <X size={11} />
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {score != null
                  ? <span style={{ fontWeight: 600, color: scoreColor(score) }}>{score}%</span>
                  : <span style={mutedItalic}>{t('status.notScored')}</span>}
                {canManage && (
                  <button type="button" onClick={startEditScore}
                    title={t('status.editScore')} aria-label={t('status.editScore')}
                    style={recalcBtn(false)}>
                    <Pencil size={12} />
                  </button>
                )}
                {canManage && (
                  <button type="button" onClick={recalculateScore} disabled={recalculating}
                    title={t('status.recalculateScore')} aria-label={t('status.recalculateScore')}
                    style={recalcBtn(recalculating)}>
                    <RefreshCw size={12} className={recalculating ? 'animate-spin' : ''} />
                  </button>
                )}
              </div>
              {/* AI-ACT-1: a manual override must never keep wearing the AI-generated
                  badge. Same i18n key + shape as MatchScoreBlock's own manualNote so
                  the two surfaces read identically and never drift apart. */}
              {scoreSource === 'manual' && (
                <div style={mutedLine}>{t('matchScore.manualNote', { score: aiScoreValue ?? '—' })}</div>
              )}
            </>
          )}
        </Cell>

        {/* Next appointment — the first upcoming one, owner on a muted second
            line. S2: clickable when a drawer tab-switch is wired AND there is
            something to jump to — a "no appointment" line has nothing to open. */}
        <Cell label={t('status.nextAppointment')}>
          {nextAppointment ? (
            <>
              <div>
                {onNavigateTab ? (
                  <TabLink onClick={() => onNavigateTab('appointments')}>
                    {(nextAppointment.title || nextAppointment.type) ?? '—'} · {formatDateTime(nextAppointment.when)}
                  </TabLink>
                ) : (
                  <>{(nextAppointment.title || nextAppointment.type) ?? '—'} · {formatDateTime(nextAppointment.when)}</>
                )}
              </div>
              {nextAppointment.with && <div style={mutedLine}>{nextAppointment.with}</div>}
            </>
          ) : (
            <span style={mutedItalic}>{t('status.noAppointment')}</span>
          )}
        </Cell>

        {/* Interview — current status + step progress when a session exists.
            S3: same tab-switch pattern as the appointment cell above.
            RAW-KEY-1 (Danny 08-08, live: "ACTIVE_IN_CARE" on screen): `currentStatus`
            is a flow-authored SCREAMING_SNAKE value, never a fixed enum — run it
            through the same i18n-then-humanize path InterviewStatusCard uses, so a
            tenant's own step name reads as prose and never as a raw constant. */}
        <Cell label={t('status.interview')}>
          {a.interview ? (
            <>
              <div>
                {onNavigateTab ? (
                  <TabLink onClick={() => onNavigateTab('interviews')}>
                    {interviewStatusLabel(a.interview)}
                  </TabLink>
                ) : (
                  interviewStatusLabel(a.interview)
                )}
              </div>
              {a.interview.step != null && a.interview.total > 0 && (
                <div style={mutedLine}>{t('interview.stepOf', { step: a.interview.step, total: a.interview.total })}</div>
              )}
            </>
          ) : (
            <span style={mutedItalic}>{t('status.noInterview')}</span>
          )}
        </Cell>
      </div>
    </SectionCard>
  )
}

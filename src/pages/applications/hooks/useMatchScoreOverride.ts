/**
 * useMatchScoreOverride — MATCHSCORE-EDIT-1 + W29 self-contained score actions,
 * extracted verbatim from the retired ApplicationStatusStrip match-score cell
 * (Danny 21-08 ruling 1: the strip's score cell is gone because it duplicated
 * the Match score block below, but its two affordances must not silently die,
 * §3 no lost affordance). Owns the manual-override PATCH
 * (UpdateApplicationRequest: match_score 0-100) and the recalculate POST
 * (ApplicationController::score, the deterministic scoring engine) — both
 * self-contained, no drawer/page wiring needed. Consumed by MatchScoreSection's
 * own title row. A fresher `application` prop (a drawer refetch, or an override
 * saved elsewhere via MatchScoreBlock's own criteria-slider edit) always wins
 * over a locally-known override, exactly like the original cell.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { ApplicationDetail } from '@/types/application'

// The slice of ApplicationDetail this hook actually needs — keeps the hook
// testable without a full fixture.
type ScoreCarrier = Pick<ApplicationDetail, 'id' | 'score' | 'matchSource' | 'aiScore'>

export interface MatchScoreOverride {
  score: number | null
  scoreSource: string
  aiScoreValue: number | null
  recalculating: boolean
  recalculateScore: () => void
  editingScore: boolean
  draftScore: string
  setDraftScore: (v: string) => void
  draftScoreValid: boolean
  startEditScore: () => void
  cancelEditScore: () => void
  saveScore: () => void
  savingScore: boolean
}

// Owns the match-score recalculate + manual-override editing state for one application.
export function useMatchScoreOverride(application: ScoreCarrier): MatchScoreOverride {
  const { t } = useTranslation(['applications', 'common'])
  const [recalculating, setRecalculating] = useState(false)
  // MATCHSCORE-EDIT-1: bundles score + provenance together so the two never
  // drift apart (a score without knowing whether it is AI or manual is not
  // enough to render honestly).
  const [override, setOverride] = useState<{ score: number | null; source: string; aiScore: number | null } | null>(null)
  // Manual-edit UI state — a house pencil→number-input→save/✕ cycle.
  const [editingScore, setEditingScore] = useState(false)
  const [draftScore, setDraftScore] = useState('')
  const [savingScore, setSavingScore] = useState(false)

  // Alive guard, re-armed in SETUP (§9: StrictMode's double mount leaves a
  // cleanup-only ref permanently false and silently kills a later setState).
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  // A fresh prop (the drawer's own refetch, or a manual override saved elsewhere
  // on this same application, e.g. via MatchScoreBlock's own criteria edit) is
  // the newer truth and must not be shadowed by a stale local override.
  useEffect(() => { setOverride(null) }, [application.score, application.matchSource, application.aiScore])

  const score = override?.score ?? application.score ?? null
  const scoreSource = override?.source ?? application.matchSource ?? 'ai'
  const aiScoreValue = override?.aiScore ?? application.aiScore ?? null

  // POST /applications/{id}/score — (re)runs the deterministic scoring engine
  // server-side and returns the full detail. The engine treats a manual override
  // as sacred (ScoringEngine::score): it only refreshes ai_match_score and never
  // overwrites an already-manual match_score, so the response's own provenance
  // is read back rather than assumed.
  const recalculateScore = async () => {
    if (recalculating || application.id == null) return
    setRecalculating(true)
    try {
      const res = await api.post(`/applications/${application.id}/score`)
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
  // Its mere presence stamps match_score_source = 'manual' server-side.
  const saveScore = async () => {
    if (!draftScoreValid || savingScore || application.id == null) return
    const value = Number(draftScore)
    setSavingScore(true)
    try {
      const res = await api.patch(`/applications/${application.id}`, { match_score: value })
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

  return {
    score, scoreSource, aiScoreValue, recalculating, recalculateScore,
    editingScore, draftScore, setDraftScore, draftScoreValid,
    startEditScore, cancelEditScore, saveScore, savingScore,
  }
}

// Promoted from pages/applications/drawer (23-07): the match-explorer tabs reuse
// the same score ring + criteria breakdown — one shared source (§3A).
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Pencil, Save, X } from 'lucide-react'
import Slider from '@/components/ui/Slider'
import AiGeneratedLabel from '@/components/ui/AiGeneratedLabel'
import Button from '@/components/ui/Button'
import { tint } from '@/lib/tint'
import { BodyText, SectionTitle, Caption } from '@/components/ui/typography'

export interface Criterion { key?: string; label?: string; hard?: boolean; score: number; weight?: number; note?: string }

// The ONE score-colour source lives in ./scoreColor (react-refresh: this file
// exports only components).
import { scoreColor } from './scoreColor'

// Weighted overall from the criteria (falls back to a plain average, or the
// explicit overall when there are no criteria).
const computeOverall = (criteria: Criterion[], fallback: number | null): number | null => {
  if (!criteria.length) return fallback
  const wsum = criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0)
  if (!wsum) return Math.round(criteria.reduce((s, c) => s + (Number(c.score) || 0), 0) / criteria.length)
  return Math.round(criteria.reduce((s, c) => s + (Number(c.score) || 0) * (Number(c.weight) || 0), 0) / wsum)
}

// A small circular score ring (read mode).
function ScoreRing({ value, size = 26 }: { value: number; size?: number }) {
  const c = scoreColor(value)
  const r = size / 2 - 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {/* F7 follow-up (audit R1): `c` is always one of the three --color-* tokens
          from scoreColor(), never data-hex, so `c + '33'` was the same broken
          hex-concat-on-token defect the board's count badge had (`var(--…)33` is
          not a valid CSS colour) — color-mix works for both hex and tokens. */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tint(c, 20)} strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${circ * value / 100} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  )
}

// Weight indicator — filled dots out of 5 (the criterion's configured weight).
function WeightDots({ weight, title }: { weight: number; title: string }) {
  const n = Math.max(0, Math.min(5, Math.round(weight)))
  return (
    <span title={`${title} ${n}/5`} aria-label={`${title} ${n}/5`} style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i < n ? 'var(--text-muted)' : 'var(--border)' }} />
      ))}
    </span>
  )
}

// One criterion: read = label + weight + ring + % + note; edit = label + weight + slider + %.
function CriterionCard({ criterion, hardLabel, hardHint, weightTitle, editing, onScore }: { criterion: Criterion; hardLabel: string; hardHint: string; weightTitle: string; editing: boolean; onScore: (v: number) => void }) {
  const [open, setOpen] = useState(false)

  if (editing) {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <SectionTitle as="span" style={{ flex: 1 }}>{criterion.label}</SectionTitle>
          {criterion.hard && (
            // Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1
            // on its own pastel, AA fail (Opus r3.5).
            <span title={hardHint} aria-label={`${hardLabel}: ${hardHint}`} style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, cursor: 'help',
              background: 'var(--color-danger-bg)', color: 'var(--color-on-danger-bg)' }}>{hardLabel}</span>
          )}
          {criterion.weight != null && <WeightDots weight={criterion.weight} title={weightTitle} />}
          {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- DATA-coloured score value (scoreColor), not a title */}
          <span style={{ fontSize: 13, fontWeight: 600, color: scoreColor(criterion.score), minWidth: 36, textAlign: 'right' }}>{criterion.score}%</span>
        </div>
        <Slider value={criterion.score} max={100} step={5} onChange={onScore} color={scoreColor(criterion.score)} ariaLabel={criterion.label} />
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)' }}>
        {/* Pre-existing bespoke flex-1 row-toggle (structural, not an action button)
            and chevron affordance below, out of this ink/tint task's scope. */}
        <button onClick={() => setOpen(o => !o)}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <SectionTitle as="span">{criterion.label}</SectionTitle>
        </button>
        {criterion.hard && (
          // Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1
          // on its own pastel, AA fail (Opus r3.5).
          <span title={hardHint} aria-label={`${hardLabel}: ${hardHint}`} style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, cursor: 'help',
            background: 'var(--color-danger-bg)', color: 'var(--color-on-danger-bg)' }}>{hardLabel}</span>
        )}
        {criterion.weight != null && <WeightDots weight={criterion.weight} title={weightTitle} />}
        <ScoreRing value={criterion.score} />
        {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- DATA-coloured score value (scoreColor), not a title */}
          <span style={{ fontSize: 13, fontWeight: 600, color: scoreColor(criterion.score), minWidth: 36, textAlign: 'right' }}>{criterion.score}%</span>
        {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above */}
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
          {open ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
        </button>
      </div>
      {open && criterion.note && (
        <div style={{ padding: '10px 12px', background: 'var(--bg)', borderTop: '1px solid var(--border)',
          fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55 }}>{criterion.note}</div>
      )}
    </div>
  )
}

interface MatchScoreBlockProps {
  score?: number | null
  criteria?: Criterion[]
  summary?: string
  onSave?: (payload: { score: number | null; criteria: Criterion[] }) => void
  source?: string
  aiScore?: number | null
  // V17 (Danny 25-07): the plain overall %+bar is a DUPLICATE of
  // ApplicationStatusStrip's own match-score cell on the Sollicitatie tab —
  // default true keeps every OTHER caller (VacancySearchTab, CandidateSearchTab)
  // unchanged; only ApplicationTab passes false, since the strip cell already
  // shows that number. The edit affordance (pencil/save/✕) and, once editing,
  // the full slider UI still render regardless — only the passive %+bar readout
  // is suppressed, so adjusting the score is never lost.
  showOverall?: boolean
}

/**
 * MatchScoreBlock — the match SCORE (the fit): summary, overall bar and the
 * per-criterion breakdown. Criteria + weights are configured in Settings (the
 * per-vacancy sliders); the recruiter can ADJUST the per-applicant scores here
 * via sliders (a manual override), saved through onSave → PATCH /applications/{id}.
 * The AI's own score (aiScore) is kept and shown when overridden.
 */
export default function MatchScoreBlock({ score, criteria = [], summary, onSave, source, aiScore, showOverall = true }: MatchScoreBlockProps) {
  const { t } = useTranslation(['applications', 'common'])
  const [editing, setEditing]   = useState(false)
  const [draftScore, setDraftScore]       = useState(0)
  const [draftCriteria, setDraftCriteria] = useState<Criterion[]>([])

  const startEdit = () => { setDraftScore(score ?? 0); setDraftCriteria(criteria.map(c => ({ ...c }))); setEditing(true) }
  const cancel = () => setEditing(false)
  const setCriterionScore = (i: number, v: number) => setDraftCriteria(p => p.map((c, idx) => idx === i ? { ...c, score: Math.max(0, Math.min(100, Number(v) || 0)) } : c))

  const overall = editing
    ? computeOverall(draftCriteria, Math.max(0, Math.min(100, Number(draftScore) || 0)))
    : (score ?? null)

  const save = () => { onSave?.({ score: overall, criteria: draftCriteria }); setEditing(false) }

  if (overall == null && !editing) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('matchScore.detailsSoon')}</p>
  }

  const shownCriteria = editing ? draftCriteria : criteria

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* AI-Act disclosure (AI-ACT-1): the score/criteria/summary below are
          Koios AI output unless a human already overrode them (source ===
          'manual') — hidden mid-edit since the recruiter is about to become
          the source themselves. */}
      {!editing && source !== 'manual' && <AiGeneratedLabel />}

      {summary && !editing && <BodyText style={{ lineHeight: 1.55 }}>{summary}</BodyText>}

      {/* Overall + edit controls */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('matchScore.overall')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(showOverall || editing) && <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(overall) }}>{overall}%</span>}
            {onSave && (editing ? (
              <>
                <Button variant="primary" size="sm" onClick={save} title={t('matchScore.save')} style={{ width: 26 }}><Save size={13} /></Button>
                {/* Pre-existing bespoke 26x26 cancel/edit controls (bg/ink combo not
                    covered by a Button variant), out of this ink/tint task's scope. */}
                {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- see comment above */}
                <button onClick={cancel} title={t('matchScore.cancel')} aria-label={t('matchScore.cancel')} style={{ display: 'flex', width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}><X size={13} /></button>
              </>
            ) : (
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- pre-existing bespoke 26x26 edit control (bg/ink combo not covered by a Button variant), out of this ink/tint task's scope
              <button onClick={startEdit} title={t('matchScore.edit')} aria-label={t('matchScore.edit')} style={{ display: 'flex', width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}><Pencil size={12} /></button>
            ))}
          </span>
        </div>
        {(showOverall || editing) && (
          <div style={{ height: 8, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ width: `${overall ?? 0}%`, height: '100%', background: scoreColor(overall ?? 0) }} />
          </div>
        )}
        {/* Overall slider when there are no criteria to derive from. */}
        {editing && shownCriteria.length === 0 && (
          <div style={{ marginTop: 8 }}>
            <Slider value={draftScore} max={100} step={5} onChange={setDraftScore} color={scoreColor(overall ?? 0)} ariaLabel={t('matchScore.overall')} />
          </div>
        )}
        {/* Manual-override marker (keeps the AI's own score visible). */}
        {!editing && source === 'manual' && (
          <Caption as="div" style={{ marginTop: 6 }}>{t('matchScore.manualNote', { score: aiScore ?? '—' })}</Caption>
        )}
      </div>

      {/* Criteria breakdown */}
      {shownCriteria.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shownCriteria.map((c, i) => (
            <CriterionCard key={c.key ?? i} criterion={c} hardLabel={t('matchScore.hard')} hardHint={t('matchScore.hardHint')} weightTitle={t('matchScore.weightLabel')}
              editing={editing} onScore={v => setCriterionScore(i, v)} />
          ))}
          {/* S10/S28 (Danny 02-09 "Nu A"): the dots never explained themselves — one
              persistent legend line, not only a hover title. */}
          {shownCriteria.some(c => c.weight != null) && (
            <Caption as="div">{t('matchScore.weightLegend')}</Caption>
          )}
        </div>
      )}
    </div>
  )
}

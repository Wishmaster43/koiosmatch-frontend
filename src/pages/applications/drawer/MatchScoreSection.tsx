/**
 * MatchScoreSection — the application drawer's ONE match-score surface: an
 * overall bar, the per-criterion breakdown, and the manual-override/recalculate
 * controls. See the fuller docblock below, right above the component, for the
 * history behind why those two affordances live here.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, RefreshCw, Save, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/ui/Button'
import CollapsedCard from '@/components/ui/CollapsedCard'
import MatchScoreBlock from '@/components/match/MatchScoreBlock'
import type { Criterion } from '@/components/match/MatchScoreBlock'
import { scoreColor } from '@/components/match/scoreColor'
import { sectionBlock } from '@/components/ui/SectionCard'
import { useMatchScoreOverride } from '../hooks/useMatchScoreOverride'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

// House field footprint for a short numeric input (mirrors RadiusMapPanel's km
// field) — moved here verbatim from the retired strip cell.
const scoreInput: CSSProperties = {
  width: 46, padding: '3px 6px', fontSize: 12, borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--hover-bg)', color: 'var(--text)', outline: 'none',
}

interface MatchScoreSectionProps {
  application: ApplicationDetail
  // DD-FE-9: the per-criterion score sliders live on MatchScoreBlock's OWN
  // edit mode. Undefined hides that affordance (read-only caller).
  onAdjustScore?: (id: Id | undefined, payload: { score: number | null; criteria: Criterion[] }) => void
}

/**
 * MatchScoreSection — Danny 21-08 ruling 1 (translated: "I like the match score
 * with that bar, but having it up top too is a duplicate" — verbatim: "Match
 * score met die balk vind ik mooi maar bovenin is dubbel"): the status strip's
 * own match-score CELL is
 * retired; this titled card is now the ONE score surface on the tab. Its title
 * row carries the two affordances the retired cell used to own — the quick
 * manual-override pencil (MATCHSCORE-EDIT-1, PATCH /applications/{id}
 * { match_score }) and the recalculate trigger (W29, POST /applications/{id}/
 * score) — moved here VERBATIM (same requests, same applications.update gate,
 * via useMatchScoreOverride) so neither affordance is lost (§3 no lost
 * affordance). showOverall is back to true: V17's suppression only ever
 * existed to avoid duplicating the now-retired strip cell, so the bar Danny
 * liked in his screenshot renders here.
 *
 * COLLAPSE-1 (Danny 22-08, translated: "you must be able to expand and
 * collapse the match score, collapsed by default" — verbatim: "Match score
 * moet je kunnen openklappen en dichtklappen, standaard dichtgeklapt"): the
 * card now rides the shared
 * `components/ui/CollapsedCard` atom, default CLOSED (`defaultOpen` omitted).
 * The header keeps showing the section title AND the overall score (the
 * SAME scoreColor threshold MatchScoreBlock's own overall row uses) so a
 * collapsed card still tells you the number at a glance; the quick pencil/
 * recalculate pair rides CollapsedCard's `action` slot — a sibling of the
 * toggle button, always reachable regardless of open/closed state, never
 * lost behind a collapse (§3 no lost affordance, mirrors the FilterGroupBlock
 * header convention CollapsedCard's own doc comment cites). Only the FULL
 * detail — the bar, the criteria breakdown, the manual-override note —
 * mounts inside the collapsed body, exactly as it rendered before this move.
 *
 * MatchScoreBlock itself (components/match/, a shared cross-entity component,
 * out of this cluster's ownership) keeps its OWN separate criteria-slider edit
 * pencil unchanged — a second, finer-grained way to adjust the score via
 * onAdjustScore. Because both edit surfaces can be open in ONE card at once,
 * the quick pencil's Save/Cancel carry their OWN explicit labels
 * (matchScore.saveOverride/cancelOverride) — the verify round measured that
 * common:save and matchScore.save render the SAME string in all five locales,
 * so only distinct keys with distinct wording keep the two apart for a
 * screen-reader user.
 */
export default function MatchScoreSection({ application: a, onAdjustScore }: MatchScoreSectionProps) {
  const { t } = useTranslation(['applications', 'common'])
  const auth = useAuth()
  // Same permission the POST /applications/{id}/score + PATCH match_score
  // routes require (mirrors the retired cell's own gate).
  const canManage = auth?.hasPermission?.('applications.update') ?? false
  const o = useMatchScoreOverride(a)

  const action = canManage ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {o.editingScore ? (
        <>
          <input type="number" min={0} max={100} step={1} value={o.draftScore} disabled={o.savingScore}
            onChange={e => o.setDraftScore(e.target.value)} aria-label={t('status.matchScore')}
            autoFocus style={scoreInput} />
          <Button variant="primary" iconOnly size="sm" onClick={o.saveScore} disabled={!o.draftScoreValid || o.savingScore}
            title={t('matchScore.saveOverride')} aria-label={t('matchScore.saveOverride')}><Save size={13} /></Button>
          <Button variant="secondary" iconOnly size="sm" onClick={o.cancelEditScore} disabled={o.savingScore}
            title={t('matchScore.cancelOverride')} aria-label={t('matchScore.cancelOverride')}><X size={13} /></Button>
        </>
      ) : (
        <>
          <Button variant="ghost" iconOnly size="sm" onClick={o.startEditScore}
            title={t('status.editScore')} aria-label={t('status.editScore')}><Pencil size={13} /></Button>
          <Button variant="ghost" iconOnly size="sm" onClick={o.recalculateScore} disabled={o.recalculating}
            title={t('status.recalculateScore')} aria-label={t('status.recalculateScore')}>
            <RefreshCw size={13} className={o.recalculating ? 'animate-spin' : ''} />
          </Button>
        </>
      )}
    </div>
  ) : undefined

  // COLLAPSE-1: title + overall score, always visible in the header (part of
  // the toggle button's own label — plain text/number, never an interactive
  // element, so it is safe inside the button unlike the pencil/refresh pair).
  const title = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span>{t('matchScore.title')}</span>
      {o.score != null && (
        <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(o.score) }}>{o.score}%</span>
      )}
    </span>
  )

  return (
    <CollapsedCard title={title} filled={o.score != null} action={action}>
      {/* CollapsedCard's body is deliberately frameless ("children own their own
          box") — the card frame every sibling on this tab wears comes from
          sectionBlock, exactly what SectionCard used to provide here. */}
      <div style={sectionBlock}>
        <MatchScoreBlock score={o.score} criteria={a.matchCriteria as Criterion[]} summary={a.matchSummary}
          source={o.scoreSource} aiScore={o.aiScoreValue} showOverall
          onSave={onAdjustScore ? payload => onAdjustScore(a.id, payload) : undefined} />
      </div>
    </CollapsedCard>
  )
}

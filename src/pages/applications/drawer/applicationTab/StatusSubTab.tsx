import { useTranslation } from 'react-i18next'
import RejectionSummary from '../RejectionSummary'
import ApplicationStatusStrip from '../ApplicationStatusStrip'
import { sectionTitle } from '@/components/ui/SectionCard'
import MatchScoreBlock from '@/components/match/MatchScoreBlock'
import type { Criterion } from '@/components/match/MatchScoreBlock'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

interface StatusSubTabProps {
  application: ApplicationDetail
  // S2/S3: forwarded to ApplicationStatusStrip so its appointment/interview
  // cells can jump the drawer to its OWN "appointments"/"interviews" tabs.
  onNavigateTab?: (id: string) => void
  // DD-FE-9 (08-08 drill-down audit): the per-criterion score sliders live HERE
  // now, not on Context — adjusting must sit right where the score is read.
  // Undefined hides the edit affordance (read-only caller, mirrors onLinkVacancy).
  onAdjustScore?: (id: Id | undefined, payload: { score: number | null; criteria: Criterion[] }) => void
}

/**
 * StatusSubTab — APP-TAB-SPLIT-1 (Danny: "Dit eerste tabblad blijft te druk
 * dus wellicht sollicitatie en sub-tabjes?"), group (a): the rejection outcome
 * (if any) above the phase/appointment/interview/match-score strip, followed
 * by the match-score criteria breakdown (DD-FE-9, 08-08 drill-down audit:
 * moved from the Context sub-tab so adjusting the score sits directly under
 * reading it, on the FIRST screen). This is the ApplicationTab's DEFAULT sub-tab.
 */
export default function StatusSubTab({ application: a, onNavigateTab, onAdjustScore }: StatusSubTabProps) {
  const { t } = useTranslation(['applications', 'common'])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Rejection outcome — read-only; the reject FORM itself lives in a footer
          button + confirm modal (RejectionModal), opened from the drawer. */}
      <RejectionSummary application={a} />
      {/* Phase, next appointment, interview and match score at a glance; S2/S3
          cells jump to the drawer's own Afspraken/Interviews tabs. */}
      <ApplicationStatusStrip application={a} onNavigateTab={onNavigateTab} />

      {/* DD-FE-9: match score — criteria breakdown, directly under the score
          cell above so reading and adjusting sit on the same screen. V17: the
          plain overall %+bar would duplicate the strip's own score cell, so
          this call suppresses it (showOverall=false) while keeping the
          edit/save affordance and, once editing, the sliders. */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        {/* Canon (05-08): shared sectionTitle (11px muted uppercase), reused rather than a hand-rolled heading. */}
        <div style={{ ...sectionTitle, marginBottom: 12 }}>{t('matchScore.title')}</div>
        <MatchScoreBlock score={a.score} criteria={a.matchCriteria as Criterion[]} summary={a.matchSummary}
          source={a.matchSource} aiScore={a.aiScore} showOverall={false}
          onSave={onAdjustScore ? payload => onAdjustScore(a.id, payload) : undefined} />
      </div>
    </div>
  )
}

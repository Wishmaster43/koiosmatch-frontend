/**
 * StatusSubTab — APP-TAB-SPLIT-1, group (a): the rejection outcome (if any)
 * above the phase/appointment/interview strip. Danny 21-08 ruling 1: the
 * match-score criteria breakdown moved OUT of this group into its own
 * MatchScoreSection — ApplicationTab now composes that directly, after the CV
 * block (DRILLDOWN-VOLGORDE-CANON's information-cards-first order) — so this
 * sub-tab is purely the outcome + at-a-glance strip.
 */
import RejectionSummary from '../RejectionSummary'
import ApplicationStatusStrip from '../ApplicationStatusStrip'
import type { ApplicationDetail } from '@/types/application'

interface StatusSubTabProps {
  application: ApplicationDetail
  // S2/S3: forwarded to ApplicationStatusStrip so its appointment/interview
  // rows can jump the drawer to its OWN "appointments"/"interviews" tabs.
  onNavigateTab?: (id: string) => void
}

// Read-only outcome + at-a-glance strip (rejection summary, phase/appointment/interview); the match-score breakdown lives in its own sibling section (see file header).
export default function StatusSubTab({ application: a, onNavigateTab }: StatusSubTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Rejection outcome — read-only; the reject FORM itself lives in a footer
          button + confirm modal (RejectionModal), opened from the drawer. */}
      <RejectionSummary application={a} />
      {/* Phase, next appointment and interview at a glance; S2/S3 rows jump to
          the drawer's own Afspraken/Interviews tabs. */}
      <ApplicationStatusStrip application={a} onNavigateTab={onNavigateTab} />
    </div>
  )
}

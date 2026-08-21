import { useTranslation } from 'react-i18next'
import SharedBranchSection from '@/components/drawer/BranchSection'
import { useApplicationVacancy } from '../hooks/useApplicationVacancy'
import type { ApplicationDetail } from '@/types/application'

interface ApplicationBranchSectionProps {
  application: ApplicationDetail
}

/**
 * ApplicationBranchSection — DRILLDOWN-VOLGORDE-CANON (Danny 21-08): vestiging
 * is the LAST block on the tab. The Application model itself has no branch/
 * vestiging column (verified: ApplicationDetail carries no such field) — the
 * only derivable source is its LINKED VACANCY's own bureau branch
 * (VacancyDetail.branchName, SWEEP-VESTIGING), read via the SAME shared
 * useApplicationVacancy cache entry CompetitionBlock/ApplicationDetailsCard
 * already fetch on this tab, so this never fires a second request.
 *
 * Renders NOTHING when no vacancy is linked at all (§3 no fake affordance —
 * there is nothing to derive a branch from) or while that fetch is loading/
 * failed. Once a vacancy IS linked and resolved, this mirrors the match
 * drawer's own bottom block byte-for-byte (readOnly, the shared empty-state
 * label when the vacancy itself has no branch picked).
 */
export default function ApplicationBranchSection({ application: a }: ApplicationBranchSectionProps) {
  const { t } = useTranslation('candidates')
  const { vacancy, loading, error } = useApplicationVacancy(a.vacancyId)

  // No vacancy linked, or its detail hasn't resolved yet — nothing honest to show.
  if (a.vacancyId == null || loading || error) return null

  return (
    <SharedBranchSection readOnly label={t('matchesView.branch')} emptyLabel={t('sections.branchEmpty')}
      branches={vacancy?.branchName ? [{ name: vacancy.branchName }] : []} />
  )
}

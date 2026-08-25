/**
 * StatisticsTab — Danny 22-08 ("Andere sollicitanten moet hier weg... eigen
 * tabje statistieken bij sollicitatie drill down en daar verplaatsen", i.e.
 * "Other applicants must move out of here... its own statistics tab on the
 * application drill-down, and move it there"): CompetitionBlock (the
 * vacancy's other applicants — funnel chip breakdown + expandable list,
 * SOLLICITANTEN-2) moves OFF the Sollicitatie tab onto its own Statistieken
 * tab, positioned SECOND (right after the first tab) — mirrors MatchDrawer's
 * own statistics tab placement AND its "moved verbatim, unchanged behaviour"
 * precedent (pages/matches/drawer/StatisticsTab.tsx). No behaviour change
 * here: same component, same props, same shared useApplicationVacancy
 * fetch/cache CompetitionBlock already used.
 */
import CompetitionBlock from './CompetitionBlock'
import type { ApplicationDetail } from '@/types/application'

interface StatisticsTabProps {
  application: ApplicationDetail
}

export default function StatisticsTab({ application }: StatisticsTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <CompetitionBlock application={application} />
    </div>
  )
}

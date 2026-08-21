import StatusSubTab from './applicationTab/StatusSubTab'
import DetailsSubTab from './applicationTab/DetailsSubTab'
import CvSubTab from './applicationTab/CvSubTab'
import MatchScoreSection from './MatchScoreSection'
import CompetitionBlock from './CompetitionBlock'
import ContextSubTab from './applicationTab/ContextSubTab'
import ApplicationBranchSection from './ApplicationBranchSection'
import type { Criterion } from '@/components/match/MatchScoreBlock'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

interface ApplicationTabProps {
  application: ApplicationDetail
  onAdjustScore?: (id: Id | undefined, payload: { score: number | null; criteria: Criterion[] }) => void
  // Re-link (or unlink, null) the vacancy this application is coupled to (BE:
  // PATCH /applications/{id} vacancy_id, nullable). Klant is derived from the
  // picked option so the caller can update it optimistically before the PATCH
  // response reconciles it. Undefined hides the pencil (read-only caller).
  onLinkVacancy?: (id: Id | undefined, vacancyId: Id | null, meta?: { title?: string; client?: string }) => void
  // S7: PATCH the Bron field (PATCH /applications/{id} {source}) — shares the
  // Details block's edit mode/pencil with onLinkVacancy. Undefined hides the
  // pencil (read-only caller, mirrors onLinkVacancy).
  onUpdateSource?: (id: Id | undefined, source: string) => void
  // S2/S3: switch the drawer to another of ITS OWN tabs (Afspraken/Interviews) —
  // threaded down from ApplicationDrawer's EntityDrawer render callback. Undefined
  // (e.g. no drawer context) makes the strip's cells render as plain text.
  onNavigateTab?: (id: string) => void
}

/**
 * ApplicationTab — the "Sollicitatie" tab, ONE flat scroll (PDF-SOLLICITATIES
 * point 9, Danny 14-08: "Alle subtabjes onder Sollicitatie worden één
 * tabblad"). Danny 21-08 ("Heel deze tab is anders dan de kandidaten of
 * klant") — the block order now follows the same DRILLDOWN-VOLGORDE-CANON
 * every other entity drilldown uses: INFORMATION cards first (the outcome +
 * status strip, the editable details card, the CV blocks), then the Match
 * score block (ruling 1: the strip's own score cell is retired, this titled
 * card is the ONE score surface left), then Andere sollicitanten (ruling 3,
 * now an expandable list of the vacancy's other applicants), then the Koios
 * AI block (the motivation letter, interview-consent evidence and the
 * advisory itself), and finally VESTIGING LAST (ruling 4 — renders nothing
 * when the application has no linked vacancy to derive a branch from, see
 * ApplicationBranchSection's own doc comment). No behaviour change per
 * section beyond ruling 1/3 above — same props, same PATCH bodies.
 */
export default function ApplicationTab({ application: a, onAdjustScore, onLinkVacancy, onUpdateSource, onNavigateTab }: ApplicationTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <StatusSubTab application={a} onNavigateTab={onNavigateTab} />
      <DetailsSubTab application={a} onLinkVacancy={onLinkVacancy} onUpdateSource={onUpdateSource} />
      <CvSubTab application={a} />
      <MatchScoreSection application={a} onAdjustScore={onAdjustScore} />
      <CompetitionBlock application={a} />
      <ContextSubTab application={a} />
      <ApplicationBranchSection application={a} />
    </div>
  )
}

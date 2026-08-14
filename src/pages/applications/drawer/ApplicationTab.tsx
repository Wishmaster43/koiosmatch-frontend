import StatusSubTab from './applicationTab/StatusSubTab'
import DetailsSubTab from './applicationTab/DetailsSubTab'
import CvSubTab from './applicationTab/CvSubTab'
import ContextSubTab from './applicationTab/ContextSubTab'
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
 * tabblad" — reverses APP-TAB-SPLIT-1's four-sub-tab strip). Every section that
 * used to sit behind Status/Details/CV/Context now stacks in ONE column, in the
 * same relative order: outcome + status strip + match score, the editable
 * details card (source/client/location/vacancy — this is also where the
 * customer's establishment, "Vestiging", now reads without an extra click,
 * PDF point 10), the CV blocks, and finally the context blocks including the
 * Koios advisory (PDF point 11 — was buried on the last sub-tab, now visible
 * on first open). No behaviour change per section, only layout: same props,
 * same PATCH bodies.
 */
export default function ApplicationTab({ application: a, onAdjustScore, onLinkVacancy, onUpdateSource, onNavigateTab }: ApplicationTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <StatusSubTab application={a} onNavigateTab={onNavigateTab} onAdjustScore={onAdjustScore} />
      <DetailsSubTab application={a} onLinkVacancy={onLinkVacancy} onUpdateSource={onUpdateSource} />
      <CvSubTab application={a} />
      <ContextSubTab application={a} />
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SubTabBar from '@/components/drawer/SubTabBar'
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
 * ApplicationTab — the "Sollicitatie" tab, now a thin CONTAINER
 * (APP-TAB-SPLIT-1, Danny: "Dit eerste tabblad blijft te druk dus wellicht
 * sollicitatie en sub-tabjes?"). Mirrors VAC-DETAILS-SPLIT-1's shape exactly:
 * a SubTabBar strip over four small sub-tab components under applicationTab/,
 * each owning one contiguous slice of the original single-scroll tab — Status
 * (rejection outcome + phase/appointment/interview/score strip + the
 * match-score criteria breakdown, the DEFAULT — DD-FE-9, 08-08 drill-down
 * audit: the sliders now live directly under the score cell, not on Context),
 * Details (the editable Bron/Klant/Vacature card), CV (current CV + parser
 * proposal + sent-proposal history) and Context (competing applicants,
 * motivation letter, interview consent, Koios advisory). This is a pure
 * layout reorganisation: every affordance (edit pencils, links, the rejection
 * correction, the recalculate button) moved verbatim into its sub-tab, same
 * PATCH bodies — no behaviour change.
 */
export default function ApplicationTab({ application: a, onAdjustScore, onLinkVacancy, onUpdateSource, onNavigateTab }: ApplicationTabProps) {
  const { t } = useTranslation(['applications', 'common'])

  // Sub-tab strip — Status (default) / Details / CV / Context, the fixed
  // grouping agreed for this split (see the file docblock).
  const SUB_TABS = [
    { id: 'status', label: t('drawer.subTabs.status') },
    { id: 'details', label: t('drawer.subTabs.details') },
    { id: 'cv', label: t('drawer.subTabs.cv') },
    { id: 'context', label: t('drawer.subTabs.context') },
  ]
  const [subTab, setSubTab] = useState('status')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SubTabBar tabs={SUB_TABS} active={subTab} onChange={setSubTab} />
      {subTab === 'status' && <StatusSubTab application={a} onNavigateTab={onNavigateTab} onAdjustScore={onAdjustScore} />}
      {subTab === 'details' && <DetailsSubTab application={a} onLinkVacancy={onLinkVacancy} onUpdateSource={onUpdateSource} />}
      {subTab === 'cv' && <CvSubTab application={a} />}
      {subTab === 'context' && <ContextSubTab application={a} />}
    </div>
  )
}

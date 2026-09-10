/**
 * DetailsSubTab — APP-TAB-SPLIT-1, group (b): the editable Source/Customer/
 * Customer location/Department/Contact/Vacancy card, unchanged from the
 * original tab — same pencil/save/cancel, same PATCH bodies via
 * onLinkVacancy/onUpdateSource.
 */
import ApplicationDetailsCard, { type LinkVacancyFn, type UpdateSourceFn } from '../ApplicationDetailsCard'
import type { ApplicationDetail } from '@/types/application'

interface DetailsSubTabProps {
  application: ApplicationDetail
  // Forwarded verbatim to ApplicationDetailsCard, same PATCH bodies as before
  // (see ApplicationDetailsCard's own doc comment on each callback type).
  onLinkVacancy?: LinkVacancyFn
  onUpdateSource?: UpdateSourceFn
}

// Thin passthrough (see the module doc above): renders the unchanged editable card, forwarding the two PATCH callbacks as-is.
export default function DetailsSubTab({ application: a, onLinkVacancy, onUpdateSource }: DetailsSubTabProps) {
  return <ApplicationDetailsCard application={a} onLinkVacancy={onLinkVacancy} onUpdateSource={onUpdateSource} />
}

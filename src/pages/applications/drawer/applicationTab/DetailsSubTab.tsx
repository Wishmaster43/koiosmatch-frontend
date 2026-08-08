import ApplicationDetailsCard from '../ApplicationDetailsCard'
import type { ApplicationDetail } from '@/types/application'
import type { Id } from '@/types/common'

interface DetailsSubTabProps {
  application: ApplicationDetail
  // Re-link (or unlink, null) the vacancy this application is coupled to —
  // forwarded verbatim to ApplicationDetailsCard, same PATCH body as before.
  onLinkVacancy?: (id: Id | undefined, vacancyId: Id | null, meta?: { title?: string; client?: string }) => void
  // S7: PATCH the Bron field — shares ApplicationDetailsCard's own pencil/save/
  // cancel with onLinkVacancy.
  onUpdateSource?: (id: Id | undefined, source: string) => void
}

/**
 * DetailsSubTab — APP-TAB-SPLIT-1, group (b): the editable Bron/Klant/
 * Klantlocatie/Afdeling/Contactpersoon/Vacature card, unchanged from the
 * original tab — same pencil/save/cancel, same PATCH bodies via
 * onLinkVacancy/onUpdateSource.
 */
export default function DetailsSubTab({ application: a, onLinkVacancy, onUpdateSource }: DetailsSubTabProps) {
  return <ApplicationDetailsCard application={a} onLinkVacancy={onLinkVacancy} onUpdateSource={onUpdateSource} />
}

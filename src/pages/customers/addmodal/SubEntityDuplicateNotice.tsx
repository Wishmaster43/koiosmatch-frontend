/**
 * SubEntityDuplicateNotice — the ONE rendering of the live per-customer dedupe probe
 * (ADOPT-A2 row 81) for the location, department and contact create modals.
 * CLONE-BY-CONSTRUCTION-1: the three modals wired the same DuplicateNotice props from
 * the same guard, so the wiring lives here once; a modal only names its key prefix.
 */
import DuplicateNotice from '@/components/forms/DuplicateNotice'
import type { useSubEntityDuplicateGuard } from './useSubEntityDuplicateGuard'

type Guard = ReturnType<typeof useSubEntityDuplicateGuard>

// Which customers.* i18n prefix names the sub-entity in the notice copy.
type SubEntityKeyPrefix = 'locations' | 'departments' | 'contacts'

// Renders nothing until the guard holds a match; the affordances call the guard directly.
export default function SubEntityDuplicateNotice({ keyPrefix, dup }: { keyPrefix: SubEntityKeyPrefix; dup: Guard }) {
  const match = dup.notice
  if (!match) return null
  return (
    <DuplicateNotice ns="customers" keyPrefix={keyPrefix} match={match} variant="warning"
      canRestore={dup.canRestore} restoring={dup.restoring}
      onOpen={() => dup.openExisting(match.id)} onRestore={() => dup.restore(match.id)} onDismiss={dup.dismiss} />
  )
}

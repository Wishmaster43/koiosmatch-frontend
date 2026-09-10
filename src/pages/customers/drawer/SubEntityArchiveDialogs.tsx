/**
 * SubEntityArchiveDialogs — the shared `{dialog}` + InUseCountsDialog tail,
 * byte-identical in DepartmentDetail and LocationDetail (DRY round 11,
 * CUSTTABS2). ContactDetail carries no InUseCountsDialog wiring, so it stays
 * with its own bare `{dialog}` (only one consumer for that half — not shared).
 *
 * ARCHIVE-SUBENTITY-1: "kan niet verwijderen, wél archiveren" — the 409-race
 * offers archiving as the way out; no second confirm (see archiveNow's doc).
 */
import type { ReactNode } from 'react'
import InUseCountsDialog from './InUseCountsDialog'

interface SubEntityArchiveDialogsProps {
  dialog: ReactNode
  blockedCounts: Record<string, number> | null
  setBlockedCounts: (counts: Record<string, number> | null) => void
  archiveNow: () => Promise<void>
  archiving: boolean
}

// Renders the confirm dialog plus the 409-race "still in use" dialog with its archive escape.
export default function SubEntityArchiveDialogs({ dialog, blockedCounts, setBlockedCounts, archiveNow, archiving }: SubEntityArchiveDialogsProps) {
  return (
    <>
      {dialog}
      <InUseCountsDialog open={blockedCounts != null} counts={blockedCounts ?? {}} onClose={() => setBlockedCounts(null)}
        onArchive={() => { setBlockedCounts(null); void archiveNow() }} archiving={archiving} />
    </>
  )
}

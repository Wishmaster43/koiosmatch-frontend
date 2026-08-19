/**
 * InUseCountsDialog — the ONE shared "still in use" dialog for a customer
 * location/department delete that lost the 409 RACE (something got linked after
 * the row's own `in_use` flag was last read — SUBENTITEIT-DELETE-1). Lists every
 * blocking relation with its count, translated, mirroring ConfirmDialog's panel
 * shell.
 *
 * ARCHIVE-SUBENTITY-1: the dead end now has a way out — an optional `onArchive`
 * renders an "Archiveer" action beside Close (archiving carries none of the
 * in-use guard, so it always succeeds here even though the hard delete just
 * failed). Absent `onArchive` keeps the original Close-only shell (e.g. a caller
 * that has not wired archiving yet).
 */
import { useTranslation } from 'react-i18next'
import { Archive } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Spinner from '@/components/ui/Spinner'
import { Z } from '@/lib/zIndexScale'
import { Mono } from '@/components/ui/typography'
import Button from '@/components/ui/Button'

// Relation keys the backend's usageCounts() may send (location: 7 keys incl.
// `departments`; department: same minus `departments` plus `tasks` — both
// controllers, CustomerLocationController.php/CustomerDepartmentController.php).
// Reuses the EXISTING tab labels wherever one already names the same thing
// (§11: never a fresh label for something already named elsewhere) — only the
// two planning relations have no existing label to borrow.
function useRelationLabel(): (key: string) => string {
  const { t } = useTranslation('customers')
  const map: Record<string, string> = {
    departments: t('drawer.tabs.departments'),
    contacts: t('drawer.tabs.contacts'),
    vacancies: t('drawer.tabs.vacancies'),
    matches: t('drawer.tabs.matches'),
    opportunities: t('drawer.tabs.opportunities'),
    planning_orders: t('inUse.planningOrders'),
    planning_shifts: t('inUse.planningShifts'),
    tasks: t('drawer.tabs.tasks'),
  }
  return (key: string) => map[key] ?? key
}

export interface InUseCountsDialogProps {
  open: boolean
  counts: Record<string, number>
  onClose: () => void
  // ARCHIVE-SUBENTITY-1: the escape from this dead end — absent = no button (a
  // caller that has not wired archiving, or an entity without it, e.g. contacts).
  onArchive?: () => void
  archiving?: boolean
}

export default function InUseCountsDialog({ open, counts, onClose, onArchive, archiving = false }: InUseCountsDialogProps) {
  const { t } = useTranslation('customers')
  const relationLabel = useRelationLabel()

  const rows = Object.entries(counts).filter(([, n]) => n > 0)

  return (
    // POPUP-SLEEP-1: swapped the bespoke overlay/panel shell for the shared
    // draggable FloatingPanel. A blocking dialog above the drawer/modal band,
    // so it keeps its elevated layer via Z.confirm.
    <FloatingPanel open={open} onClose={onClose} title={t('inUse.title')}
      ariaLabel={t('inUse.title')} persistKey="in-use-counts" zIndex={Z.confirm}
      width={360} maxWidth="min(480px, 90vw)"
      bodyStyle={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(([key, n]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: 'var(--text)' }}>
              <span>{relationLabel(key)}</span>
              <Mono style={{ fontWeight: 600 }}>{n}</Mono>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {/* ARCHIVE-SUBENTITY-1: "kan niet verwijderen, wél archiveren" — archiving
              carries none of the in-use guard, so it is always a real way out here. */}
          {onArchive ? (
            <button onClick={onArchive} disabled={archiving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--color-archive) 40%, transparent)',
                background: 'color-mix(in srgb, var(--color-archive) 10%, transparent)', color: 'var(--color-archive)',
                cursor: archiving ? 'not-allowed' : 'pointer', fontSize: 13, opacity: archiving ? 0.6 : 1 }}>
              {archiving ? <Spinner size={13} /> : <Archive size={13} />}
              {t('inUse.archive')}
            </button>
          ) : <span />}
          <Button variant="secondary" onClick={onClose}>
            {t('inUse.close')}
          </Button>
        </div>
    </FloatingPanel>
  )
}

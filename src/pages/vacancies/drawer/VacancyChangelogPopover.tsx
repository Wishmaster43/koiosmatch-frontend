import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { History, X } from 'lucide-react'
import ChangelogTab from './ChangelogTab'
import { sectionTitle } from '@/components/ui/SectionCard'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { VacancyDetail } from '@/types/vacancy'

/**
 * ChangelogPanel — the actual popover surface, mounted only while open. Its own
 * component (rather than an inline conditional block) so useFocusTrap attaches on a
 * fresh mount — mirrors the candidate ChangelogPopover exactly (§3A(d)).
 */
function ChangelogPanel({ vacancy, onClose, label }: { vacancy: VacancyDetail; onClose: () => void; label: string }) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
      style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 400,
        width: 900, maxWidth: '92vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.16)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 7 }}>
          <History size={14} style={{ color: 'var(--text-muted)' }} /> {label}
        </span>
        <button onClick={onClose} aria-label={label}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
          <X size={15} />
        </button>
      </div>
      <div style={{ overflowY: 'auto', padding: '12px 14px' }}>
        <ChangelogTab vacancy={vacancy} bare />
      </div>
    </div>
  )
}

/**
 * VacancyChangelogPopover — a History icon in the drawer title-row that opens the
 * vacancy's audit trail in a scrollable popover. Mirrors the candidate/opportunity/
 * match ChangelogPopover (§3A(d)): record history stays one click from every tab
 * instead of being its own tab. V8 (VACATURES-100): widened to the same centered
 * 900px dialog + focus trap as the candidate popover (was a cramped 360px corner
 * dropdown) — the rewritten ChangelogTab now carries date filters/search/export
 * that need the room.
 */
export default function VacancyChangelogPopover({ vacancy }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('km:open-changelog', onOpen)
    return () => window.removeEventListener('km:open-changelog', onOpen)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button onClick={() => setOpen(o => !o)} title={t('drawer.tabs.changelog')}
        aria-label={t('drawer.tabs.changelog')} aria-haspopup="dialog" aria-expanded={open}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex',
          color: open ? 'var(--color-primary)' : 'var(--text-muted)' }}>
        <History size={14} />
      </button>

      {open && <ChangelogPanel vacancy={vacancy} onClose={() => setOpen(false)} label={t('drawer.tabs.changelog')} />}
    </div>
  )
}

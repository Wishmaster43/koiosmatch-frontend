import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { History, X } from 'lucide-react'
import ChangelogTab from './ChangelogTab'
import { sectionTitle } from '@/components/ui/SectionCard'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { Candidate } from '@/types/candidate'

/**
 * ChangelogPanel — the actual popover surface, mounted only while open. Its own
 * component (rather than an inline conditional block) so useFocusTrap (item 20)
 * attaches on a fresh mount — a single always-mounted parent toggling visibility
 * would never re-run the trap effect the moment the panel first appears.
 */
function ChangelogPanel({ c, onClose, label }: { c: Candidate; onClose: () => void; label: string }) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
      style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 400,
        width: 900, maxWidth: '92vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.16)', overflow: 'hidden' }}>
      {/* Popover header — title + close, supplies the chrome the bare tab drops. */}
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
      {/* Scrollable body — the existing changelog content without its own card. */}
      <div style={{ overflowY: 'auto', padding: '12px 14px' }}>
        <ChangelogTab c={c} bare />
      </div>
    </div>
  )
}

/**
 * ChangelogPopover — a History icon in the drawer title-row that opens the
 * candidate's audit trail in a scrollable popover. Replaces the changelog tab so
 * the record-level history stays one click away from every tab. Closes on
 * outside-click or Escape; the icon doubles as an open/close toggle.
 */
export default function ChangelogPopover({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // A Tijdlijn system-row icon can request the changelog (km:open-changelog).
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('km:open-changelog', onOpen)
    return () => window.removeEventListener('km:open-changelog', onOpen)
  }, [])

  // Close on outside click while the popover is open (Escape is handled by the
  // panel's own focus trap, item 20).
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      {/* Toggle: a calm, muted meta-icon that tints when the popover is open. */}
      <button onClick={() => setOpen(o => !o)} title={t('drawer.tabs.changelog')}
        aria-label={t('drawer.tabs.changelog')} aria-haspopup="dialog" aria-expanded={open}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex',
          color: open ? 'var(--color-primary)' : 'var(--text-muted)' }}>
        <History size={14} />
      </button>

      {open && <ChangelogPanel c={c} onClose={() => setOpen(false)} label={t('drawer.tabs.changelog')} />}
    </div>
  )
}

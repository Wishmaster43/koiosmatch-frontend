import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { History, X } from 'lucide-react'
import ChangelogTab from './ChangelogTab'
import { sectionTitle } from '@/components/ui/SectionCard'
import type { Candidate } from '@/types/candidate'

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

  // Close on outside click or Escape while the popover is open.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
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

      {open && (
        <div role="dialog" aria-label={t('drawer.tabs.changelog')}
          style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 300,
            width: 360, maxWidth: '90vw', maxHeight: 440, display: 'flex', flexDirection: 'column',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 28px rgba(0,0,0,0.16)', overflow: 'hidden' }}>
          {/* Popover header — title + close, supplies the chrome the bare tab drops. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 7 }}>
              <History size={14} style={{ color: 'var(--text-muted)' }} /> {t('drawer.tabs.changelog')}
            </span>
            <button onClick={() => setOpen(false)} aria-label={t('common:close')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
              <X size={15} />
            </button>
          </div>
          {/* Scrollable body — the existing changelog content without its own card. */}
          <div style={{ overflowY: 'auto', padding: '12px 14px' }}>
            <ChangelogTab c={c} bare />
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { History, X } from 'lucide-react'
import ChangelogTab from './ChangelogTab'
import type { VacancyDetail } from '@/types/vacancy'

/**
 * VacancyChangelogPopover — a History icon in the drawer title-row that opens the
 * vacancy's audit trail in a popover. Mirrors the candidate/opportunity/match
 * ChangelogPopover: record history stays one click from every tab instead of
 * being its own tab (§3A).
 */
export default function VacancyChangelogPopover({ vacancy }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape while open.
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <History size={14} style={{ color: 'var(--text-muted)' }} /> {t('drawer.tabs.changelog')}
            </span>
            <button onClick={() => setOpen(false)} aria-label={t('common:close')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
              <X size={15} />
            </button>
          </div>
          <div style={{ overflowY: 'auto', padding: '12px 14px' }}>
            <ChangelogTab vacancy={vacancy} />
          </div>
        </div>
      )}
    </div>
  )
}

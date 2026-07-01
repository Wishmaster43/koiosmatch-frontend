import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { History, X } from 'lucide-react'
import ActivityTab from './ActivityTab'
import type { TaskDetail } from '@/types/task'

/**
 * TaskChangelogPopover — a History icon in the drawer title-row that opens the
 * task's activity/changelog in a scrollable popover. Mirrors the candidate
 * ChangelogPopover so the record history stays one click away from every tab
 * (and the drawer no longer needs a separate Activity tab). Closes on outside
 * click or Escape.
 */
export default function TaskChangelogPopover({ task }: { task: TaskDetail }) {
  const { t } = useTranslation('tasks')
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
      <button onClick={() => setOpen(o => !o)} title={t('drawer.tabs.activity')}
        aria-label={t('drawer.tabs.activity')} aria-haspopup="dialog" aria-expanded={open}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex',
          color: open ? 'var(--color-primary)' : 'var(--text-muted)' }}>
        <History size={14} />
      </button>

      {open && (
        <div role="dialog" aria-label={t('drawer.tabs.activity')}
          style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 300,
            width: 360, maxWidth: '90vw', maxHeight: 440, display: 'flex', flexDirection: 'column',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 28px rgba(0,0,0,0.16)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              <History size={14} style={{ color: 'var(--text-muted)' }} /> {t('drawer.tabs.activity')}
            </span>
            <button onClick={() => setOpen(false)} aria-label={t('modal.cancel')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
              <X size={15} />
            </button>
          </div>
          <div style={{ overflowY: 'auto', padding: '12px 14px' }}>
            <ActivityTab task={task} />
          </div>
        </div>
      )}
    </div>
  )
}

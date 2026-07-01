/**
 * CustomerChangelog — a History icon in the drawer title-row that opens the
 * customer's audit trail in a scrollable popover (mirrors the candidate's
 * ChangelogPopover). Reads GET /customers/{id}/activity; a missing endpoint is
 * treated as empty. Closes on outside-click or Escape.
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { History, X } from 'lucide-react'
import api from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import { useDateFormat } from '@/lib/datetime'
import { sectionTitle } from '@/components/ui/SectionCard'
import type { Id } from '@/types/common'

interface ActivityEntry { id?: Id; description?: string; action?: string; author?: string; created_at?: string; time?: string }

export default function CustomerChangelog({ customerId }: { customerId: Id | undefined }) {
  const { t } = useTranslation('customers')
  const { formatDate } = useDateFormat()
  const [open,    setOpen]    = useState(false)
  const [items,   setItems]   = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fetch the audit trail lazily — only when the popover is first opened.
  useEffect(() => {
    if (!open || !customerId) return
    const ctrl = new AbortController()
    setLoading(true)
    api.get(`/customers/${customerId}/activity`, { signal: ctrl.signal })
      .then(r => setItems((r.data?.data ?? r.data ?? []) as ActivityEntry[]))
      .catch(e => { if (!isAbortError(e)) setItems([]) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [open, customerId])

  // Close on outside click or Escape while the popover is open.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex' }}>
      <button onClick={() => setOpen(o => !o)} title={t('drawer.changelog')} aria-label={t('drawer.changelog')}
        aria-haspopup="dialog" aria-expanded={open}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex',
          color: open ? 'var(--color-primary)' : 'var(--text-muted)' }}>
        <History size={14} />
      </button>

      {open && (
        <div role="dialog" aria-label={t('drawer.changelog')}
          style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 300,
            width: 360, maxWidth: '90vw', maxHeight: 440, display: 'flex', flexDirection: 'column',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 28px rgba(0,0,0,0.16)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 7 }}>
              <History size={14} style={{ color: 'var(--text-muted)' }} /> {t('drawer.changelog')}
            </span>
            <button onClick={() => setOpen(false)} aria-label={t('drawer.cancel')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
              <X size={15} />
            </button>
          </div>
          <div style={{ overflowY: 'auto', padding: '12px 14px' }}>
            {loading ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('page.loading')}</div>
              : items.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('changelog.empty')}</div>
              : items.map((ev, i) => (
                  <div key={ev.id ?? i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>{ev.description ?? ev.action ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {[ev.author, (ev.created_at ?? ev.time) ? formatDate(ev.created_at ?? ev.time, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ChangelogTab — the customer's audit trail content (icon-popover, §3A(d), Danny
 * 27-07 unification onto the shared house ChangelogPopover shell). Presentational:
 * reads GET /customers/{id}/activity — a missing/failing endpoint degrades to an
 * empty list, never a crash. Renders a plain description/author/date line per
 * entry (the backend sends no per-field diff bag yet for customers, unlike
 * candidates/vacancies) — mounts only while the shared popover is open, so this
 * effect already IS the lazy-on-open fetch.
 *
 * LOC-DEPT-CHANGELOG-1 (extended additively): an optional `endpoint` override lets
 * the SAME content component serve the location/department/contact detail's own
 * one-level-deeper activity feed (…/locations/{id}/activity etc. — the identical
 * shared change-log shape/pagination/permission, CustomerLocationController.php).
 * The existing `customerId`-only callers (CustomerDrawer) are unchanged.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import { useDateFormat } from '@/lib/datetime'
import type { Id } from '@/types/common'

interface ActivityEntry { id?: Id; description?: string; action?: string; author?: string; created_at?: string; time?: string }

export default function ChangelogTab({ customerId, endpoint }: { customerId?: Id; endpoint?: string }) {
  const { t } = useTranslation('customers')
  const { formatDate } = useDateFormat()
  const [items, setItems] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch once per mount — the shared ChangelogPopover shell only mounts this
  // content while its panel is open. `endpoint` wins when given (a sub-entity's
  // own activity route); otherwise falls back to the customer's own route.
  const url = endpoint ?? (customerId ? `/customers/${customerId}/activity` : undefined)
  useEffect(() => {
    if (!url) return
    const ctrl = new AbortController()
    setLoading(true)
    api.get(url, { signal: ctrl.signal })
      .then(r => setItems((unwrapList(r).rows) as ActivityEntry[]))
      .catch(e => { if (!isAbortError(e)) setItems([]) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [url])

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('page.loading')}</div>
  if (items.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('changelog.empty')}</div>

  return (
    <>
      {items.map((ev, i) => (
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
    </>
  )
}

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { History, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import Avatar from '@/components/ui/Avatar'
import SectionCard from '@/components/ui/SectionCard'
import { useDateFormat } from '@/lib/datetime'
import { isAbortError } from '@/lib/mocks'
import { initialsOf } from '@/lib/initials'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

interface ActivityEvent {
  id?: Id
  causer_name?: string
  created_at?: string
  description?: string
  log_name?: string
}

/**
 * ChangelogTab — the candidate's audit trail (who changed what, when). Reads
 * `GET /candidates/{id}/activity` (C-16). Handles the four UI states explicitly;
 * shows a calm empty state until the backend endpoint is live (404 → empty).
 */
export default function ChangelogTab({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const [items,   setItems]   = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  // Fetch the activity log for this candidate; a missing endpoint = empty, not an error.
  useEffect(() => {
    if (!c?.id) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/candidates/${c.id}/activity`, { signal: ctrl.signal })
      .then(res => setItems(res.data?.data ?? res.data ?? []))
      .catch(err => {
        if (isAbortError(err)) return
        // 404 = endpoint not built yet → treat as empty (calm), not a hard error.
        if (err?.response?.status && err.response.status !== 404) setError(true)
        setItems([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [c?.id])

  return (
    <SectionCard title={t('drawer.tabs.changelog')}>
      {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('changelog.loading')}</div>}

      {!loading && error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-danger)' }}>
          <AlertTriangle size={14} /> {t('changelog.error')}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
          <History size={22} style={{ opacity: 0.5 }} />
          <span style={{ fontSize: 12 }}>{t('changelog.empty')}</span>
        </div>
      )}

      {!loading && !error && items.map((ev, i) => (
        <div key={ev.id ?? i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />
          <Avatar initials={initialsOf(ev.causer_name)} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{ev.causer_name || t('changelog.system')}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{formatDate(ev.created_at)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.description || ev.log_name}</div>
          </div>
        </div>
      ))}
    </SectionCard>
  )
}

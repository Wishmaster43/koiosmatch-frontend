/**
 * ChangelogTab — the match's audit trail. Presentational; the fetch lives in
 * useMatchActivity (§3). Handles the four UI states explicitly and shows a calm
 * empty state until the backend read endpoint is live (404 → empty). Mirrors the
 * opportunity/candidate changelog so every entity reads the same (§3A).
 */
import { useTranslation } from 'react-i18next'
import { History, AlertTriangle } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { useMatchActivity } from '../hooks/useMatchActivity'
import type { MatchRow } from '@/types/match'

export default function ChangelogTab({ match }: { match: MatchRow }) {
  const { t } = useTranslation('matches')
  const { formatDate } = useDateFormat()
  const { items, loading, error } = useMatchActivity(match?.id)

  return (
    <div>
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
          <Avatar initials={initialsOf(ev.causer_name)} size={26} soft />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{ev.causer_name || t('changelog.system')}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{formatDate(ev.created_at)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.description || ev.log_name}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import { History, AlertTriangle } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import SectionCard from '@/components/ui/SectionCard'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { useCandidateActivity } from '../hooks/useCandidateDrawerData'
import type { Candidate } from '@/types/candidate'

/**
 * ChangelogTab — the candidate's audit trail (who changed what, when). Presentational:
 * the fetch (GET /candidates/{id}/activity, C-16) lives in useCandidateActivity (§3).
 * Handles the four UI states explicitly; shows a calm empty state until the backend
 * endpoint is live (404 → empty). `bare` drops the SectionCard so a popover can
 * supply its own chrome.
 */
export default function ChangelogTab({ c, bare = false }: { c: Candidate; bare?: boolean }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const { items, loading, error } = useCandidateActivity(c?.id)

  const body = (
    <>
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
            {ev.ip && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{t('changelog.fromIp', { ip: ev.ip })}</div>}
          </div>
        </div>
      ))}
    </>
  )

  // Bare = caller supplies its own chrome (e.g. the changelog popover header).
  if (bare) return body
  return <SectionCard title={t('drawer.tabs.changelog')}>{body}</SectionCard>
}

/**
 * RecentListsRow — recent candidates + recent applications side by side. Extracted
 * from Dashboard.tsx (§0.3 size split); rendering identical to the original inline
 * lists (demo-data placeholder note retained — B-22/C-30).
 */
import { useTranslation } from 'react-i18next'
import { interactive } from '@/lib/a11y'
import { Block, Avatar, StatusBadge } from '../DashboardPrimitives'
import type { DashboardViewModel } from '../hooks/useDashboardViewModel'

export default function RecentListsRow({ vis, recentCandidates, recentApplications, onNavigate }: {
  vis: DashboardViewModel['vis']
  recentCandidates: DashboardViewModel['recentCandidates']
  recentApplications: DashboardViewModel['recentApplications']
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
}) {
  const { t } = useTranslation('dashboard')
  if (!(vis('list.candidates') || vis('list.applications'))) return null

  return (
    // Recente lijsten — demo-data tot er een feed is (B-22/C-30)
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
      {vis('list.candidates') && (
      <Block title={t('block.recentCandidates')} action={t('action.allCandidates')} onAction={() => onNavigate?.('candidates')}>
        {recentCandidates.map((c, i) => (
          <div key={i} {...interactive(c.id != null ? () => onNavigate?.('candidates', { open: c.id }) : undefined)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: c.id != null ? 'pointer' : 'default',
            borderBottom: i < recentCandidates.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <Avatar initials={c.initials} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.role}</div>
            </div>
            <StatusBadge label={c.status} color={c.statusColor} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{c.time}</span>
          </div>
        ))}
      </Block>
      )}

      {vis('list.applications') && (
      <Block title={t('block.recentApplications')} action={t('action.allApplications')} onAction={() => onNavigate?.('applications')}>
        {recentApplications.map((a, i) => (
          <div key={i} {...interactive(a.id != null ? () => onNavigate?.('applications', { open: a.id }) : undefined)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: a.id != null ? 'pointer' : 'default',
            borderBottom: i < recentApplications.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.candidate}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.vacancy}</div>
            </div>
            <StatusBadge label={a.status} color={a.statusColor} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{a.time}</span>
          </div>
        ))}
      </Block>
      )}
    </div>
  )
}

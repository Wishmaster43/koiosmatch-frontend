/**
 * JobQueueSettings — Super Admin → Taakbeheer (QUEUE-VIEW-1, extends T4.1). The
 * super-admin queue "task manager": per-queue/per-tenant health (Overzicht),
 * the live pending/reserved backlog (Taken) and the failure log with retry/
 * forget/flush (Mislukt). Visibility is superadmin-gated by the registry entry
 * (superAdminOnly: true — mirrors ModulesSettings/TenantUsageSettings, no
 * second gate needed here). Thin container: each tab owns its own data hook.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks } from 'lucide-react'
import { useQueueSummary } from './useQueueSummary'
import QueueOverviewTab from './QueueOverviewTab'
import JobsTab from './JobsTab'
import RecentJobsTab from './RecentJobsTab'
import FailedJobsTab from './FailedJobsTab'
import MetricsTab from './MetricsTab'

// TAAKBEHEER-HORIZON-1 fase 1: Recent = Horizon's zojuist-verwerkte jobs per tenant.
// TAAKBEHEER-HORIZON-1 fase 2: Metrics = Horizon's snapshotted throughput/runtime.
const TABS = ['overview', 'recent', 'jobs', 'failed', 'metrics']

export default function JobQueueSettings() {
  const { t } = useTranslation('settings')
  const [tab, setTab] = useState('overview')
  const { summary, phase, refetch } = useQueueSummary()

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <ListChecks size={18} style={{ color: 'var(--color-primary)' }} />
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{t('jobs.title')}</h2>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 16px' }}>{t('jobs.subtitle')}</p>

      {/* Tab strip — same look as ApiKeyDetail's inline tabs. */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {TABS.map((id) => {
          const active = id === tab
          return (
            <button key={id} role="tab" aria-selected={active} onClick={() => setTab(id)}
              style={{ padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13,
                fontWeight: active ? 600 : 500, color: active ? 'var(--color-primary)' : 'var(--text-muted)',
                borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`, marginBottom: -1 }}>
              {t(`jobs.tab.${id}`)}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && <QueueOverviewTab summary={summary} phase={phase} onRefresh={refetch} onGoToFailed={() => setTab('failed')} />}
      {tab === 'recent' && <RecentJobsTab />}
      {tab === 'jobs' && <JobsTab />}
      {tab === 'failed' && <FailedJobsTab />}
      {tab === 'metrics' && <MetricsTab />}
    </div>
  )
}

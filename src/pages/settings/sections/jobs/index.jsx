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
import SubTabBar from '@/components/drawer/SubTabBar'
import { useQueueSummary } from './useQueueSummary'
import QueueHealthBlock from './QueueHealthBlock'
import QueueOverviewTab from './QueueOverviewTab'
import JobsTab from './JobsTab'
import RecentJobsTab from './RecentJobsTab'
import FailedJobsTab from './FailedJobsTab'
import MetricsTab from './MetricsTab'
import { PageTitle } from '@/components/ui/typography'

// TAAKBEHEER-HORIZON-1 fase 1: Recent = Horizon's zojuist-verwerkte jobs per tenant.
// TAAKBEHEER-HORIZON-1 fase 2: Metrics = Horizon's snapshotted throughput/runtime.
const TABS = ['overview', 'recent', 'jobs', 'failed', 'metrics']

// Job-queue settings: sub-tab shell over the Horizon-backed overview/recent/jobs/failed/metrics views (see TABS above).
export default function JobQueueSettings() {
  const { t } = useTranslation('settings')
  const [tab, setTab] = useState('overview')
  const { summary, phase, refetch } = useQueueSummary()

  const tabs = TABS.map(id => ({ id, label: t(`jobs.tab.${id}`) }))

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <ListChecks size={18} style={{ color: 'var(--color-primary-text)' }} />
        <PageTitle>{t('jobs.title')}</PageTitle>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 16px' }}>{t('jobs.subtitle')}</p>

      {/* QUEUE-WATCH-1: Horizon/scheduler health strip + incident banner, above the tabs. */}
      <QueueHealthBlock queueStatus={summary?.queue_status} />

      {/* Tab strip — the shared SubTabBar (DRY-1 O5); the wrapper keeps the old outer margin. */}
      <div style={{ marginBottom: 20 }}>
        <SubTabBar tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {tab === 'overview' && <QueueOverviewTab summary={summary} phase={phase} onRefresh={refetch} onGoToFailed={() => setTab('failed')} />}
      {tab === 'recent' && <RecentJobsTab />}
      {tab === 'jobs' && <JobsTab />}
      {tab === 'failed' && <FailedJobsTab />}
      {tab === 'metrics' && <MetricsTab />}
    </div>
  )
}

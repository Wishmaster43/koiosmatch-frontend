import type { TFunction } from 'i18next'
import { Mono } from '@/components/ui/typography'

// The shape both JobsTab and FailedJobsTab's rows share — queue/tenant/job.
export interface JobRow {
  queue?: string
  tenant_id?: string
  job?: string
}

/**
 * Shared columns for both JobsTab and FailedJobsTab — queue, tenant, job.
 * Each tab appends its own extra columns (attempts/failed_at/actions, etc.) after these.
 */
export function jobColumns(t: TFunction) {
  return [
    { key: 'queue', header: t('jobs.col.queue'), nowrap: true },
    { key: 'tenant_id', header: t('jobs.col.tenant'), nowrap: true,
      render: (r: JobRow) => r.tenant_id === 'central' ? t('jobs.centralTenant') : r.tenant_id },
    { key: 'job', header: t('jobs.col.job'), render: (r: JobRow) => <Mono style={{ fontSize: 12 }}>{r.job}</Mono> },
  ]
}

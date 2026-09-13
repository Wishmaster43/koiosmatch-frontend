import type { TFunction } from 'i18next'
import { TextField } from '@/components/forms/fields'

interface JobsFilters { queue: string; tenant: string }
interface JobsFilterBarProps {
  filters: JobsFilters
  setFilter: (key: keyof JobsFilters, value: string) => void
  labels: TFunction | Record<string, string>
}
/**
 * Shared filter bar for both JobsTab and FailedJobsTab — queue and tenant inputs.
 * Props: filters (object with queue/tenant), setFilter(key, value), labels (t() function or object with queue/tenant labels).
 */
export default function JobsFilterBar({ filters, setFilter, labels }: JobsFilterBarProps) {
  // Labels can be a t() function or an object with queue/tenant keys.
  const getLabel = (key: string): string => {
    if (typeof labels === 'function') {
      return labels(`jobs.filters.${key}`)
    }
    return labels[key]
  }

  return (
    // Compact inline row (the kit's TextField spans 100% by default; the two filters sit
    // side by side at a fixed width, as the tabs did before the extraction).
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <TextField
        value={filters.queue}
        onChange={(v: string) => setFilter('queue', v)}
        placeholder={getLabel('queue')}
        style={{ width: 200 }}
      />
      <TextField
        value={filters.tenant}
        onChange={(v: string) => setFilter('tenant', v)}
        placeholder={getLabel('tenant')}
        style={{ width: 200 }}
      />
    </div>
  )
}

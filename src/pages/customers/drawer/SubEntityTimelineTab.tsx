/**
 * SubEntityTimelineTab — the timeline/activity log for a customer sub-entity
 * (location, department, or contact). Thin wrapper around EntityChangelogTab
 * that fetches the sub-entity's own /activity endpoint (LOC-DEPT-CHANGELOG-1).
 * §3A(d): Tijdlijn tab, second-to-last position (before Koppelingen).
 */
import EntityChangelogTab from '@/components/drawer/tabs/EntityChangelogTab'
import { useCustomerActivity } from '../hooks/useCustomerActivity'

interface Props {
  /** The activity endpoint (e.g. `/customers/{customerId}/locations/{id}/activity`). */
  endpoint: string
}

// Bookkeeping fields — same exclusion as the customer-level ChangelogTab.
const NOISE_FIELDS = ['external_id', 'remember_token', 'password', 'uuid']

export default function SubEntityTimelineTab({ endpoint }: Props) {
  const { items, loading, error } = useCustomerActivity({ endpoint })

  return (
    <EntityChangelogTab
      items={items} loading={loading} error={error} namespace="customers"
      noiseFields={NOISE_FIELDS}
    />
  )
}

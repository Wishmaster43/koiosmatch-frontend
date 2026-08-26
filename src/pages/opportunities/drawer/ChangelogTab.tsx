/**
 * ChangelogTab — the opportunity's FIELD-CHANGE audit trail (icon-popover, §3A(d)).
 * Thin wrapper around the shared `components/drawer/tabs/EntityChangelogTab` (§11
 * LANE-B) — GET /opportunities/{id}/activity shares the same AuditsChanges trait as
 * candidates/vacancies/applications, so the diff bag renders one old → new row per
 * changed field here too (previously this tab ignored that bag and showed only the
 * flat description line).
 */
import { useTranslation } from 'react-i18next'
import EntityChangelogTab, { type ChangelogEvent } from '@/components/drawer/tabs/EntityChangelogTab'
import { useOpportunityActivity } from '../hooks/useOpportunityActivity'
import type { Opportunity } from '@/types/opportunity'

// Opportunity drawer's changelog tab content.
export default function ChangelogTab({ opportunity: o }: { opportunity: Opportunity }) {
  const { t } = useTranslation('opportunities')
  const { items, loading, error } = useOpportunityActivity(o?.id)
  // The hours_period diff arrives as a raw slug (week|month|total); reuse the
  // details-tab keys so the changelog speaks the same language as the form.
  const formatValue = (field: string, val: unknown): string | undefined => {
    if (val === null || val === undefined || val === '') return undefined
    if (field === 'hours_period') return t(`details.periods.${String(val)}`, { defaultValue: String(val) })
    return undefined
  }
  return <EntityChangelogTab items={items as ChangelogEvent[]} loading={loading} error={error} namespace="opportunities" formatValue={formatValue} />
}

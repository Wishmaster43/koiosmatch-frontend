/**
 * ChangelogTab — the match's FIELD-CHANGE audit trail (icon-popover, §3A(d)). Thin
 * wrapper around the shared `components/drawer/tabs/EntityChangelogTab` (§11
 * LANE-B) — GET /matches/{id}/activity shares the same AuditsChanges trait as
 * candidates/vacancies/applications, so the diff bag renders one old → new row per
 * changed field here too (previously this tab ignored that bag and showed only the
 * flat description line).
 */
import { useTranslation } from 'react-i18next'
import EntityChangelogTab, { type ChangelogEvent } from '@/components/drawer/tabs/EntityChangelogTab'
import { useMatchActivity } from '../hooks/useMatchActivity'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useLookups } from '@/context/LookupsContext'
import type { MatchRow } from '@/types/match'

// Match drawer's changelog tab content.
export default function ChangelogTab({ match }: { match: MatchRow }) {
  const { t } = useTranslation('matches')
  const { items, loading, error } = useMatchActivity(match?.id)
  // Slug-valued diff fields resolve through their existing translated sources: the
  // tenant's match-status lookup, the approval keys, and the Contractvorm lookup
  // (tenant renames included). Unknown values fall back to the shared default.
  const { metaOf } = useMatchStatuses()
  const { candidateTypes } = useLookups()
  const formatValue = (field: string, val: unknown): string | undefined => {
    if (val === null || val === undefined || val === '') return undefined
    const v = String(val)
    if (field === 'status') return metaOf(v)?.label
    if (field === 'approval_status') return t(`approval.status.${v}`, { defaultValue: v })
    if (field === 'contract_form') return candidateTypes.find(ct => ct.value === v)?.label
    return undefined
  }
  return <EntityChangelogTab items={items as ChangelogEvent[]} loading={loading} error={error} namespace="matches" formatValue={formatValue} />
}

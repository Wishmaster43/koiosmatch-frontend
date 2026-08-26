/**
 * ChangelogTab — the application's FIELD-CHANGE audit trail (icon-popover, §3A(d)).
 * Thin wrapper around the shared `components/drawer/tabs/EntityChangelogTab` (§11
 * LANE-B): only the fetch, the owner_id name resolution and the stage-only dedupe
 * are application-specific. A pure funnel-stage transition already reads clearly on
 * the Tijdlijn tab ("Fase gewijzigd: A → B"), so it stays filtered out of this feed
 * to avoid showing the same transition twice with two different phrasings.
 */
import { useTranslation } from 'react-i18next'
import { useUsers } from '@/lib/queries'
import EntityChangelogTab, { type ChangelogEvent } from '@/components/drawer/tabs/EntityChangelogTab'
import { useApplicationActivity, type ApplicationActivityEvent } from '../hooks/useApplicationActivity'
import type { ApplicationDetail } from '@/types/application'

// application_stage_id carries no diff-row meaning of its own here (see file doc).
const NOISE_FIELDS = ['application_stage_id']

// True when the ONLY field this audit entry changed is the funnel stage — that
// exact transition already has a readable row on the Tijdlijn tab, so repeating a
// bare "updated" row here would just be visual noise (dedupe, §3A(d) decision).
const isStageOnlyChange = (ev: ApplicationActivityEvent): boolean => {
  const keys = Object.keys(ev.changes?.attributes ?? {})
  return keys.length === 1 && keys[0] === 'application_stage_id'
}

// Application drawer's changelog tab content.
export default function ChangelogTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation('applications')
  const { items, loading, error } = useApplicationActivity(a?.id)
  // owner_id is the one recurring raw uuid on this entity's diff bag — resolve it
  // against the tenant's users so "Recruiter — bijgewerkt" becomes the actual name
  // (Danny punt 20/30: never a raw id when a name is available elsewhere).
  const { data: users = [] } = useUsers() as { data?: { id: unknown; name: string }[] }

  const formatValue = (field: string, val: unknown): string | undefined => {
    if (field !== 'owner_id' || val === null || val === undefined || val === '') return undefined
    const found = users.find(u => String(u.id) === String(val))
    return found?.name || t('changelog.updatedValue')
  }

  return (
    <EntityChangelogTab
      items={items as ChangelogEvent[]} loading={loading} error={error} namespace="applications"
      noiseFields={NOISE_FIELDS} formatValue={formatValue} wrapWhoAction
      filterEvent={ev => !isStageOnlyChange(ev as unknown as ApplicationActivityEvent)}
    />
  )
}

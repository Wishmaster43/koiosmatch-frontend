// ChangelogTab — the vacancy's field-change audit trail. Thin wrapper around the
// shared `components/drawer/tabs/EntityChangelogTab` (§11 LANE-B): only the fetch
// and the status/seniority/education/ai-agent lookup resolution are vacancy-specific.
import { useTranslation } from 'react-i18next'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useVacancyActivity } from '../hooks/useVacancyActivity'
import { useAiAgents } from '../hooks/useAiAgents'
import EntityChangelogTab from '@/components/drawer/tabs/EntityChangelogTab'
import type { VacancyDetail } from '@/types/vacancy'

// The vacancy's changelog content (icon-popover, §3A(d)) — GET /vacancies/{id}/activity
// shares the same AuditsChanges trait as candidates, so the diff bag is always there.
// `bare` is accepted for call-site compatibility but has no effect: this content never
// had a non-popover call site, so the old SectionCard-wrapped branch was dead code.
export default function ChangelogTab({ vacancy: v }: { vacancy: VacancyDetail; bare?: boolean }) {
  const { t } = useTranslation('vacancies')
  const { items, loading, error } = useVacancyActivity(v?.id)
  const { statusMeta, seniorityMeta, educationMeta } = useVacancyLookups()
  // V30: ai_agent_id is a raw uuid the diff bag can't name on its own — resolve it
  // against the tenant's AI agents so a linked/unlinked agent shows its readable
  // name ("Intake bot") instead of the old opaque "bijgewerkt" (Danny punt 30).
  const { agents: aiAgents } = useAiAgents(true)

  // Known lookup-id columns resolve to their tenant label; an empty value or any
  // other field defers to the shared generic formatting (booleans/arrays/dates/uuids).
  const formatValue = (field: string, val: unknown): string | undefined => {
    if (val === null || val === undefined || val === '') return undefined
    if (field === 'vacancy_status_id')          return statusMeta(String(val)).label
    if (field === 'vacancy_seniority_level_id') return seniorityMeta(String(val)).label
    if (field === 'vacancy_education_level_id') return educationMeta(String(val)).label
    if (field === 'ai_agent_id') {
      const found = aiAgents.find(a => String(a.id) === String(val))
      // No name resolvable (agent deleted since) → the existing honest fallback,
      // never the raw uuid.
      return found?.name || t('changelog.updatedValue')
    }
    return undefined
  }

  return (
    <EntityChangelogTab
      items={items} loading={loading} error={error} namespace="vacancies" formatValue={formatValue}
      toolbar exportFileNameBase={`changelog-${v?.title ?? 'vacancy'}`}
    />
  )
}

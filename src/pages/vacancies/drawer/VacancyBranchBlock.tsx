import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SectionCard from '@/components/ui/SectionCard'
import { useLocations } from '@/lib/useLocations'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

/**
 * VacancyBranchBlock — the vacancy's own bureau branch (vestiging, `location_id`),
 * DRILLDOWN-VOLGORDE-CANON's LAST block (Danny 21-08, VACATURES 1/3): informatie
 * first, then the free text, then Koios AI, and vestiging last of all. Unlike the
 * match drawer's SharedBranchSection (which is read-only because the match's
 * branch is DERIVED from its links, with no membership route of its own), the
 * vacancy has a real `location_id` relation and PATCH path — so this stays a real,
 * immediately-persisting picker rather than the shared read-only display block.
 */
export default function VacancyBranchBlock({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: UpdateFn }) {
  const { t } = useTranslation('vacancies')
  const options = useLocations()

  // No pencil here — a single relational pick persists the moment it changes,
  // mirroring how the candidate/customer branch toggles save on click.
  const handleChange = (val: string) => {
    onUpdate?.(v.id, {
      // VAC-CLEAR-1: `null` when cleared, never omitted, so the clear really reaches the PATCH.
      branchId: val || null,
      branchName: options.find(o => String(o.value) === val)?.label ?? '',
    })
  }

  return (
    <SectionCard title={t('modal.fields.branch')}>
      <CreatableSelect value={v.branchId || null} onChange={handleChange} allowCreate={false}
        clearable clearLabel={t('modal.fields.branch')}
        placeholder={t('common:select')} options={options.map(o => ({ value: String(o.value), label: o.label }))} />
    </SectionCard>
  )
}

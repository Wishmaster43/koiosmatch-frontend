import { useTranslation } from 'react-i18next'
import SharedBranchSection from '@/components/drawer/BranchSection'
import { useLocations } from '@/lib/useLocations'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

/**
 * VacancyBranchBlock — the vacancy's own bureau branch (vestiging, `location_id`),
 * DRILLDOWN-VOLGORDE-CANON's LAST block (Danny 21-08, VACATURES 1/3). LOOK
 * decided by Danny (21-08, translated: "like candidate and customer" —
 * verbatim: "Zoals kandidaat en klant"): the shared BranchSection
 * chips + "+ Vestiging" picker, NOT a dropdown — one vestiging-look everywhere.
 * The vacancy holds ONE `location_id`, so the multi-select surface gets
 * single-value semantics: picking a branch REPLACES the current one, toggling
 * the selected one (or its chip ×) clears it — every change persists
 * immediately through the real PATCH path (VAC-CLEAR-1: clear sends null).
 */
export default function VacancyBranchBlock({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: UpdateFn }) {
  const { t } = useTranslation(['vacancies', 'candidates'])
  const options = useLocations()

  // Single-value toggle: same id again = clear; another id = replace.
  const handleToggle = (id: string) => {
    const next = id === (v.branchId || '') ? '' : id
    onUpdate?.(v.id, {
      // VAC-CLEAR-1: `null` when cleared, never omitted, so the clear really reaches the PATCH.
      branchId: next || null,
      branchName: options.find(o => String(o.value) === next)?.label ?? '',
    })
  }

  return (
    <SharedBranchSection
      label={t('modal.fields.branch')}
      addLabel={t('candidates:sections.branchLink')}
      emptyLabel={t('candidates:sections.branchEmpty')}
      options={options.map(o => ({ value: String(o.value), label: o.label }))}
      selectedIds={v.branchId ? [v.branchId] : []}
      branches={v.branchId ? [{ id: v.branchId, name: v.branchName || '' }] : []}
      onToggle={handleToggle}
    />
  )
}

/**
 * MergeFieldConflicts — step 3 of MergeCandidateModal (X-37, K-27): one two-way
 * choice per tenant custom field where both records hold a DIFFERENT value.
 * Presentational only — the modal owns the loaded maps and the choices; this renders
 * the house SegmentedControl per field (each record's NAME as the option label, its
 * value as the description), preselected on the survivor. Values go through the same
 * read-only rule as the Extra tab (boolean → yes/no, date → DD-MM-YYYY; DATUM-1).
 */
import { useTranslation } from 'react-i18next'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { GroupLabel, SectionTitle } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { displayCustomFieldValue } from '@/lib/customFieldDisplay'
import type { CustomFieldDef } from '@/lib/useCustomFields'
import type { ConflictChoice, CustomFieldMap } from './mergeCustomFields'

// One side of the merge: the record's display name plus its custom_fields map.
export interface MergeSide { name: string; values: CustomFieldMap }

// Caps the list inside the 460px panel; a tenant with many colliding fields scrolls here.
const LIST_MAX_HEIGHT = 320

export default function MergeFieldConflicts({ conflicts, defs, survivor, source, choices, onChoose }: {
  conflicts: string[]
  defs: CustomFieldDef[]
  survivor: MergeSide
  source: MergeSide
  choices: Record<string, ConflictChoice>
  onChoose: (key: string, choice: ConflictChoice) => void
}) {
  const { t } = useTranslation('candidates')
  const { t: tCommon } = useTranslation('common')
  const { formatDate } = useDateFormat()

  // A value whose definition no longer exists (deleted def, data kept) still collides —
  // it renders by its key as a plain text field rather than vanishing from the choice.
  const defOf = (key: string): CustomFieldDef => defs.find(d => d.key === key)
    ?? { key, label: key, type: 'text', sort_order: 0, active: true, has_data: true, visible_in_ui: true }

  return (
    <div style={{ marginBottom: 12 }}>
      <SectionTitle as="div" style={{ marginBottom: 4 }}>{t('merge.conflictsTitle')}</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>{t('merge.fieldConflictIntro')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: LIST_MAX_HEIGHT, overflowY: 'auto' }}>
        {conflicts.map(key => {
          const def = defOf(key)
          return (
            <div key={key}>
              <GroupLabel style={{ marginBottom: 6 }}>{def.label}</GroupLabel>
              <SegmentedControl
                ariaLabel={t('merge.chooseValue', { field: def.label })}
                options={[
                  { value: 'survivor', label: survivor.name, description: displayCustomFieldValue(def, survivor.values[key], tCommon, formatDate) },
                  { value: 'source', label: source.name, description: displayCustomFieldValue(def, source.values[key], tCommon, formatDate) },
                ]}
                value={choices[key] ?? 'survivor'}
                onChange={v => onChoose(key, v as ConflictChoice)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * DefaultStatusFilterPicker — the tenant-configurable default for a customer
 * drill-down tab's status filter (Locaties/Afdelingen/Contactpersonen/Vacatures;
 * TENANT-DEFAULT-1, Danny 02-08). Replaces the frontend's own slug-based "active
 * only" guess (`useStatusFilter` in StatusFilterSelect.tsx), which silently gave no
 * default at all to a tenant who renamed that status. Fed ONLY from the same tenant
 * lookup the filter itself uses — never a free-text field — so a tenant can never
 * pick a default that does not exist.
 *
 * REVIEW FIX (Danny 02-08, second pass): the first version was a hand-rolled radio
 * group with its own boxed rows — not this product's pattern for "pick one from a
 * tenant lookup". Rebuilt on the SAME `SettingRow` every neighbouring row in this
 * exact screen already uses, so it reads as one more row, not a separate widget
 * (the picker itself is now `SelectField` — see SWEEP-SETTINGS-DROPDOWN below).
 * It also used to render an empty "not configured" state while the
 * live tab was, in fact, already filtering via the guess — a control that shows
 * nothing while something real is happening is a lie about the current state. It
 * now ALWAYS shows the value really in effect: the stored setting if one exists,
 * otherwise the exact guess `useStatusFilter` would apply today (or "All" if no
 * active-like status exists) — reusing `isActiveValue`, never a second copy of that
 * heuristic. A short line of text says whether that value was chosen or guessed.
 *
 * DELETED STATUS GUARD (Danny 02-09): a stored value that no longer exists in the
 * statuses lookup (deleted by the tenant) is now treated as NOT configured — the
 * picker falls back to the same guess as if nothing was stored, and renders a
 * Caption hint below the field explaining that the previously chosen status no
 * longer exists.
 *
 * SWEEP-SETTINGS-DROPDOWN (Danny 08-08): this list is a tenant lookup (grows with
 * however many statuses the tenant defines), so the non-searchable `SelectMenu`
 * checklist was the one settings-tree picker still without a type-to-filter box.
 * Swapped for the shared kit's `SelectField` (SearchSelect-backed, same value/
 * onChange contract) — every other settings dropdown already went through this
 * conversion (SchemaSection/CompanySettings/StatusListEditor/ScopeEditor).
 */
import { useTranslation } from 'react-i18next'
import { SettingRow, SelectField } from './SettingsKit'
import { STATUS_FILTER_ALL, isActiveValue } from '@/components/drawer/StatusFilterSelect'

// One SettingRow picking the tenant's stored default status filter, or showing the same guess useStatusFilter applies today when nothing is stored yet (see file header).
export default function DefaultStatusFilterPicker({ statuses, value, onChange }) {
  const { t } = useTranslation('settings')

  // Check if the stored value actually exists in the current statuses lookup.
  // If it doesn't (status was deleted), treat as not configured.
  // Note: STATUS_FILTER_ALL is always valid even if no status exists.
  const statusExists = value && value !== STATUS_FILTER_ALL && statuses.some(s => String(s.id ?? s.value) === value)
  const configured = value != null && (value === STATUS_FILTER_ALL || statusExists)

  // The value ACTUALLY in effect today: a tenant-chosen one if saved AND still exists,
  // otherwise the same guess useStatusFilter falls back to (or "all" when no active-like
  // status exists) — so the control never shows a state the tab itself is not really in.
  const guessed = statuses.find(s => isActiveValue(s.value))
  const guessedValue = guessed ? String(guessed.id ?? guessed.value) : STATUS_FILTER_ALL
  const effective = configured ? value : guessedValue

  const options = [
    { value: STATUS_FILTER_ALL, label: t('customerDisplay.defaultFilter.allOption') },
    ...statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label })),
  ]

  // Determine which description to show.
  let descriptionKey = 'customerDisplay.defaultFilter.autoHint'
  if (value != null && value !== STATUS_FILTER_ALL && !statusExists) {
    // Stored value no longer exists (not STATUS_FILTER_ALL, and not in lookup).
    descriptionKey = 'customerDisplay.defaultFilter.deletedHint'
  } else if (configured) {
    // Stored value exists (either STATUS_FILTER_ALL or a real status id).
    descriptionKey = 'customerDisplay.defaultFilter.chosenHint'
  }

  return (
    <SettingRow label={t('customerDisplay.defaultFilter.title')}
      description={t(descriptionKey)}>
      <div style={{ width: 220 }}>
        <SelectField value={effective} options={options} onChange={onChange} />
      </div>
    </SettingRow>
  )
}

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
 * tenant lookup". Rebuilt on the SAME `SettingRow` + `SelectMenu` every neighbouring
 * row in this exact screen already uses, so it reads as one more row, not a
 * separate widget. It also used to render an empty "not configured" state while the
 * live tab was, in fact, already filtering via the guess — a control that shows
 * nothing while something real is happening is a lie about the current state. It
 * now ALWAYS shows the value really in effect: the stored setting if one exists,
 * otherwise the exact guess `useStatusFilter` would apply today (or "All" if no
 * active-like status exists) — reusing `isActiveValue`, never a second copy of that
 * heuristic. A short line of text says whether that value was chosen or guessed.
 */
import { useTranslation } from 'react-i18next'
import SelectMenu from '@/components/ui/SelectMenu'
import { SettingRow } from './SettingsKit'
import { STATUS_FILTER_ALL, isActiveValue } from '@/components/drawer/StatusFilterSelect'

export default function DefaultStatusFilterPicker({ statuses, value, onChange }) {
  const { t } = useTranslation('settings')

  // The value ACTUALLY in effect today: a tenant-chosen one if saved, otherwise the
  // same guess useStatusFilter falls back to (or "all" when no active-like status
  // exists) — so the control never shows a state the tab itself is not really in.
  const configured = value != null
  const guessed = statuses.find(s => isActiveValue(s.value))
  const guessedValue = guessed ? String(guessed.id ?? guessed.value) : STATUS_FILTER_ALL
  const effective = configured ? value : guessedValue

  const options = [
    { value: STATUS_FILTER_ALL, label: t('customerDisplay.defaultFilter.allOption') },
    ...statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label })),
  ]

  return (
    <SettingRow label={t('customerDisplay.defaultFilter.title')}
      description={configured ? t('customerDisplay.defaultFilter.chosenHint') : t('customerDisplay.defaultFilter.autoHint')}>
      <div style={{ width: 220 }}>
        <SelectMenu value={effective} options={options} onChange={onChange} menuWidth={220}
          style={{ background: 'var(--surface)' }} />
      </div>
    </SettingRow>
  )
}

/**
 * FilterFieldPicker — the field + "Toon als" pair for one filter condition row
 * (Make-parity, FILTER-VELD-1). Wraps the house CreatableSelect (never forked —
 * §3A) fed with a flat, already-grouped-and-numbered option list, plus a small
 * SelectMenu that appends/strips the `|format` suffix the backend's FieldFormatter
 * already understands (Make's formatDate notation). `allowCreate` stays on so a
 * power user can still type an arbitrary dot-path the static catalog doesn't list
 * (a module without output_fields yet, or a nested path one level deeper).
 *
 * CreatableSelect only renders a flat label per option (no secondary hint slot),
 * so the backend catalog's `example`/inline-example text — when the label itself
 * carries one, e.g. "Datum (08-07-2026)" — rides along as part of that one label
 * rather than a separate muted hint; nothing to fork.
 */
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SelectMenu from '@/components/ui/SelectMenu'
import { splitFieldFormat, joinFieldFormat, DISPLAY_AS_OPTIONS } from './fieldFormat'

export interface FilterFieldPickerOption { value: string; label: string }

export function FilterFieldPicker({ value, onChange, options }: {
  value: string
  onChange: (next: string) => void
  options: FilterFieldPickerOption[]
}) {
  const { t } = useTranslation('workflows')
  const { path, format } = splitFieldFormat(value ?? '')

  // Field-path changes keep the current display-as suffix; format changes keep the path.
  const setPath = (next: string) => onChange(joinFieldFormat(next, format))
  const setFormat = (next: string) => onChange(joinFieldFormat(path, next))

  return (
    <div style={{ display: 'flex', gap: 4, flex: 1, minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <CreatableSelect value={path || undefined} options={options} onChange={setPath}
          placeholder={t('fields.fieldPlaceholder')} allowCreate menuWidth={280}
          style={{ padding: '6px 8px', fontSize: 12, borderRadius: 6 }} />
      </div>
      <div style={{ width: 108, flexShrink: 0 }}>
        <SelectMenu value={format} onChange={setFormat} menuWidth={150}
          placeholder={t('canvas.displayAsNone')}
          options={DISPLAY_AS_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))} />
      </div>
    </div>
  )
}

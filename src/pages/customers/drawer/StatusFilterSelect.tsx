/**
 * StatusFilterSelect — the ONE status filter next to a sub-entity list's search box
 * (Danny 28-07: "filteren op actieve status, in de zoekbalk iets kleiner en ernaast een
 * zoekbare dropdown"). Used by the locations, departments and contacts lists so all three
 * filter the same way.
 *
 * DEFAULTING IS THE DANGEROUS PART. Defaulting to "active only" before the lookup has
 * resolved, or against a value no row actually carries, hides EVERY row and reads as an
 * empty list — that exact bug once hid all vacancies. So `useDefaultStatus` only proposes
 * a default once the statuses are loaded AND at least one row really carries it; anything
 * else falls back to showing everything. It also proposes only ONCE, so a user who
 * deliberately picks "all" is not overruled on the next render.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import type { LookupOption } from '@/types/common'

export const ALL_STATUSES = '__all__'

// A row that carries a status — every sub-entity does, under the same two field names.
interface HasStatus { statusId?: unknown; status?: string }

/**
 * Owns the filter value and picks a sensible first one. Returns the value, its setter and
 * the already-filtered rows, so a caller cannot forget to apply it.
 */
export function useStatusFilter<T extends HasStatus>(rows: T[], statuses: LookupOption[]) {
  const [value, setValue] = useState<string>(ALL_STATUSES)
  const [proposed, setProposed] = useState(false)

  // The tenant's "active" status, whatever it is called — matched on the stable slug, not
  // on a label, because a tenant may rename it.
  const active = statuses.find(s => String(s.value ?? '').toLowerCase() === 'active'
    || String(s.value ?? '').toLowerCase() === 'actief')
  const key = (r: T) => String(r.statusId ?? r.status ?? '')
  const activeKey = active ? String(active.id ?? active.value) : ''

  // Propose "active only" ONCE, and only when it would actually show something.
  if (!proposed && statuses.length > 0 && rows.length > 0) {
    setProposed(true)
    if (activeKey && rows.some(r => key(r) === activeKey)) setValue(activeKey)
  }

  const filtered = value === ALL_STATUSES ? rows : rows.filter(r => key(r) === value)
  return { value, setValue, filtered }
}

export default function StatusFilterSelect({ value, onChange, statuses }: {
  value: string
  onChange: (v: string) => void
  statuses: LookupOption[]
}) {
  const { t } = useTranslation('customers')
  const options = [
    { value: ALL_STATUSES, label: t('filters.allStatuses') },
    ...statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label })),
  ]
  return (
    <div style={{ width: 170, flexShrink: 0 }} title={t('filters.statusFilter')}>
      <CreatableSelect value={value} onChange={v => onChange(v || ALL_STATUSES)} options={options}
        allowCreate={false} placeholder={t('filters.allStatuses')} menuWidth={190} />
    </div>
  )
}

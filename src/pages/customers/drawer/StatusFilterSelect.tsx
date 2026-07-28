/**
 * StatusFilterSelect — the ONE status filter next to a sub-entity list's search box
 * (Danny 28-07: "filteren op actieve status, in de zoekbalk iets kleiner en ernaast een
 * zoekbare dropdown"). Used by the locations, departments, contacts AND vacancies lists,
 * so all four filter the same way — Danny again: "vacature status is niet hetzelfde als
 * locatie status???".
 *
 * MULTI-VALUE, deliberately. Danny asked for that on the vacancy list earlier ("standaard
 * alleen open tonen, je moet meerdere kunnen kiezen"), so making everything single-value
 * would have removed something he explicitly wanted; the consistent direction is the other
 * way round. Nothing selected means "all", which is why there is no separate "all" option
 * that would have to be kept in sync with the real ones.
 *
 * DEFAULTING IS THE DANGEROUS PART. Defaulting to "active only" before the lookup has
 * resolved, or against a value no row actually carries, hides EVERY row and reads as an
 * empty list — that exact bug once hid all vacancies. So `useStatusFilter` only proposes a
 * default once the statuses are loaded AND at least one row really carries it, and it
 * proposes only ONCE, so a user who deliberately clears the filter is not overruled on the
 * next render.
 *
 * The trigger renders the exact box of the shared CreatableSelect — same padding, font and
 * muted chevron — so a filter standing beside those pickers is indistinguishable from them.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import SearchSelect from '@/components/ui/SearchSelect'
import type { LookupOption } from '@/types/common'

// A row that carries a status — every sub-entity does, under the same two field names.
interface HasStatus { statusId?: unknown; status?: unknown }

/** The stable slugs a tenant's "still relevant" status carries, whatever they named it. */
const isActiveValue = (v: unknown) => ['active', 'actief', 'open'].includes(String(v ?? '').toLowerCase())

/**
 * Owns the filter value and picks a sensible first one. Returns the value, its toggle and
 * the already-filtered rows, so a caller cannot forget to apply it.
 *
 * `keyOf` lets a caller say where the status lives on ITS row: most carry `statusId`, a
 * vacancy carries a `status` OBJECT. Without that the filter would compare a uuid to an
 * object and match nothing — silently, which is the whole failure mode this guards against.
 */
export function useStatusFilter<T extends HasStatus>(
  rows: T[],
  statuses: LookupOption[],
  keyOf: (row: T) => string = r => String(r.statusId ?? r.status ?? ''),
) {
  const [value, setValue] = useState<string[]>([])
  const [proposed, setProposed] = useState(false)

  const active = statuses.find(s => isActiveValue(s.value))
  const activeKey = active ? String(active.id ?? active.value) : ''

  // Propose "active only" ONCE, and only when it would actually show something.
  if (!proposed && statuses.length > 0 && rows.length > 0) {
    setProposed(true)
    if (activeKey && rows.some(r => keyOf(r) === activeKey)) setValue([activeKey])
  }

  const toggle = (v: string) => setValue(p => (p.includes(v) ? p.filter(x => x !== v) : [...p, v]))
  // Nothing selected = everything. A status deleted in Settings simply stops matching, so
  // no pruning pass is needed to keep rows from disappearing behind a dead value.
  const filtered = value.length === 0 ? rows : rows.filter(r => value.includes(keyOf(r)))
  return { value, setValue, toggle, filtered }
}

export default function StatusFilterSelect({ value, onToggle, statuses }: {
  value: string[]
  onToggle: (v: string) => void
  statuses: LookupOption[]
}) {
  const { t } = useTranslation('customers')
  const options = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  // One selected reads as that status; several read as a count — never a truncated list.
  const label = value.length === 0
    ? t('filters.allStatuses')
    : value.length === 1
      ? (options.find(o => o.value === value[0])?.label ?? t('filters.allStatuses'))
      : t('common:filters.selectedCount', { count: value.length })

  return (
    <div style={{ width: 170, flexShrink: 0 }}>
      <SearchSelect options={options} selected={value} onToggle={onToggle} menuAlign="right" width={190}
        triggerLabel={label}
        renderTrigger={(toggleOpen: () => void) => (
          <button type="button" onClick={toggleOpen} title={t('filters.statusFilter')} aria-haspopup="listbox"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', width: '100%',
              boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6,
              background: 'var(--surface)', cursor: 'pointer' }}>
            <span style={{ fontSize: 12, flex: 1, textAlign: 'left', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>{label}</span>
            <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        )} />
    </div>
  )
}

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
 *
 * TENANT-DEFAULT-1 (Danny 02-08): the "active only" guess above was always a heuristic on a
 * TENANT-RENAMEABLE lookup — a tenant who calls their status "In bedrijf" or "Lopend" never
 * matched `isActiveValue` and got no default at all, silently. Settings → Klanten → Tabelweergave
 * now lets a tenant configure the REAL default per tab (`STATUS_FILTER_ALL` or one specific
 * status id) via the optional `tenantDefault` param below. WHEN SET IT REPLACES THE GUESS
 * ENTIRELY — it is not layered on top — because a tenant who explicitly chose "all" must never
 * have the guess override that choice once rows/statuses resolve. The same guard principle
 * applies: a configured status id that no longer exists in the CURRENT lookup (renamed/deleted
 * since) is never applied — that would silently hide every row forever, the exact failure mode
 * the guess-heuristic guard exists to prevent. Absent `tenantDefault` (undefined) reproduces the
 * ORIGINAL guess behaviour byte-for-byte, so an existing tenant sees no change until it saves one.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import SearchSelect from '@/components/ui/SearchSelect'
import type { LookupOption } from '@/types/common'

// A row that carries a status — every sub-entity does, under the same two field names.
interface HasStatus { statusId?: unknown; status?: unknown }

/**
 * The stable slugs a tenant's "still relevant" status carries, whatever they named it.
 * Exported so Settings' `DefaultStatusFilterPicker` can show the SAME guess it would
 * fall back to today, instead of a second, drifting copy of this heuristic.
 */
export const isActiveValue = (v: unknown) => ['active', 'actief', 'open'].includes(String(v ?? '').toLowerCase())

/**
 * Sentinel tenant-default value meaning "all statuses, explicitly chosen" — distinct from
 * an ABSENT setting (which still means "use the active-only guess", §TENANT-DEFAULT-1).
 * Never a real status id, so it can never collide with one.
 */
export const STATUS_FILTER_ALL = 'all'

/**
 * Owns the filter value and picks a sensible first one. Returns the value, its toggle and
 * the already-filtered rows, so a caller cannot forget to apply it.
 *
 * `keyOf` lets a caller say where the status lives on ITS row: most carry `statusId`, a
 * vacancy carries a `status` OBJECT. Without that the filter would compare a uuid to an
 * object and match nothing — silently, which is the whole failure mode this guards against.
 *
 * `tenantDefault` is the Settings-configured default for THIS tab (§TENANT-DEFAULT-1):
 * `undefined` → fall back to the original active-only guess; `STATUS_FILTER_ALL` → explicit
 * "all", propose nothing, ever; any other string → a status id, applied once IF it still
 * exists in `statuses`, otherwise treated as "all" (never a phantom filter on a dead value).
 *
 * `settingsLoaded` guards a SECOND async race the tenant-default plumbing introduces: the
 * `/settings` blob that carries `tenantDefault` resolves independently from — and often
 * slower than — `statuses`/`rows`. Without this flag, a caller reading `tenantDefault` from
 * a not-yet-loaded settings blob would see `undefined` (indistinguishable from "genuinely no
 * setting saved"), the hook would immediately fall back to the guess, mark itself
 * `proposed`, and then ignore the REAL tenant default entirely once `/settings` actually
 * answers a moment later — a silent bug, caught by this feature's own test. Callers that
 * never pass a `tenantDefault` at all default this to `true`, so their behaviour is exactly
 * the original, unraced guess.
 *
 * `T` is deliberately UNCONSTRAINED (not `T extends HasStatus`). A row type that has no
 * `statusId`/`status` field at all — an Opportunity, which only carries a pipeline `stage` —
 * still needs this hook with its OWN `keyOf`. Constraining `T` to the all-optional `HasStatus`
 * made TS's weak-type check reject `Opportunity[]` outright ("no properties in common"), and
 * then fall back to inferring `T = HasStatus`, breaking a caller's own `keyOf` callback too.
 * The default `keyOf` below casts internally instead, so callers that DO carry `statusId`/
 * `status` (locations/departments/contacts) keep working unchanged via the same default.
 */
export function useStatusFilter<T>(
  rows: T[],
  statuses: LookupOption[],
  keyOf: (row: T) => string = r => String((r as HasStatus).statusId ?? (r as HasStatus).status ?? ''),
  tenantDefault?: string | null,
  settingsLoaded: boolean = true,
) {
  const [value, setValue] = useState<string[]>([])
  const [proposed, setProposed] = useState(false)

  const active = statuses.find(s => isActiveValue(s.value))
  const activeKey = active ? String(active.id ?? active.value) : ''

  // Propose the initial value ONCE the lookup (AND, if relevant, the tenant-default
  // settings blob) has resolved. A configured tenant default decides immediately (and
  // bypasses the guess for good); without one, fall back to the original guess — which
  // additionally waits for rows, so it never fires against an empty list before the real
  // row data has arrived (the exact bug this docblock warns about).
  if (!proposed && statuses.length > 0 && settingsLoaded) {
    if (tenantDefault != null) {
      setProposed(true)
      if (tenantDefault !== STATUS_FILTER_ALL) {
        // Only apply a specific tenant-chosen status if it still exists in the CURRENT
        // lookup — a renamed/deleted status must never filter to a value nothing can match.
        const stillExists = statuses.some(s => String(s.id ?? s.value) === tenantDefault)
        if (stillExists) setValue([tenantDefault])
      }
    } else if (rows.length > 0) {
      setProposed(true)
      if (activeKey && rows.some(r => keyOf(r) === activeKey)) setValue([activeKey])
    }
  }

  const toggle = (v: string) => setValue(p => (p.includes(v) ? p.filter(x => x !== v) : [...p, v]))
  // Nothing selected = everything. A status deleted in Settings simply stops matching, so
  // no pruning pass is needed to keep rows from disappearing behind a dead value.
  const filtered = value.length === 0 ? rows : rows.filter(r => value.includes(keyOf(r)))
  return { value, setValue, toggle, filtered }
}

export default function StatusFilterSelect({ value, onToggle, statuses, optionKey = s => String(s.id ?? s.value) }: {
  value: string[]
  onToggle: (v: string) => void
  statuses: LookupOption[]
  // How an option's own filter identity is derived from the lookup row (default: the
  // real backend id, falling back to its value slug) — Location/Department/Contact rows
  // carry a matching `statusId`, so the default keeps working unchanged. Opportunity rows
  // carry no stage id at all (§3B: stage/stageValue/stageColor only), so OpportunitiesTab
  // overrides this to key on `value` instead, matching its own row-side `stageValue`.
  optionKey?: (s: LookupOption) => string
}) {
  const { t } = useTranslation('customers')
  const options = statuses.map(s => ({ value: optionKey(s), label: s.label }))
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

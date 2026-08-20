/**
 * StatusFilterSelect — the ONE status filter next to a sub-entity list's search box
 * (Danny 28-07: "filteren op actieve status, in de zoekbalk iets kleiner en ernaast een
 * zoekbare dropdown"). Used by the locations, departments, contacts, vacancies, matches
 * AND tasks lists, so all filter the same way — Danny again: "vacature status is niet
 * hetzelfde als locatie status???".
 *
 * MOVED (Danny 03-08, TAKEN-TOOLBAR-1): was `pages/customers/drawer/StatusFilterSelect`;
 * promoted to `components/drawer/` because the shared `EntityTasksTab` (also used by
 * opportunities/contacts) needed the same filter and a `components/` file must never
 * import an entity page's internals (§2). Pure move — every importer updated, behaviour
 * byte-identical; `pages/customers/drawer/StatusFilterSelect.tsx` now only re-exports
 * from here so a file locked by another lane never had to change.
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
import SearchSelect from '@/components/ui/SearchSelect'
// HUISSTIJL-1: the ONE trio-tinted filter trigger face (§4 tint-vs-trio law).
import FilterTriggerPill from '@/components/ui/FilterTriggerPill'
import type { LookupOption } from '@/types/common'

// A row that carries a status — every sub-entity does, under the same two field names.
interface HasStatus { statusId?: unknown; status?: unknown }

/**
 * The stable slugs a tenant's "still relevant" status carries, whatever they named it.
 * Exported so Settings' `DefaultStatusFilterPicker` can show the SAME guess it would
 * fall back to today, instead of a second, drifting copy of this heuristic.
 */
// eslint-disable-next-line react-refresh/only-export-components -- shared heuristic consumed by Settings' DefaultStatusFilterPicker (one source, no drifting copy); HMR-nicety only
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
 *
 * `guessDefault` (K2-FE, 13-08): an optional MULTI-value replacement for the single-value
 * `isActiveValue` slug guess above. The original guess only ever matches a status literally
 * named "active"/"actief"/"open" — a lookup whose values are UUIDs (vacancy statuses since
 * 28-07) never matches it, so the tab silently fell back to showing everything. When a
 * caller passes `guessDefault`, it is called with the resolved `statuses` and must return the
 * KEYS that should be selected by default (e.g. every not-`is_closed` status); those keys are
 * still filtered down to ones at least one row actually carries, the same "never hide
 * everything against a phantom value" guard the single-value guess already applies. Callers
 * that don't pass it keep the original single-value behaviour byte-for-byte.
 *
 * `alwaysMatch` (K2-FE, 13-08): an optional predicate for rows that must pass the status
 * filter NO MATTER what is selected — the BE's "a vacancy without a status stays eligible"
 * rule (CustomerController::open_vacancies_count / VacancyStatus::excludeClosed) has no
 * lookup value to select in the first place, so a status-less row can never be represented
 * by a key in `value`. Without this, a status-less row's `keyOf` returns `''`, which matches
 * no selected id, so it silently vanished from the "open" default the moment the guess
 * proposed a non-empty selection — the exact gap this predicate closes. Callers that don't
 * pass it keep the original behaviour (a status-less row only shows while nothing is selected).
 */
// eslint-disable-next-line react-refresh/only-export-components -- the filter hook lives beside its trigger component by design (one seam); HMR-nicety only
export function useStatusFilter<T>(
  rows: T[],
  statuses: LookupOption[],
  keyOf: (row: T) => string = r => String((r as HasStatus).statusId ?? (r as HasStatus).status ?? ''),
  tenantDefault?: string | null,
  settingsLoaded: boolean = true,
  guessDefault?: (statuses: LookupOption[]) => string[],
  alwaysMatch?: (row: T) => boolean,
  // strictGuess: apply guessDefault from the LOOKUP alone — no waiting for rows and
  // no row-intersection. For flag-derived guesses (e.g. "every NOT-is_closed status")
  // an empty result list is a CORRECT answer (a customer whose vacancies are all
  // closed must show 0, matching its open_vacancies_count of 0); the row-intersection
  // below exists only to protect name-based guesses from hiding every row.
  strictGuess: boolean = false,
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
    } else if (strictGuess && guessDefault) {
      // Flag-derived guess: the lookup alone decides; zero matching rows is honest.
      setProposed(true)
      const keys = guessDefault(statuses)
      if (keys.length) setValue(keys)
    } else if (rows.length > 0) {
      setProposed(true)
      // Multi-value guess (e.g. "all not-closed" statuses) when the caller supplies one;
      // still guarded to keys at least one row carries, so a renamed/removed status can
      // never propose a default that hides every row.
      if (guessDefault) {
        const keys = guessDefault(statuses).filter(k => rows.some(r => keyOf(r) === k))
        if (keys.length) setValue(keys)
      } else if (activeKey && rows.some(r => keyOf(r) === activeKey)) setValue([activeKey])
    }
  }

  const toggle = (v: string) => setValue(p => (p.includes(v) ? p.filter(x => x !== v) : [...p, v]))
  // Nothing selected = everything. A status deleted in Settings simply stops matching, so
  // no pruning pass is needed to keep rows from disappearing behind a dead value. A row
  // matched by `alwaysMatch` (e.g. status-less) bypasses the selection entirely.
  const filtered = value.length === 0 ? rows : rows.filter(r => alwaysMatch?.(r) || value.includes(keyOf(r)))
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
  // Kept as the SearchSelect's own internal triggerLabel fallback (a11y text the
  // component may fall back to) — the visible face is the trio pill below, which
  // reads "Status · N" instead of the previously truncated single-status name.
  const label = value.length === 0
    ? t('filters.allStatuses')
    : value.length === 1
      ? (options.find(o => o.value === value[0])?.label ?? t('filters.allStatuses'))
      : t('common:filters.selectedCount', { count: value.length })

  return (
    // TOOLBAR-WIDTH-1 → superseded (Danny 20-08, screenshot: "spacing tussen
    // status en andere knopje is groter dan bij filter en nieuw"): the old
    // minWidth 96 belonged to the CALM FIELD face, which filled its wrapper.
    // The trio pill sizes to its own content, so leftover wrapper width rendered
    // as phantom space beside the pill — the toolbar gap looked bigger than the
    // Filter/Nieuw gaps in the sibling tabs. The wrapper now shrink-wraps; the
    // MENU keeps its own width via SearchSelect below, so long options stay legible.
    <div style={{ flexShrink: 0 }}>
      <SearchSelect options={options} selected={value} onToggle={onToggle} menuAlign="right" width={190}
        triggerLabel={label}
        // HUISSTIJL-1: the trio pill (§4 tint-vs-trio law) replaces the calm
        // bordered box — same toggle/aria-haspopup, only the face changes, so
        // every one of this component's ~9 consumers picks it up at once.
        renderTrigger={(toggleOpen: () => void) => (
          // Zero-chrome wrapper: the visual identity is FilterTriggerPill inside;
          // the button only carries click/aria. Block form: the style attr spans the tag.
          /* eslint-disable huisstijlLegacy/no-restricted-syntax */
          <button type="button" onClick={toggleOpen} title={t('filters.statusFilter')} aria-haspopup="listbox"
            style={{ background: 'none', border: 'none', padding: 0 }}>
            <FilterTriggerPill label={t('filters.status')} count={value.length} />
          </button>
          /* eslint-enable huisstijlLegacy/no-restricted-syntax */
        )} />
    </div>
  )
}

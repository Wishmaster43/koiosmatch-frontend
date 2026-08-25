/**
 * useRelationSort — ONE shared sort control for every Background sub-tab list
 * (experience, education, certifications, skills, references). Danny asked for
 * "an icon with a submenu: start date, end date, function, and my own order"
 * (2026-08-17, with a reference screenshot), saved per sub-tab per user. This
 * hook renders that ONE menu (the shared ActionMenu, icon-only) and every
 * sub-tab reuses it — never a per-tab fork or a hand-rolled dropdown.
 *
 * SORT VOCABULARY — 'startDate' | 'endDate' | 'function' | 'own'. A caller
 * passes an accessor (+ an optional label override) for whichever of the first
 * three exist on its own rows; omitting an accessor omits that menu entry
 * entirely — never an option that would sort a field that is always empty
 * there. Each SectionTabs.tsx / ReferencesTab.tsx call site documents WHICH
 * axes it offers and why, right next to the accessors (its own "notes").
 *
 * OWN ORDER (DRAG-SORT-1, shipped 2026-08-17) — the fourth axis is structural,
 * not an accessor: pass `ownOrder: true` once the relation's backend carries a
 * `sort_order` column + `PUT .../reorder` route (all five candidate sub-lists do
 * — verified against routes/api/tenant/candidates.php). Unlike the other three
 * axes this one needs NO client comparator: the backend already orders its GET
 * by `sort_order` (Candidate::orderedSubEntities), so the array a caller's
 * `items` already arrived in IS the current manual order — 'own' just means
 * "render the received order, don't re-sort it" (see `order` below: identity,
 * no getter). The actual DRAG that changes that order lives one layer up
 * (AddableSection's `dragEnabled`/`onReorder`, wired from BackgroundTab's real
 * `PUT /candidates/{id}/{relation}/reorder`) — this hook only decides WHETHER
 * that mode is active (`isOwnOrder`) and remembers the CHOICE, never the order
 * itself (see PERSISTENCE below).
 *
 * PERSISTENCE — every sub-tab's sort is saved through the user's own
 * `ui_preferences` blob (PUT /auth/me — confirmed against
 * AuthController::updateMe + the `users` migration, 2026-08-17). All five
 * sub-tabs share ONE clearly-named top-level key, `candidate_background_sort`,
 * internally keyed by `storageKey` (one slice per sub-tab) — see
 * useUserPreference (src/hooks) for the read-once / fail-quiet contract.
 * Only the CHOSEN AXIS is a per-user preference here (including picking
 * 'own'); the manual ORDER itself is a property of the record — same for every
 * viewer — and is persisted separately, through the candidate's own reorder
 * route, never through this blob.
 *
 * PINNED/AUTOMATED ROWS — candidate_work_experiences carries a nullable
 * `match_id`: a row a workflow auto-created from a Hired match. It gets no
 * special treatment here — it still carries a real `start_date`, so a date
 * sort places it honestly instead of hiding or silently pinning it. An
 * auto-created row's OWN position (HasManualOrder: next free slot, i.e. the
 * bottom) is a backend invariant, not something this hook computes.
 */
import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'
import { useUserPreference } from '@/hooks/useUserPreference'

type SortField = 'startDate' | 'endDate' | 'function' | 'own'
type SortDir = 'asc' | 'desc'
interface SortState { field: SortField; dir: SortDir }

// The ONE ui_preferences key every Background sub-tab's sort shares (file
// header) — a map of storageKey -> that sub-tab's own current sort (or null).
const PREFERENCE_KEY = 'candidate_background_sort'
type SortPreferenceMap = Record<string, SortState | null>

interface UseRelationSortOptions<T> {
  // Stable id for the list (e.g. 'experience') — also the slice key inside the
  // shared ui_preferences map above.
  storageKey: string
  // Omit an accessor when the sub-tab has nothing meaningful on that axis — the
  // menu then never offers it (see the file header + each call site's notes).
  startDateOf?: (item: T) => string | null | undefined
  startDateLabel?: string
  endDateOf?: (item: T) => string | null | undefined
  endDateLabel?: string
  functionOf?: (item: T) => string | null | undefined
  functionLabel?: string
  // Structural, not an accessor (file header, OWN ORDER): true once the
  // relation's backend carries `sort_order` + a `PUT .../reorder` route. Omit
  // for any future caller that doesn't have that yet — same "never offer an
  // option with nothing real behind it" rule the other three axes already follow.
  ownOrder?: boolean
  ownOrderLabel?: string
}

interface UseRelationSortResult {
  // Original indices into the source array, in the order to RENDER them.
  // Callers pass this straight into AddableSection's `order` prop — the real
  // index is preserved so edit/remove never target the wrong row (§3).
  order: number[]
  control: ReactNode
  // True while 'own' is the active axis — the ONLY moment drag handles/keyboard
  // reorder should render (build brief #2): sorting by date and then dragging
  // would be meaningless, since the very next render re-sorts it away.
  isOwnOrder: boolean
}

// Missing values always sink to the bottom regardless of direction, instead of
// being placed by comparing against undefined/empty string.
const isMissing = (v: unknown): boolean => v === undefined || v === null || v === ''
// Date-ish axes default to newest-first (a CV-like "most recent on top"); the
// alphabetic 'function' axis defaults A→Z. 'own' has no direction (never called
// for it — see toggle() below).
const defaultDir = (field: SortField): SortDir => (field === 'function' ? 'asc' : 'desc')

export function useRelationSort<T>(items: T[], opts: UseRelationSortOptions<T>): UseRelationSortResult {
  const { t } = useTranslation('candidates')
  const { storageKey, startDateOf, startDateLabel, endDateOf, endDateLabel, functionOf, functionLabel, ownOrder, ownOrderLabel } = opts

  // ONE shared preference object across every sub-tab; this hook instance only
  // ever reads/writes its own `storageKey` slice.
  const [allSorts, setAllSorts] = useUserPreference<SortPreferenceMap>(PREFERENCE_KEY, {})

  // ACHTERGROND-DATUM-STANDAARD-1 (Danny 17-08: "standaard op datum dus laatste
  // werkervaring boven" — "sorted by date by default, so the latest work
  // experience on top"). A list that carries dates opens newest-first, the way a
  // CV reads, without anyone having to pick it. This needs no stored order at all,
  // which is exactly Danny's point: it is computed from dates the record already
  // has. A column in the database is only needed for the OTHER case, someone
  // deliberately overriding that order by hand.
  //
  // Start date is the axis, not end date: a job still running has no end date, and
  // sorting on a missing value would push the current job to the bottom, which is
  // the opposite of what "most recent on top" means.
  //
  // On a dated list the default is not "no sort" but a REAL sort, so cycling an
  // axis off returns to newest-first rather than to the raw order the server
  // happened to send. That raw order is insertion order, which a user cannot
  // explain and never asked for, so offering it as a third state would only be
  // confusing. On a list without dates there is no default, and cycling off still
  // means the received order.
  // (When a stored manual order lands, IT becomes the meaningful third state and
  // takes this fallback's place. That is the single follow-up entry.)
  const fallback: SortState | null = startDateOf ? { field: 'startDate', dir: 'desc' } : null
  const state = allSorts[storageKey] ?? fallback

  const fields = useMemo(() => {
    const list: { field: SortField; label: string }[] = []
    if (startDateOf) list.push({ field: 'startDate', label: startDateLabel ?? t('addFields.startDate') })
    if (endDateOf)   list.push({ field: 'endDate',   label: endDateLabel   ?? t('addFields.endDate') })
    if (functionOf)  list.push({ field: 'function',  label: functionLabel  ?? t('addFields.functionTitle') })
    // Own order always sits last (Danny's own phrasing: "…and my own order").
    if (ownOrder)    list.push({ field: 'own',       label: ownOrderLabel  ?? t('addFields.ownOrder') })
    return list
  }, [startDateOf, startDateLabel, endDateOf, endDateLabel, functionOf, functionLabel, ownOrder, ownOrderLabel, t])

  const isOwnOrder = state?.field === 'own'

  const order = useMemo(() => {
    const idx = items.map((_, i) => i)
    // 'own' has no client comparator (file header, OWN ORDER) — the received
    // array order already IS the manual order (the backend orders its GET by
    // sort_order), so this is deliberately the identity mapping, never a sort.
    if (!state || state.field === 'own') return idx
    const getter = state.field === 'startDate' ? startDateOf : state.field === 'endDate' ? endDateOf : functionOf
    idx.sort((ia, ib) => {
      const av = getter?.(items[ia]), bv = getter?.(items[ib])
      const aMissing = isMissing(av), bMissing = isMissing(bv)
      if (aMissing && bMissing) return 0
      if (aMissing) return 1
      if (bMissing) return -1
      const cmp = state.field === 'function'
        ? String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })
        : Date.parse(String(av)) - Date.parse(String(bv))
      return state.dir === 'asc' ? cmp : -cmp
    })
    return idx
  }, [items, state, startDateOf, endDateOf, functionOf])

  // Click cycle per axis: off → default dir → opposite dir → off (back to the
  // received order). Picking a DIFFERENT axis always restarts at its default.
  // 'own' has no direction to cycle through — a second click on it just turns
  // it back off, mirroring the two-state toggle a checkbox would give it.
  const toggle = useCallback((field: SortField) => {
    const next: SortState | null =
      !state || state.field !== field ? { field, dir: field === 'own' ? 'asc' : defaultDir(field) }
      : field === 'own' ? null
      : state.dir === defaultDir(field) ? { field, dir: state.dir === 'asc' ? 'desc' : 'asc' }
      : null
    setAllSorts({ ...allSorts, [storageKey]: next })
  }, [allSorts, setAllSorts, storageKey, state])

  if (fields.length === 0) return { order, control: null, isOwnOrder: false }

  // One leaf action per offered axis — ArrowUpDown when idle, an explicit
  // Up/Down once it is the active date/function axis, GripVertical for 'own'
  // (never colour as the only signal, §6: the label text plus the icon shape
  // both carry the state).
  const menuItems: MenuNode[] = fields.map(({ field, label }) => {
    const dir = state?.field === field ? state.dir : null
    const icon = field === 'own' ? GripVertical : dir ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
    return { key: field, label, icon, onSelect: () => toggle(field) }
  })

  const control = (
    <ActionMenu icon={ArrowUpDown} iconOnly ariaLabel={t('sections.sortLabel')}
      items={menuItems} align="right" menuWidth={200} highlighted={!!state} />
  )

  return { order, control, isOwnOrder }
}

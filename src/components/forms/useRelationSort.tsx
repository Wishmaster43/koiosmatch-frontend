/**
 * useRelationSort — ONE shared sort control for every Background sub-tab list
 * (experience, education, certifications, skills, references). Danny asked for
 * "an icon with a submenu: start date, end date, function, and my own order"
 * (2026-08-17, with a reference screenshot), saved per sub-tab per user. This
 * hook renders that ONE menu (the shared ActionMenu, icon-only) and every
 * sub-tab reuses it — never a per-tab fork or a hand-rolled dropdown.
 *
 * SORT VOCABULARY — exactly three axes, and only the ones a sub-tab can really
 * serve: 'startDate' | 'endDate' | 'function'. A caller passes an accessor
 * (+ an optional label override) for whichever of the three exist on its own
 * rows; omitting an accessor omits that menu entry entirely — never an option
 * that would sort a field that is always empty there. Each SectionTabs.tsx /
 * ReferencesTab.tsx call site documents WHICH axes it offers and why, right
 * next to the accessors (its own "notes").
 *
 * OWN ORDER — deliberately not a fourth axis here. candidate_work_experiences/
 * _educations/_certifications/_skills/candidate_references have no `sort_order`
 * column and no `POST .../reorder` route today (verified against
 * routes/api/tenant/candidates.php and the five create-table migrations,
 * 2026-08-17) — the backend is adding both, but only after a `migrate:fresh`
 * Danny runs himself. Shipping a drag handle before that lands would be a fake
 * affordance (§3): it would 500, not sort. FOLLOW-UP (the one step once the
 * column + route exist): add ONE more entry to a call site's `fields`-shaping —
 * an `'own'` axis whose order comes from the row's own `sort_order`, not a
 * client comparator — the menu, the persistence key and the toggle plumbing
 * below already generalise to it; nothing else changes.
 *
 * PERSISTENCE — every sub-tab's sort is saved through the user's own
 * `ui_preferences` blob (PUT /auth/me — confirmed against
 * AuthController::updateMe + the `users` migration, 2026-08-17). All five
 * sub-tabs share ONE clearly-named top-level key, `candidate_background_sort`,
 * internally keyed by `storageKey` (one slice per sub-tab) — see
 * useUserPreference (src/hooks) for the read-once / fail-quiet contract.
 *
 * PINNED/AUTOMATED ROWS — candidate_work_experiences carries a nullable
 * `match_id`: a row a workflow auto-created from a Hired match. It gets no
 * special treatment here — it still carries a real `start_date`, so a date
 * sort places it honestly instead of hiding or silently pinning it.
 */
import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'
import { useUserPreference } from '@/hooks/useUserPreference'

type SortField = 'startDate' | 'endDate' | 'function'
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
}

interface UseRelationSortResult {
  // Original indices into the source array, in the order to RENDER them.
  // Callers pass this straight into AddableSection's `order` prop — the real
  // index is preserved so edit/remove never target the wrong row (§3).
  order: number[]
  control: ReactNode
}

// Missing values always sink to the bottom regardless of direction, instead of
// being placed by comparing against undefined/empty string.
const isMissing = (v: unknown): boolean => v === undefined || v === null || v === ''
// Date-ish axes default to newest-first (a CV-like "most recent on top"); the
// alphabetic 'function' axis defaults A→Z.
const defaultDir = (field: SortField): SortDir => (field === 'function' ? 'asc' : 'desc')

export function useRelationSort<T>(items: T[], opts: UseRelationSortOptions<T>): UseRelationSortResult {
  const { t } = useTranslation('candidates')
  const { storageKey, startDateOf, startDateLabel, endDateOf, endDateLabel, functionOf, functionLabel } = opts

  // ONE shared preference object across every sub-tab; this hook instance only
  // ever reads/writes its own `storageKey` slice. Default `{}` — nobody's view
  // changes until a user actually picks a sort (untouched sub-tabs stay null).
  const [allSorts, setAllSorts] = useUserPreference<SortPreferenceMap>(PREFERENCE_KEY, {})
  const state = allSorts[storageKey] ?? null

  const fields = useMemo(() => {
    const list: { field: SortField; label: string }[] = []
    if (startDateOf) list.push({ field: 'startDate', label: startDateLabel ?? t('addFields.startDate') })
    if (endDateOf)   list.push({ field: 'endDate',   label: endDateLabel   ?? t('addFields.endDate') })
    if (functionOf)  list.push({ field: 'function',  label: functionLabel  ?? t('addFields.functionTitle') })
    return list
  }, [startDateOf, startDateLabel, endDateOf, endDateLabel, functionOf, functionLabel, t])

  const order = useMemo(() => {
    const idx = items.map((_, i) => i)
    if (!state) return idx
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
  const toggle = useCallback((field: SortField) => {
    const next: SortState | null =
      !state || state.field !== field ? { field, dir: defaultDir(field) }
      : state.dir === defaultDir(field) ? { field, dir: state.dir === 'asc' ? 'desc' : 'asc' }
      : null
    setAllSorts({ ...allSorts, [storageKey]: next })
  }, [allSorts, setAllSorts, storageKey, state])

  if (fields.length === 0) return { order, control: null }

  // One leaf action per offered axis — ArrowUpDown when idle, an explicit
  // Up/Down once it is the active axis (never colour as the only signal, §6:
  // the label text plus the icon shape both carry the state).
  const menuItems: MenuNode[] = fields.map(({ field, label }) => {
    const dir = state?.field === field ? state.dir : null
    return { key: field, label, icon: dir ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown, onSelect: () => toggle(field) }
  })

  const control = (
    <ActionMenu icon={ArrowUpDown} iconOnly ariaLabel={t('sections.sortLabel')}
      items={menuItems} align="right" menuWidth={200} highlighted={!!state} />
  )

  return { order, control }
}

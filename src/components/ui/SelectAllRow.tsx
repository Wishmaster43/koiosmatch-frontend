/**
 * SelectAllRow — the ONE "select all / clear all" action above a MULTI-select
 * option list (Danny 08-08, punt 7: "select all in alle zoekbare dropdowns zoals
 * functies etc." — until now every checkbox had to be ticked one by one).
 *
 * SCOPE IS WHAT YOU SEE. It acts on the VISIBLE (already search-filtered) options
 * only, never on the whole vocabulary: filtering on "verpleeg" and hitting select-all
 * gives you those matches, not 400 functions. The count rendered in the row makes that
 * scope visible, so the action can never surprise you.
 *
 * Dumb UI (§2): it owns no selection state and no business logic — hosts pass the
 * visible values, the current selection and one apply callback. MULTI-select only;
 * a single-choice dropdown never renders it (no meaning there, §3).
 */
import { useTranslation } from 'react-i18next'
import { CheckCheck, Eraser } from 'lucide-react'

// Rendered height of the default (non-dense) row: 6px padding + 26px button +
// 6px padding + 1px border. Hosts that cap their own list height subtract this
// (SearchSelect's portal menu) so adding the row never clips the last option.
export const SELECT_ALL_ROW_HEIGHT = 39

interface SelectAllRowProps<T extends string | number> {
  // The option values currently VISIBLE in the list (already search-filtered).
  visibleValues: T[]
  // The host's current selection — may hold values that are filtered out right now.
  selectedValues: Array<string | number>
  // Applies the batch: the values whose state must FLIP, plus whether we are
  // selecting (true) or clearing (false).
  onApply: (values: T[], select: boolean) => void
  // Compact spacing for narrow hosts (drawer filter panel, report filter sidebar).
  dense?: boolean
  // ARIA role override for the button — a `role="menu"` panel (ActionMenu) may only
  // contain menu-role children, so a plain button role would be invalid there (§6).
  role?: string
  // Marks the button as part of a host's roving keyboard navigation (ActionMenu
  // collects its arrow-key targets via [data-menuitem]).
  menuItem?: boolean
}

export default function SelectAllRow<T extends string | number>({
  visibleValues, selectedValues, onApply, dense = false, role, menuItem = false,
}: SelectAllRowProps<T>) {
  const { t } = useTranslation('common')

  // Nothing visible (empty vocabulary, or a search with no hits) — no affordance at all (§3).
  if (visibleValues.length === 0) return null

  // "All selected" is measured against the VISIBLE set, so the row flips to "clear"
  // exactly when every option you can currently see is already ticked.
  const selectedSet = new Set(selectedValues.map(String))
  const missing = visibleValues.filter(v => !selectedSet.has(String(v)))
  const allSelected = missing.length === 0
  // Only the values that actually change state are handed to the host — toggling an
  // already-correct value would flip it back off.
  const changing = allSelected ? visibleValues : missing

  return (
    <div style={{
      padding: dense ? '0 0 4px' : '6px 10px',
      borderBottom: dense ? 'none' : '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      {/* One real button (§6: role + name come from the element and its text), sitting
          right after the search box in the tab order. mousedown is prevented so the
          click never steals focus from that search box — and so hosts that close their
          dropdown on blur (workflow MultiSelectField) do not close before the click. */}
      <button type="button" role={role} data-menuitem={menuItem ? '' : undefined}
        onMouseDown={e => e.preventDefault()}
        onClick={() => onApply(changing, !allSelected)}
        title={t('multiSelect.visibleHint', { count: visibleValues.length })}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%', height: 26,
          padding: '0 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
          color: 'var(--color-primary-text)',
          background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
        }}>
        {allSelected ? <Eraser size={12} aria-hidden="true" /> : <CheckCheck size={12} aria-hidden="true" />}
        <span style={{ flex: 1, textAlign: 'left' }}>
          {allSelected ? t('multiSelect.clearVisible') : t('multiSelect.selectVisible')}
        </span>
        {/* The scope, in numbers — part of the accessible name on purpose: "how many
            am I about to affect" is the whole point of the filtered-scope rule. The
            parentheses are not decoration: a bare count would read as (and, in tests,
            match as) one of the app's standalone count badges. */}
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, fontWeight: 600 }}>
          ({visibleValues.length})
        </span>
      </button>
    </div>
  )
}

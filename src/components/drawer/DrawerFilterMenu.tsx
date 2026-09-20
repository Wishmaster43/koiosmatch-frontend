/**
 * DrawerFilterMenu — the one shared "Filter" trigger + popover for a drawer
 * sub-tab toolbar (notes, documents, tasks, …). Declares its rows as a
 * `filters: DrawerFilterConfig[]` config array instead of `children`, so this
 * component owns the recurring bookkeeping (active-count badge, clear-all)
 * generically instead of every host wiring it by hand. See the full doc
 * comment on the default export below for the design rationale.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { SlidersHorizontal, RotateCcw } from 'lucide-react'
import SelectMenu from '@/components/ui/SelectMenu'
import Button from '@/components/ui/Button'
import CountBadge from '@/components/ui/CountBadge'
// PORTAL-MARKER-1: a click inside an open portalled picker menu is never "outside".
import { isInsideDropdownPortal } from '@/lib/useDropdownPlacement'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { Z } from '@/lib/zIndexScale'
import { DrawerMultiFilterRow, DrawerRangeFilterRow, DrawerToggleFilterRow, DrawerDateFilterRow } from './drawerFilterRows'
import type { DrawerFilterConfig } from './drawerFilterTypes'
export type { DrawerFilterOption, DrawerFilterConfig, DrawerSingleFilterConfig, DrawerMultiFilterConfig, DrawerRangeFilterConfig, DrawerDateFilterConfig, DrawerToggleFilterConfig } from './drawerFilterTypes'

// FILTER-WIDTH-1 (Danny 08-08, point 13: "the notes filter must be longer" + point 18:
// "the filter on documents is too short, making it hard to filter properly"): the panel
// used to be 230px, so a real tenant lookup label ("Verklaring Omtrent het Gedrag",
// "WhatsApp Business", "Intakegesprek ingepland") was cut off in the trigger AND in
// the checklist — you could not tell two values apart before picking one. Sized ONCE
// here so every drawer host (notes · documents · tasks, on candidates · customers ·
// vacancies · tasks) widens at the same moment; never a per-page override (§4).
// NARROW AND TALL (Danny 09-08, explicit: "it's not about the width, it's about the
// height, so make it narrower and taller"). Earlier rounds kept widening this panel —
// wrong axis. A filter list is scanned VERTICALLY: you want many values in view at
// once, in a column that stays out of the way of the drawer content behind it.
// So the panel is narrower than it ever was, and the list is more than twice as tall.
const PANEL_WIDTH = 260
// Inner content width: panel − 2×1px border − 2×10px padding. Handed to the nested
// dropdown as its menuWidth so its option list is never narrower than its trigger.
const CONTROL_WIDTH = PANEL_WIDTH - 22

interface DrawerFilterMenuProps {
  filters: DrawerFilterConfig[]
  // Button visible text + accessible name — host supplies its own translated
  // string (§5, mirrors ChangelogPopover/QuickViewToggle: no strings live here).
  label: string
  // Panel header title (already translated).
  title: string
  // Clear-all icon button's tooltip/aria-label (already translated).
  clearAllLabel: string
}

/**
 * DrawerFilterMenu — the ONE shared "Filter" button + popover for drawer sub-tab
 * toolbars (NOTES-DOC-FILTER-MENU-1, Danny 08-08: "toolbar leest te druk" — the
 * notes type/channel filters and the documents type filter were added INLINE next
 * to the search box and read as clutter). Pulls every such filter behind one
 * compact button, mirroring the list pages' own right-hand filter panel
 * (RightPanelContext / ReportFilterSidebar / DashboardLayout's SlidersHorizontal
 * button + count badge) at drawer-sub-tab scale — same icon language, same
 * "badge count on the trigger" idiom, just anchored under the button instead of
 * docked to the page edge (a drawer sub-tab has no page edge to dock to).
 *
 * TASK-FILTER-MENU-1 (Danny 08-08: "so notes everywhere with that filter, and
 * do tasks too"): extended to also carry MULTI-select rows (task status/type/
 * priority — EntityTasksTab, RelatedTasks), so one shell now serves both the
 * single-value dropdowns (notes/documents) and the multi-value checklists
 * (tasks) — see DrawerFilterConfig's two variants below.
 *
 * API CHOICE — a declarative `filters: DrawerFilterConfig[]` array, not `children`.
 * Every current + foreseeable drawer filter is one of two SHAPES: a single house
 * searchable dropdown ('' = all) or a multi-select checklist (selected[] + toggle)
 * — exactly the FilterGroup convention this codebase already uses for the list
 * pages' right-hand panel. A config array lets THIS component own the two
 * behaviours that matter — the active-count badge and "clear all" — generically
 * (sum/loop over `filters`), so no host computes or wires them by hand. A
 * `children` API would push that bookkeeping back onto every caller (an explicit
 * `activeCount` + `onClearAll` prop) for zero real flexibility gain.
 *
 * VISIBILITY CHOICE — active filters surface via the button's count badge + the
 * open panel (which shows every checked value directly), not removable chips
 * under the toolbar. Chips-under-toolbar would reintroduce exactly the clutter
 * this component exists to remove; the badge is the "at a glance" signal, and the
 * panel (one click away) is where a filter is actually read or cleared. Identical
 * across every host — never a per-host restyle.
 *
 * FILTER-WIDTH-1 (Danny 08-08, points 13 + 18: "the notes filter must be longer",
 * "the filter on documents is too short, making it hard to filter properly"): the panel
 * and its controls are sized by the constants at the top of this file — widened
 * once HERE so notes, documents and tasks in every drawer (candidate · customer ·
 * vacancy · task) get it together, and long lookup labels wrap instead of being cut.
 *
 * Closing: outside click (this file) + Escape + Tab-trap + focus-restore-to-the-
 * button (all via the shared `useFocusTrap`, §6 — mirrors ChangelogPopover). A
 * SelectMenu opened INSIDE the panel closes on its own Escape press first — both
 * it and this panel register as layers on the shared `useEscapeLayer` stack
 * (TRIAGE-3.3), and only the TOP layer closes — so a second Escape then closes
 * this panel. The multi-select checklist above needs no such handling: it is
 * plain inline markup, never a second popover.
 */
export default function DrawerFilterMenu({ filters, label, title, clearAllLabel }: DrawerFilterMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const panelRef = useFocusTrap<HTMLDivElement>(() => setOpen(false))

  // Close on outside click while open — mirrors ChangelogPopover's own convention.
  useEffect(() => {
    if (!open) return
    // Ignore a click inside the panel, the date-picker portal, or any other
    // portalled picker menu; anything else counts as outside and closes the panel.
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (wrapRef.current && wrapRef.current.contains(target)) return
      // DATE-PORTAL-1: a 'date' row's DatePicker paints into the fixed
      // #datepicker-portal DOM node (a body-level sibling of #root, index.html),
      // OUTSIDE this panel's own subtree — without this check, every day-cell
      // click reads as "outside" and closes the panel before onChange registers
      // (same class of bug the multi-select row's non-portal design avoids above).
      const portal = document.getElementById('datepicker-portal')
      if (portal && portal.contains(target)) return
      // PORTAL-MARKER-1: same class, generalised — a select row's portalled menu
      // (SelectMenu/CreatableSelect/SearchSelect) is "inside" too.
      if (isInsideDropdownPortal(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // No filters offered at all (host renders no vocabulary yet) — no fake affordance (§3).
  if (filters.length === 0) return null

  // Active count: a single row contributes at most 1 ('' = inactive); a multi row
  // contributes its selected COUNT — mirrors ReportFilterSidebar's own
  // groupActiveCount convention, so the badge reads the same everywhere in the app.
  const activeCount = filters.reduce((sum, f) => {
    if (f.type === 'multi') return sum + f.selected.length
    if (f.type === 'range') return sum + (f.active ? 1 : 0)
    if (f.type === 'toggle') return sum + (f.value ? 1 : 0)
    return sum + (f.value !== '' ? 1 : 0)
  }, 0)
  // Clear every active filter at once — generic over whatever the host passed in.
  const clearAll = () => filters.forEach(f => {
    if (f.type === 'multi') f.selected.forEach(v => f.onToggle(v))
    else if (f.type === 'range') { if (f.active) f.onReset() }
    else if (f.type === 'toggle') { if (f.value) f.onChange(false) }
    else if (f.value !== '') f.onChange('')
  })

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* PRIMAIR-VLAK-1 (Danny 19-08): solid tenant fill — same footprint as
          DrawerAddButton (26/11.5/r6) so it sits flush next to it in the toolbar. */}
      <button type="button" onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- deliberately matches DrawerAddButton's own custom 26/11.5/r6 footprint (not a Button size) so the two sit flush together
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px',
          whiteSpace: 'nowrap', flexShrink: 0, fontSize: 11.5, fontWeight: activeCount > 0 ? 600 : 500, borderRadius: 6,
          cursor: 'pointer', color: 'var(--button-ink)',
          background: 'var(--button-fill)',
          border: open ? '1px solid var(--button-ink)' : '1px solid var(--button-border)',
        }}>
        <SlidersHorizontal size={12} />
        {label}
        {/* aria-hidden: a purely VISUAL count cue — the button's accessible name
            stays the stable `label` text (never "Filter 2", which would shift with
            every pick and break a screen reader's sense of "the same button"); the
            actual active values are fully exposed inside the open panel below. */}
        {/* Herhaal-audit r4 finding 3: the shared CountBadge atom (see
            FilterTriggerPill's twin badge — same fix, same inverted trio). */}
        {activeCount > 0 && <span aria-hidden="true"><CountBadge count={activeCount} /></span>}
      </button>
      {open && (
        <div id={panelId} ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
          // FILTER-WIDTH-1: wide enough for a real lookup label; maxWidth keeps it
          // inside a narrow viewport (a drawer on a laptop screen) instead of
          // pushing the page sideways.
          // FILTER-CLIP-1 (Danny 09-08, screenshot): NO `overflow` here. The nested
          // SelectMenu renders its option list as an absolutely-positioned child, so
          // ANY clipping ancestor traps it — the type list showed two rows inside a
          // tiny scrollbox instead of opening as a normal dropdown. That, not the
          // panel's size, was what made filtering unusable.
          // In-flow popover inside a drawer's own stacking context (this menu is only
          // ever mounted inside an entity drawer tab) — Z.popover, not the CSS
          // dropdown-portal rung, so it competes only with its dialog siblings.
          style={{ position: 'absolute', top: '100%', right: 0, zIndex: Z.popover, marginTop: 4,
            width: PANEL_WIDTH, maxWidth: 'calc(100vw - 24px)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
            boxShadow: 'var(--shadow-float)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
            {/* Icon-only, mirrors ReportFilterSidebar's own clear-all affordance —
                only shown once at least one filter is active. */}
            {activeCount > 0 && (
              <Button variant="ghost" iconOnly onClick={clearAll} title={clearAllLabel} aria-label={clearAllLabel}>
                <RotateCcw size={12} />
              </Button>
            )}
          </div>
          {/* FILTER-CLIP-1: deliberately UNCLIPPED — no maxHeight/overflow, or the
              nested dropdown gets trapped again (see the panel comment above). The
              panel can't run away regardless: each multi-select checklist caps its
              OWN height at CHECKLIST_MAX_HEIGHT and scrolls internally. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 12 }}>
            {filters.map(f => (
              <div key={f.key}>
                {/* Group label at 11.5 — 10.5 was below the ~11px floor the rest of
                    the app uses for meta labels (§4), which made the panel read as
                    fine print rather than as controls. */}
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>{f.label}</div>
                {f.type === 'single' ? (
                  // FILTER-WIDTH-1: menuWidth = the panel's full inner width, so the
                  // option list is never narrower than the trigger that opened it.
                  <SelectMenu value={f.value} onChange={f.onChange} menuWidth={CONTROL_WIDTH}
                    placeholder={f.allLabel} style={{ fontSize: 12, padding: '6px 9px' }}
                    options={[{ value: '', label: f.allLabel }, ...f.options]} />
                ) : f.type === 'multi' ? (
                  <DrawerMultiFilterRow config={f} />
                ) : f.type === 'range' ? (
                  <DrawerRangeFilterRow config={f} />
                ) : f.type === 'toggle' ? (
                  <DrawerToggleFilterRow config={f} />
                ) : (
                  <DrawerDateFilterRow config={f} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

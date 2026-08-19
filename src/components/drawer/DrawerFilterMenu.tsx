import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { SlidersHorizontal, RotateCcw, Search } from 'lucide-react'
import DatePicker from 'react-datepicker'
import SelectMenu from '@/components/ui/SelectMenu'
import SelectAllRow from '@/components/ui/SelectAllRow'
import Slider from '@/components/ui/Slider'
import { parseDate } from '@/components/forms/fields'
import { toLocalIsoDate } from '@/lib/localDate'
// PORTAL-MARKER-1: a click inside an open portalled picker menu is never "outside".
import { isInsideDropdownPortal } from '@/lib/useDropdownPlacement'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useBatchToggle } from '@/hooks/useBatchToggle'

export interface DrawerFilterOption { value: string; label: string }

// FILTER-WIDTH-1 (Danny 08-08, punt 13 "filter notities moet langer zijn" + punt 18
// "filter bij documenten is te kort hierdoor kan je niet goed filteren"): the panel
// used to be 230px, so a real tenant lookup label ("Verklaring Omtrent het Gedrag",
// "WhatsApp Business", "Intakegesprek ingepland") was cut off in the trigger AND in
// the checklist — you could not tell two values apart before picking one. Sized ONCE
// here so every drawer host (notes · documents · tasks, on candidates · customers ·
// vacancies · tasks) widens at the same moment; never a per-page override (§4).
// NARROW AND TALL (Danny 09-08, explicit: "het gaat niet om de breedte maar de
// hoogte dus smaller maken en langer"). Earlier rounds kept widening this panel —
// wrong axis. A filter list is scanned VERTICALLY: you want many values in view at
// once, in a column that stays out of the way of the drawer content behind it.
// So the panel is narrower than it ever was, and the list is more than twice as tall.
const PANEL_WIDTH = 260
// Inner content width: panel − 2×1px border − 2×10px padding. Handed to the nested
// dropdown as its menuWidth so its option list is never narrower than its trigger.
const CONTROL_WIDTH = PANEL_WIDTH - 22
// Checklist height cap — ~14 rows before it scrolls (was ~6). This is the number
// that actually decides whether filtering feels workable; long option labels wrap
// onto a second line rather than forcing the panel wider.
const CHECKLIST_MAX_HEIGHT = 440

// Single-select row (notes type/channel, document type) — the house searchable
// SelectMenu, '' = no filter. Mirrors SelectMenu's own value/onChange contract,
// so this component is a thin composer around it, never a second implementation.
export interface DrawerSingleFilterConfig {
  type: 'single'
  key: string
  // Field label shown above its control inside the panel (already translated by the host).
  label: ReactNode
  value: string
  options: DrawerFilterOption[]
  onChange: (value: string) => void
  // The dropdown's own "all" placeholder/option label (e.g. "Alle types").
  allLabel: string
}

// Multi-select row (task status/type/priority, …) — an INLINE searchable
// checklist, deliberately never a nested popover: the house SearchSelect (the
// existing multi-select control) renders its dropdown via `createPortal` into
// `document.body`, which would sit OUTSIDE this panel's own DOM subtree — this
// panel's outside-click listener (below) would then see every option click as
// "outside" and close the whole menu before `onToggle` could even register the
// pick. Rendering the checklist inline (no portal) keeps every click inside the
// panel's own subtree, side-stepping that class of bug entirely.
export interface DrawerMultiFilterConfig {
  type: 'multi'
  key: string
  label: ReactNode
  selected: string[]
  options: DrawerFilterOption[]
  onToggle: (value: string) => void
  // Placeholder/aria-label for this row's own search box (already translated).
  searchPlaceholder: string
  // "No options" copy for an empty vocabulary (already translated).
  noResultsLabel: string
}

// Range row (P8-more-filters, batch 8: "Uren per week") — a two-thumb Slider,
// mirrors VacancySearchFilters' own hours row. `active`/`onReset` are supplied by
// the HOST rather than derived here: a range's "off" position is whatever the
// host's own domain considers unbounded (e.g. [0, max] for hours), which only the
// host knows — the shared component stays generic over that choice.
export interface DrawerRangeFilterConfig {
  type: 'range'
  key: string
  label: ReactNode
  value: [number, number]
  max: number
  step?: number
  onChange: (next: [number, number]) => void
  // Formatted numeric readout beside the slider (already localized, e.g. "0–40").
  valueLabel: string
  ariaLabels: [string, string]
  // Whether the current value narrows anything (drives the badge + clear-all).
  active: boolean
  // Reset THIS row back to its host-defined "off" value — used by clear-all.
  onReset: () => void
}

// Date row (P8-more-filters: "Inzetbaar vanaf") — the shared react-datepicker
// convention (DD-MM-YYYY, §4), '' = no filter. Renders via the app-wide
// #datepicker-portal DOM node (index.html) instead of inline, so the calendar
// popper is never clipped by this panel's own bounds — see the outside-click
// listener below for the whitelist that keeps that portal from closing the panel.
export interface DrawerDateFilterConfig {
  type: 'date'
  key: string
  label: ReactNode
  value: string
  onChange: (next: string) => void
  placeholder: string
}

export type DrawerFilterConfig = DrawerSingleFilterConfig | DrawerMultiFilterConfig | DrawerRangeFilterConfig | DrawerDateFilterConfig

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

// One multi-select filter row: an inline (non-portal) search box + a scrollable
// checklist — see the DrawerMultiFilterConfig doc comment above for why this is
// never the shared SearchSelect component directly.
function DrawerMultiFilterRow({ config }: { config: DrawerMultiFilterConfig }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? config.options.filter(o => o.label.toLowerCase().includes(q)) : config.options
  // Select-all over the VISIBLE rows only; hosts expose a per-value onToggle, so the
  // batch is applied one value per commit (see useBatchToggle for why never a loop).
  const applyBatch = useBatchToggle<string>(config.onToggle)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', marginBottom: 4,
        borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)' }}>
        <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={config.searchPlaceholder}
          aria-label={config.searchPlaceholder}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none' }} />
      </div>
      {config.options.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 4px' }}>{config.noResultsLabel}</div>
      ) : (
        <div style={{ maxHeight: CHECKLIST_MAX_HEIGHT, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SelectAllRow dense visibleValues={shown.map(o => o.value)} selectedValues={config.selected}
            onApply={values => applyBatch(values)} />
          {shown.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 4px' }}>{config.noResultsLabel}</div>}
          {shown.map(o => {
            const checked = config.selected.includes(o.value)
            return (
              // FILTER-WIDTH-1: the label WRAPS instead of ellipsising — a truncated
              // option ("Verklaring Omtrent het …") is exactly what made filtering
              // impossible. flex-start keeps the box on the first line when it wraps.
              <label key={o.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 6px', borderRadius: 5, cursor: 'pointer',
                background: checked ? 'var(--color-primary-bg)' : 'none' }}>
                <input type="checkbox" checked={checked} onChange={() => config.onToggle(o.value)}
                  style={{ accentColor: 'var(--color-primary)', width: 12, height: 12, flexShrink: 0, marginTop: 3 }} />
                <span style={{ fontSize: 12, lineHeight: 1.35, minWidth: 0, overflowWrap: 'anywhere',
                  color: checked ? 'var(--color-primary-text)' : 'var(--text)' }}>
                  {o.label}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Range row: a two-thumb Slider + a JetBrains Mono readout (§4: numbers/IDs use
// the mono face) — inline, no portal, so it never trips the outside-click check.
function DrawerRangeFilterRow({ config }: { config: DrawerRangeFilterConfig }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1 }}>
        <Slider range={config.value} max={config.max} step={config.step ?? 1}
          onRangeChange={config.onChange} ariaLabels={config.ariaLabels} />
      </div>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>
        {config.valueLabel}
      </span>
    </div>
  )
}

// Bare filter-bar date input (mirrors VacancySearchFilters' own filterInput look)
// — the CONTROL_WIDTH constant keeps it flush with the single-select row above it.
const dateInputStyle = { padding: '6px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', outline: 'none', width: CONTROL_WIDTH }

// Date row: the shared react-datepicker convention (DD-MM-YYYY). Renders via the
// app-wide #datepicker-portal node, not inline — see DrawerDateFilterConfig's doc
// comment and this file's outside-click listener for why that portal is whitelisted.
function DrawerDateFilterRow({ config }: { config: DrawerDateFilterConfig }) {
  return (
    <DatePicker
      selected={parseDate(config.value)}
      onChange={(d: Date | null) => config.onChange(d ? toLocalIsoDate(d) : '')}
      dateFormat="dd-MM-yyyy"
      showMonthDropdown showYearDropdown dropdownMode="select"
      placeholderText={config.placeholder}
      portalId="datepicker-portal"
      popperPlacement="bottom-start"
      customInput={<input aria-label={config.placeholder} style={dateInputStyle} />}
    />
  )
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
 * TASK-FILTER-MENU-1 (Danny 08-08, "Notities dus zo overal met die filter en ook
 * taken doen"): extended to also carry MULTI-select rows (task status/type/
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
 * FILTER-WIDTH-1 (Danny 08-08, punten 13 + 18: "filter notities moet langer zijn",
 * "filter bij documenten is te kort hierdoor kan je niet goed filteren"): the panel
 * and its controls are sized by the constants at the top of this file — widened
 * once HERE so notes, documents and tasks in every drawer (candidate · customer ·
 * vacancy · task) get it together, and long lookup labels wrap instead of being cut.
 *
 * Closing: outside click (this file) + Escape + Tab-trap + focus-restore-to-the-
 * button (all via the shared `useFocusTrap`, §6 — mirrors ChangelogPopover). A
 * SelectMenu opened INSIDE the panel closes on its own Escape press first (its
 * listener is document-capture-phase and stops propagation before useFocusTrap's
 * node-level bubble listener ever sees the key — same ordering SelectMenu's own
 * docblock describes for the modal case) — a second Escape then closes this panel.
 * The multi-select checklist above needs no such handling: it is plain inline
 * markup, never a second popover.
 */
export default function DrawerFilterMenu({ filters, label, title, clearAllLabel }: DrawerFilterMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const panelRef = useFocusTrap<HTMLDivElement>(() => setOpen(false))

  // Close on outside click while open — mirrors ChangelogPopover's own convention.
  useEffect(() => {
    if (!open) return
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
    return sum + (f.value !== '' ? 1 : 0)
  }, 0)
  // Clear every active filter at once — generic over whatever the host passed in.
  const clearAll = () => filters.forEach(f => {
    if (f.type === 'multi') f.selected.forEach(v => f.onToggle(v))
    else if (f.type === 'range') { if (f.active) f.onReset() }
    else if (f.value !== '') f.onChange('')
  })

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* PRIMAIR-VLAK-1 (Danny 19-08): solid tenant fill — same footprint as
          DrawerAddButton (26/11.5/r6) so it sits flush next to it in the toolbar. */}
      <button type="button" onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined}
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
        {activeCount > 0 && (
          <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 15, height: 15,
            padding: '0 4px', borderRadius: 999, background: 'var(--button-ink)', color: 'var(--color-primary-text)',
            fontSize: 10, fontWeight: 700, lineHeight: 1 }}>
            {activeCount}
          </span>
        )}
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
          style={{ position: 'absolute', top: '100%', right: 0, zIndex: 200, marginTop: 4,
            width: PANEL_WIDTH, maxWidth: 'calc(100vw - 24px)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
            {/* Icon-only, mirrors ReportFilterSidebar's own clear-all affordance —
                only shown once at least one filter is active. */}
            {activeCount > 0 && (
              <button type="button" onClick={clearAll} title={clearAllLabel} aria-label={clearAllLabel}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20,
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 4 }}>
                <RotateCcw size={12} />
              </button>
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

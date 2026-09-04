// Extracted from DrawerFilterMenu (SIZE-SPLIT-B, zero behaviour change): the
// per-type row renderers (single row lives inline in DrawerFilterMenu via
// SelectMenu; the other four types render here).
import { useState } from 'react'
import { Search } from 'lucide-react'
import DatePicker from 'react-datepicker'
import SelectAllRow from '@/components/ui/SelectAllRow'
import Slider from '@/components/ui/Slider'
import Toggle from '@/components/ui/Toggle'
import { Caption, Mono } from '@/components/ui/typography'
import { parseDate } from '@/components/forms/fields'
import { toLocalIsoDate } from '@/lib/localDate'
import { useBatchToggle } from '@/hooks/useBatchToggle'
import type { DrawerMultiFilterConfig, DrawerRangeFilterConfig, DrawerToggleFilterConfig, DrawerDateFilterConfig } from './drawerFilterTypes'

// Checklist height cap — ~14 rows before it scrolls (was ~6). This is the number
// that actually decides whether filtering feels workable; long option labels wrap
// onto a second line rather than forcing the panel wider.
const CHECKLIST_MAX_HEIGHT = 440

// Inner content width the panel hands to its controls — kept in sync with
// DrawerFilterMenu's own CONTROL_WIDTH (PANEL_WIDTH − border − padding).
const CONTROL_WIDTH = 260 - 22

// One multi-select filter row: an inline (non-portal) search box + a scrollable
// checklist — see the DrawerMultiFilterConfig doc comment for why this is
// never the shared SearchSelect component directly.
export function DrawerMultiFilterRow({ config }: { config: DrawerMultiFilterConfig }) {
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
        <Caption as="div" style={{ padding: '2px 4px' }}>{config.noResultsLabel}</Caption>
      ) : (
        <div style={{ maxHeight: CHECKLIST_MAX_HEIGHT, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SelectAllRow dense visibleValues={shown.map(o => o.value)} selectedValues={config.selected}
            onApply={values => applyBatch(values)} />
          {shown.length === 0 && <Caption as="div" style={{ padding: '2px 4px' }}>{config.noResultsLabel}</Caption>}
          {/* FILTER-WIDTH-1: the label WRAPS instead of ellipsising — a truncated
              option ("Verklaring Omtrent het …") is exactly what made filtering
              impossible. flex-start keeps the box on the first line when it wraps.
              HUISSTIJL-1 (Opus-F residual triage, judged — LEFT tinted, not trio):
              a checked row in this checklist is the same "selected list row"
              category the law already exempts on SelectMenu/SearchSelect/
              CreatableSelect's own option rows — solid-filling only this sibling
              would be new drift, not less of it. */}
          {shown.map(o => {
            const checked = config.selected.includes(o.value)
            return (
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
export function DrawerRangeFilterRow({ config }: { config: DrawerRangeFilterConfig }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1 }}>
        <Slider range={config.value} max={config.max} step={config.step ?? 1}
          onRangeChange={config.onChange} ariaLabels={config.ariaLabels} />
      </div>
      <Mono style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>
        {config.valueLabel}
      </Mono>
    </div>
  )
}

// Toggle row: the shared Toggle atom — a single switch, no label repeated inside
// (the group heading above already shows it).
export function DrawerToggleFilterRow({ config }: { config: DrawerToggleFilterConfig }) {
  return <Toggle checked={config.value} onChange={config.onChange} ariaLabel={config.ariaLabel} />
}

// Bare filter-bar date input (mirrors VacancySearchFilters' own filterInput look)
// — the CONTROL_WIDTH constant keeps it flush with the single-select row above it.
const dateInputStyle = { padding: '6px 9px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', outline: 'none', width: CONTROL_WIDTH }

// Date row: the shared react-datepicker convention (DD-MM-YYYY). Renders via the
// app-wide #datepicker-portal node, not inline — see DrawerDateFilterConfig's doc
// comment and DrawerFilterMenu's outside-click listener for why that portal is whitelisted.
export function DrawerDateFilterRow({ config }: { config: DrawerDateFilterConfig }) {
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

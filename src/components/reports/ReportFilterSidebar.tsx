/**
 * ReportFilterSidebar — the right-hand filter panel shared by all reports.
 * Composes the pinned sections (global-search / location-radius / saved
 * filters) plus one `FilterGroupBlock` per registered group, and owns the
 * reset/expand-all actions. `RightPanelContext` feeds the `groups` prop.
 *
 * KANDIDAAT-100 punt 31: each group renders as its own tinted, collapsible
 * block (no more one giant list) — frequently-used groups default open, the
 * rest default closed, and the choice persists per page via
 * `useFilterGroupCollapse` (./filter/useFilterGroupCollapse).
 */
import { X, Search, RotateCcw, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReportFilterGroup } from '@/types/reports'
import SavedFiltersGroup from './filter/SavedFiltersGroup'
import FilterGroupBlock from './filter/FilterGroupBlock'
import { useFilterGroupCollapse } from './filter/useFilterGroupCollapse'

// A group's own active-selection count (single-group version of the header sum).
function groupActiveCount(g: ReportFilterGroup): number {
  if (g.type === 'saved-filters')  return 0
  if (g.type === 'period')         return g.value ? 1 : 0
  if (g.type === 'global-search')  return g.value ? 1 : 0
  if (g.type === 'location')       return g.city ? 1 : 0
  if (g.type === 'date-range')     return (g.from || g.to) ? 1 : 0
  if (g.type === 'geo-radius')     return g.applied ? 1 : 0
  return g.selected?.length ?? 0
}

export default function ReportFilterSidebar({
  title = 'Filters', groups = [], onClose, pageId = 'default',
}: { title?: ReactNode; groups?: ReportFilterGroup[]; onClose: () => void; pageId?: string }) {
  const { t } = useTranslation('common')
  const activeCount = groups.reduce((sum, g) => sum + groupActiveCount(g), 0)

  const clearAll = () => {
    groups.forEach(g => {
      if (g.type === 'saved-filters') { /* not a filter — never cleared */ }
      else if (g.type === 'period') { g.onChange?.('') }
      else if (g.type === 'global-search') { g.onChange?.('') }
      else if (g.type === 'location') { g.onCityChange?.(''); g.onRadiusChange?.('') }
      else if (g.type === 'date-range') { g.onFromChange?.(''); g.onToChange?.('') }
      else if (g.type === 'geo-radius') { g.onClear?.() }
      else { g.selected?.forEach(v => g.onToggle?.(v)) }
    })
  }

  // The groups rendered as collapsible blocks — everything except the pinned,
  // always-visible sections (search bar, saved filters, location radius).
  const collapsibleGroups = groups.filter(g => g.type !== 'global-search' && g.type !== 'location' && g.type !== 'saved-filters')
  const collapse = useFilterGroupCollapse(pageId, collapsibleGroups)

  // Active-filter chips — built up front so the bar hides entirely when empty.
  // Groups can opt out with `noChip` (e.g. the SM charts, where every month/series
  // is selected by default and the chip row was just noise — Danny 2026-07-06).
  const chip = (chipKey: string, label: string, onRemove?: () => void) => (
    <span key={chipKey} style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: '100%',
      background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
      borderRadius: 999, padding: '2px 8px', fontSize: 10.5, fontWeight: 500 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {onRemove && (
        <button onClick={onRemove} aria-label={t('filters.clear')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, display: 'flex' }}>
          <X size={8} />
        </button>
      )}
    </span>
  )
  const chipNodes = groups.flatMap(g => {
    if (g.noChip || g.type === 'saved-filters') return []
    if (g.type === 'global-search') return g.value ? [chip(g.key, `"${g.value}"`, () => g.onChange?.(''))] : []
    if (g.type === 'period')        return g.value ? [chip(g.key, String(g.value), () => g.onChange?.(''))] : []
    if (g.type === 'location')      return g.city ? [chip(g.key, `${g.city}${g.radius ? ` · ${g.radius} km` : ''}`, () => { g.onCityChange?.(''); g.onRadiusChange?.('') })] : []
    if (g.type === 'date-range')    return (g.from || g.to) ? [chip(g.key, `${g.from ?? '…'} – ${g.to ?? '…'}`, () => { g.onFromChange?.(''); g.onToChange?.('') })] : []
    if (g.type === 'geo-radius')    return g.applied ? [chip(g.key, g.applied.label, () => g.onClear?.())] : []
    return (g.selected ?? []).map(v =>
      chip(`${g.key}:${v}`, (g.options ?? []).find(o => o.value === v)?.label ?? String(v), () => g.onToggle?.(v)))
  })

  return (
    <div className="flex flex-col flex-shrink-0 bg-[var(--surface)]"
      style={{ width: '100%', borderLeft: '1px solid var(--border)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{title}</span>
          {activeCount > 0 && (
            <span style={{ background: 'var(--color-primary)', color: 'white',
                           borderRadius: 999, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>
              {activeCount}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {/* Expand all / collapse all — one click flips every group at once (punt 31c) */}
          {collapsibleGroups.length > 0 && (
            <button
              onClick={() => (collapse.allExpanded ? collapse.collapseAll() : collapse.expandAll())}
              title={collapse.allExpanded ? t('filters.collapseAll') : t('filters.expandAll')}
              aria-label={collapse.allExpanded ? t('filters.collapseAll') : t('filters.expandAll')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                       width: 22, height: 22, background: 'none', border: 'none',
                       cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              {collapse.allExpanded ? <ChevronsDownUp size={12} /> : <ChevronsUpDown size={12} />}
            </button>
          )}
          {activeCount > 0 && (
            <button onClick={clearAll} title={t('filters.clearAll')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                       width: 22, height: 22, background: 'none', border: 'none',
                       cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <RotateCcw size={12} />
            </button>
          )}
          <button onClick={onClose} aria-label={t('close')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                     width: 22, height: 22, background: 'none', border: 'none',
                     cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Active-filter chips: every applied value in one glance, each removable. */}
      {chipNodes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 12px',
                      borderBottom: '1px solid var(--border)' }}>
          {chipNodes}
        </div>
      )}

      {/* Saved filter sets (type: 'saved-filters') — pinned above the filter groups */}
      {groups.filter(g => g.type === 'saved-filters').map(g => (
        <div key={g.key} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <SavedFiltersGroup group={g} />
        </div>
      ))}

      {/* Global search (type: 'global-search') — rendered at top before filter groups */}
      {groups.filter(g => g.type === 'global-search').map(g => (
        <div key={g.key} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
            borderRadius: 7, border: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
            <Search size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input autoFocus={false} value={g.value ?? ''} onChange={e => g.onChange?.(e.target.value)}
              placeholder={g.placeholder ?? t('filters.searchAll')}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'transparent', padding: 0 }} />
            {g.value && (
              <button onClick={() => g.onChange?.('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                <X size={10} />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Location radius (type: 'location') */}
      {groups.filter(g => g.type === 'location').map(g => (
        <div key={g.key} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {t('filters.radius')}
          </div>
          <input value={g.city ?? ''} onChange={e => g.onCityChange?.(e.target.value)}
            placeholder={t('filters.cityPlaceholder')}
            style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--hover-bg)', color: 'var(--text)',
              outline: 'none', boxSizing: 'border-box', marginBottom: 6 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input value={g.radius ?? ''} onChange={e => g.onRadiusChange?.(e.target.value)}
              placeholder="35"
              type="number" min="1"
              style={{ width: 70, padding: '6px 8px', fontSize: 12, borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--hover-bg)', color: 'var(--text)',
                outline: 'none', boxSizing: 'border-box' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>km</span>
          </div>
        </div>
      ))}

      {/* Groups — each a tinted, collapsible block (punt 31a/b) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px',
                    display: 'flex', flexDirection: 'column', gap: 8 }}>
        {collapsibleGroups.map((group, i, arr) => (
          <div key={group.key}>
            {/* Category heading — only shown when the category changes */}
            {group.category && group.category !== arr[i - 1]?.category && (
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase',
                            letterSpacing: '0.06em', marginBottom: 8,
                            paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                {group.category}
              </div>
            )}
            <FilterGroupBlock
              group={group}
              collapsed={collapse.isCollapsed(group.key)}
              count={groupActiveCount(group)}
              onToggle={() => collapse.toggle(group.key)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

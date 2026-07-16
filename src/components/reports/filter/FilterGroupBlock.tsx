/**
 * FilterGroupBlock — one collapsible, tinted block in the right filter panel
 * (KANDIDAAT-100 punt 31a/b): a chevron+label header (always shows the
 * active-selection count, even collapsed) and, when open, the group's own
 * body (search-select / period / date-range / radio / checkbox list).
 * Extracted from ReportFilterSidebar to keep that file a thin composer.
 */
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReportFilterGroup } from '@/types/reports'
import SearchSelectGroup from './SearchSelectGroup'
import PeriodGroup from './PeriodGroup'
import OpenCheckGroup from './OpenCheckGroup'
import GeoRadiusGroup from './GeoRadiusGroup'

// Solid numeric badge — mirrors the panel header's total-count pill so every
// "how many are active" indicator reads as one visual language.
function CountBadge({ count, label }: { count: number; label: string }) {
  return (
    <span aria-label={label} style={{
      background: 'var(--color-primary)', color: 'white', borderRadius: 999,
      padding: '1px 6px', fontSize: 10, fontWeight: 600, flexShrink: 0,
    }}>
      {count}
    </span>
  )
}

export default function FilterGroupBlock({
  group, collapsed, count, onToggle,
}: { group: ReportFilterGroup; collapsed: boolean; count: number; onToggle: () => void }) {
  const { t } = useTranslation('common')
  const bodyId = `filter-group-body-${group.key}`

  return (
    // Subtle primary-tinted background (§4 color-mix, not a loud fill) so the
    // panel reads as separated cards instead of one long list.
    <div data-testid={`filter-group-${group.key}`} style={{
      borderRadius: 8, border: '1px solid color-mix(in srgb, var(--color-primary) 14%, transparent)',
      background: 'color-mix(in srgb, var(--color-primary) 4%, var(--surface))', overflow: 'hidden',
    }}>
      {/* Header row: chevron+label toggles the block; count chip always visible
          (even collapsed) so no active filter is ever hidden silently. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '7px 9px' }}>
        <button type="button" onClick={onToggle} aria-expanded={!collapsed} aria-controls={bodyId}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6,
                   background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
          <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-muted)',
            transform: collapsed ? 'none' : 'rotate(90deg)', transition: 'transform 0.12s' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                         textTransform: 'uppercase', letterSpacing: '0.05em',
                         overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.label}
          </span>
          {count > 0 && <CountBadge count={count} label={t('filters.selectedCount', { count })} />}
        </button>
        {!collapsed && group.type !== 'period' && count > 0 && (
          <button type="button" onClick={() => group.selected?.forEach(v => group.onToggle?.(v))}
            style={{ fontSize: 9, color: 'var(--text-muted)', background: 'none', border: 'none',
                     cursor: 'pointer', padding: 0, flexShrink: 0 }}>
            {t('filters.clear')}
          </button>
        )}
      </div>

      {/* Body — hidden while collapsed; unmounted, not just visually hidden,
          so a closed block costs nothing (search-select dropdowns etc). */}
      {!collapsed && (
        <div id={bodyId} style={{ padding: '0 9px 9px' }}>
          {group.type === 'period' ? (
            <PeriodGroup group={group} />
          ) : group.type === 'date-range' ? (
            // Two date inputs for a from/to range filter (e.g. audit log).
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input type="date" value={group.from ?? ''} onChange={e => group.onFromChange?.(e.target.value)}
                style={{ height: 30, padding: '0 8px', fontSize: 12, border: '1px solid var(--border)',
                         borderRadius: 6, color: 'var(--text)', outline: 'none', width: '100%' }} />
              <input type="date" value={group.to ?? ''} onChange={e => group.onToChange?.(e.target.value)}
                style={{ height: 30, padding: '0 8px', fontSize: 12, border: '1px solid var(--border)',
                         borderRadius: 6, color: 'var(--text)', outline: 'none', width: '100%' }} />
            </div>
          ) : group.type === 'geo-radius' ? (
            <GeoRadiusGroup group={group} />
          ) : group.type === 'search-select' && group.display === 'open' ? (
            <OpenCheckGroup group={group} />
          ) : group.type === 'search-select' ? (
            <SearchSelectGroup group={group} />
          ) : group.type === 'radio' ? (
            <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 7, padding: 2, gap: 2 }}>
              {(group.options ?? []).map(opt => {
                const active = (group.selected ?? []).includes(opt.value)
                return (
                  <button key={opt.value} onClick={() => group.onToggle?.(opt.value)}
                    style={{
                      flex: 1, padding: '4px 0', borderRadius: 5, fontSize: 11,
                      fontWeight: active ? 600 : 400, cursor: 'pointer',
                      border: active ? '1px solid var(--border)' : '1px solid transparent',
                      background: active ? 'white' : 'transparent',
                      color: active ? 'var(--text)' : 'var(--text-muted)',
                      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.1s',
                    }}>
                    {opt.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(group.options ?? []).map(opt => {
                const checked = (group.selected ?? []).includes(opt.value)
                return (
                  <label key={opt.value}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <input type="checkbox" checked={checked}
                        onChange={() => group.onToggle?.(opt.value)}
                        style={{ accentColor: 'var(--color-primary)', width: 12, height: 12, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: checked ? 'var(--text)' : 'var(--text-muted)',
                                     overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {opt.label}
                      </span>
                    </div>
                    {opt.count !== undefined && (
                      <span style={{
                        flexShrink: 0, fontFamily: 'monospace', borderRadius: 999,
                        padding: '1px 5px', fontSize: 10,
                        background: checked ? 'var(--color-primary-bg)' : 'var(--border)',
                        color:      checked ? 'var(--color-primary)'    : 'var(--text-muted)',
                      }}>
                        {opt.count}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

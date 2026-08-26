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
import CountBadge from '@/components/ui/CountBadge'
import { tint } from '@/lib/tint'

// One collapsible right-panel filter block: chevron+label header (count chip
// always visible, even collapsed) plus the group's own body, dispatched by type.
export default function FilterGroupBlock({
  group, collapsed, count, onToggle,
}: { group: ReportFilterGroup; collapsed: boolean; count: number; onToggle: () => void }) {
  const { t } = useTranslation('common')
  const bodyId = `filter-group-body-${group.key}`

  return (
    // Subtle primary-tinted background (§4 color-mix, not a loud fill) so the
    // panel reads as separated cards instead of one long list. A deliberately
    // lighter pair (14/4%) than the standard chip formula (33/10%) — this is a
    // CARD wrapper, not a chip — so it reads through lib/tint's own `tint()`
    // helper (arbitrary percentage) rather than the fixed-pair tintBorder/tintBg.
    <div data-testid={`filter-group-${group.key}`} style={{
      borderRadius: 8, border: `1px solid ${tint('var(--color-primary)', 14)}`,
      background: 'color-mix(in srgb, var(--color-primary) 4%, var(--surface))', overflow: 'hidden',
    }}>
      {/* Header row: chevron+label toggles the block; count chip always visible
          (even collapsed) so no active filter is ever hidden silently. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '7px 9px' }}>
        {/* Accordion disclosure header — flex-grows over variable chevron+label+
            badge content, so it needs custom padding:0/flex:1 that Button's fixed
            sm footprint does not model (structural role, mirrors SegmentedControl's
            own role="radio" exemption). Block form: style spans several lines. */}
        {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
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
          {/* Herhaal-audit r4 findings 8/9: the shared CountBadge atom (the panel
              header's own active-count badge, ReportFilterSidebar, reads it too —
              so "how many are active" looks identical everywhere it appears). */}
          {count > 0 && <span aria-label={t('filters.selectedCount', { count })}><CountBadge count={count} /></span>}
        </button>
        {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
        {!collapsed && group.type !== 'period' && count > 0 && (
          // Dense inline "clear this group" hint (9px) — smaller than Button's
          // floor (12px/sm) by design, de-emphasised next to the header label.
          // Block form: the flagged style attribute sits on the tag's 2nd line.
          /* eslint-disable huisstijlLegacy/no-restricted-syntax */
          <button type="button" onClick={() => { if (group.type === 'number-range') { group.onMinChange?.(null); group.onMaxChange?.(null) } else group.selected?.forEach(v => group.onToggle?.(v)) }}
            style={{ fontSize: 9, color: 'var(--text-muted)', background: 'none', border: 'none',
                     cursor: 'pointer', padding: 0, flexShrink: 0 }}>
            {t('filters.clear')}
          </button>
          /* eslint-enable huisstijlLegacy/no-restricted-syntax */
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
          ) : group.type === 'number-range' ? (
            // Two numeric inputs for a min/max range filter (opportunities pipeline value).
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="number" min={0} value={group.min ?? ''} aria-label={t('filters.valueMin')}
                onChange={e => group.onMinChange?.(e.target.value === '' ? null : Number(e.target.value))}
                placeholder="0"
                style={{ height: 30, padding: '0 8px', fontSize: 12, border: '1px solid var(--border)',
                         borderRadius: 6, color: 'var(--text)', outline: 'none', width: '100%' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>–</span>
              <input type="number" min={0} value={group.max ?? ''} aria-label={t('filters.valueMax')}
                onChange={e => group.onMaxChange?.(e.target.value === '' ? null : Number(e.target.value))}
                placeholder="∞"
                style={{ height: 30, padding: '0 8px', fontSize: 12, border: '1px solid var(--border)',
                         borderRadius: 6, color: 'var(--text)', outline: 'none', width: '100%' }} />
            </div>
          ) : group.type === 'geo-radius' ? (
            <GeoRadiusGroup group={group} />
          ) : (group.type === 'search-select' || !group.type) && group.display === 'open' ? (
            <OpenCheckGroup group={group} />
          ) : group.type === 'search-select' || !group.type ? (
            // PARITY-FALLBACK-1: a group with no `type` at all (a page that has
            // not been through the typed-group sweep yet) still gets the
            // searchable dropdown, never the untyped plain checkbox list below —
            // a long lookup with no search box was exactly the gap the seven-page
            // filter-parity pass exists to close (§0 shared fix).
            <SearchSelectGroup group={group} />
          ) : group.type === 'radio' ? (
            <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 7, padding: 2, gap: 2 }}>
              {(group.options ?? []).map(opt => {
                const active = (group.selected ?? []).includes(opt.value)
                return (
                  // Segmented pill option, not a standalone action — mirrors
                  // SegmentedControl's own compact-pill exemption; the raised
                  // "active" shadow is a status-ring class (deliberately excepted).
                  /* eslint-disable huisstijlLegacy/no-restricted-syntax */
                  <button key={opt.value} onClick={() => group.onToggle?.(opt.value)}
                    style={{
                      flex: 1, padding: '4px 0', borderRadius: 5, fontSize: 11,
                      fontWeight: active ? 600 : 400, cursor: 'pointer',
                      border: active ? '1px solid var(--border)' : '1px solid transparent',
                      background: active ? 'var(--surface)' : 'transparent',
                      color: active ? 'var(--text)' : 'var(--text-muted)',
                      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.1s',
                    }}>
                    {opt.label}
                  </button>
                  /* eslint-enable huisstijlLegacy/no-restricted-syntax */
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
                        // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                        color:      checked ? 'var(--color-primary-text)'    : 'var(--text-muted)',
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

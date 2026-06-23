/**
 * ReportFilterSidebar — the right-hand filter panel shared by all reports.
 * Renders each filter group (registered via RightPanelContext) as a searchable
 * multi-select, plus a reset action. SearchSelectGroup below = one such group.
 */
import { X, Search, ChevronDown, RotateCcw } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

// One collapsible, searchable multi-select group of filter options.
function SearchSelectGroup({ group }) {
  const { t } = useTranslation('common')
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')

  const visible = group.options.filter(o =>
    (o.label ?? '').toLowerCase().includes(query.toLowerCase())
  )
  const hasSelected = group.selected.length > 0

  return (
    <div>
      {/* Trigger-knop */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
          background: hasSelected ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
          border: `1px solid ${hasSelected ? 'var(--color-primary)' : 'var(--border)'}`,
          color: hasSelected ? 'var(--color-primary)' : 'var(--text)',
        }}
      >
        <span className="truncate">
          {hasSelected
            ? group.selected.length === 1
              ? (group.options.find(o => o.value === group.selected[0])?.label ?? group.selected[0])
              : t('filters.selectedCount', { count: group.selected.length })
            : t('filters.choose', { label: group.label.toLowerCase() })}
        </span>
        <ChevronDown size={12} style={{ flexShrink: 0, marginLeft: 4,
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{ marginTop: 4, border: '1px solid var(--border)', borderRadius: 6,
                      background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          {/* Search bar */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('search')}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 11,
                       color: 'var(--text)', background: 'transparent', padding: 0 }}
            />
            {query && (
              <button onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                <X size={9} />
              </button>
            )}
          </div>

          {/* Options */}
          <div style={{ maxHeight: 160, overflowY: 'auto', padding: '4px 0' }}>
            {group.options.length === 0 && (
              <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)' }}>{t('filters.noData')}</div>
            )}
            {group.options.length > 0 && visible.length === 0 && (
              <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)' }}>{t('noResults')}</div>
            )}
            {visible.map(opt => {
              const checked = group.selected.includes(opt.value)
              return (
                <label key={opt.value}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px',
                           cursor: 'pointer', background: checked ? 'var(--color-primary-bg)' : 'transparent' }}
                  onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--hover-bg)' }}
                  onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent' }}
                >
                  <input type="checkbox" checked={checked}
                    onChange={() => group.onToggle(opt.value)}
                    style={{ accentColor: 'var(--color-primary)', width: 12, height: 12, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: checked ? 'var(--color-primary)' : 'var(--text)',
                                 fontWeight: checked ? 500 : 400, overflow: 'hidden',
                                 textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                </label>
              )
            })}
          </div>

          {/* Selected tags */}
          {hasSelected && (
            <div style={{ padding: '5px 8px', borderTop: '1px solid var(--border)',
                          display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {group.selected.map(val => {
                const opt = group.options.find(o => o.value === val)
                return (
                  <span key={val} style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
                    borderRadius: 999, padding: '2px 7px', fontSize: 10, fontWeight: 500,
                  }}>
                    {opt?.label ?? val}
                    <button onClick={() => group.onToggle(val)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                               color: 'inherit', padding: 0, lineHeight: 1 }}>
                      <X size={8} />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Period picker ────────────────────────────────────────────────────────────
// group.value   : string — '' | '2024' | '2024-Q2' | '2024-05'
// group.years   : number[] — available years, newest first
// group.onChange: (value: string) => void

// Locale-aware short month name for index 0–11.
const monthAbbr = (i) => new Date(2000, i, 1).toLocaleString(undefined, { month: 'short' })
const QUARTERS  = ['Q1','Q2','Q3','Q4']

function PeriodGroup({ group }) {
  const { t } = useTranslation('common')
  const val = group.value ?? ''

  // Derive current granularity + year from value
  const granularity = useMemo(() => {
    if (!val) return 'month'
    if (val.includes('-Q')) return 'quarter'
    if (val.includes('-'))  return 'month'
    return 'year'
  }, [val])

  const selectedYear = useMemo(() => {
    if (!val) return null
    return Number(val.split('-')[0])
  }, [val])

  const selectedSub = useMemo(() => {
    if (!val || !val.includes('-')) return null
    return val.split('-')[1] // 'Q2' or '05'
  }, [val])

  const years = group.years ?? []

  const setGranularity = (g) => {
    if (!selectedYear) return group.onChange('')
    if (g === 'year')    return group.onChange(String(selectedYear))
    group.onChange('')
  }

  const setYear = (y) => {
    if (granularity === 'year') return group.onChange(String(y))
    group.onChange('')
  }

  const setSub = (sub) => {
    if (!selectedYear) return
    group.onChange(`${selectedYear}-${sub}`)
  }

  const btnBase = {
    border: 'none', cursor: 'pointer', borderRadius: 5,
    fontSize: 11, fontWeight: 500, transition: 'all 0.1s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Granularity toggle */}
      <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 7, padding: 2, gap: 2 }}>
        {[
          { id: 'month',   label: t('filters.granMonth')   },
          { id: 'quarter', label: t('filters.granQuarter') },
          { id: 'year',    label: t('filters.granYear')    },
        ].map(g => {
          const active = granularity === g.id
          return (
            <button key={g.id}
              onClick={() => setGranularity(g.id)}
              style={{ ...btnBase, flex: 1, padding: '4px 0',
                       border: active ? '1px solid var(--border)' : '1px solid transparent',
                       background: active ? 'white' : 'transparent',
                       color: active ? 'var(--text)' : 'var(--text-muted)',
                       boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>
              {g.label}
            </button>
          )
        })}
      </div>

      {/* Year selector */}
      {years.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {years.map(y => {
            const active = selectedYear === y
            return (
              <button key={y} onClick={() => setYear(y)}
                style={{ ...btnBase, padding: '3px 9px',
                         background: active ? 'var(--color-primary)' : 'var(--border)',
                         color:      active ? 'white'                : 'var(--text)',
                         fontWeight: active ? 600 : 400 }}>
                {y}
              </button>
            )
          })}
        </div>
      )}

      {/* Month grid */}
      {granularity === 'month' && selectedYear && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
          {Array.from({ length: 12 }, (_, i) => {
            const sub   = String(i + 1).padStart(2, '0')
            const active = selectedSub === sub
            return (
              <button key={sub} onClick={() => setSub(sub)}
                style={{ ...btnBase, padding: '4px 0', textAlign: 'center',
                         background: active ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
                         color:      active ? 'var(--color-primary)'    : 'var(--text)',
                         border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
                         fontWeight: active ? 600 : 400 }}>
                {monthAbbr(i)}
              </button>
            )
          })}
        </div>
      )}

      {/* Quarter grid */}
      {granularity === 'quarter' && selectedYear && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
          {QUARTERS.map((q, i) => {
            const sub   = `Q${i + 1}`
            const active = selectedSub === sub
            return (
              <button key={sub} onClick={() => setSub(sub)}
                style={{ ...btnBase, padding: '6px 0', textAlign: 'center',
                         background: active ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
                         color:      active ? 'var(--color-primary)'    : 'var(--text)',
                         border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
                         fontWeight: active ? 600 : 400, fontSize: 12 }}>
                {q}
              </button>
            )
          })}
        </div>
      )}

      {/* Reset period */}
      {val && (
        <button onClick={() => group.onChange('')}
          style={{ ...btnBase, display: 'flex', alignItems: 'center', justifyContent: 'center',
                   gap: 4, padding: '4px 0', background: 'none',
                   color: 'var(--text-muted)', fontSize: 11, fontWeight: 400 }}>
          <RotateCcw size={10} /> {t('filters.clearPeriod')}
        </button>
      )}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function ReportFilterSidebar({ title = 'Filters', groups = [], onClose }) {
  const { t } = useTranslation('common')
  const activeCount = groups.reduce((sum, g) => {
    if (g.type === 'period') return sum + (g.value ? 1 : 0)
    if (g.type === 'global-search') return sum + (g.value ? 1 : 0)
    if (g.type === 'location') return sum + (g.city ? 1 : 0)
    return sum + (g.selected?.length ?? 0)
  }, 0)

  const clearAll = () => {
    groups.forEach(g => {
      if (g.type === 'period') { g.onChange?.('') }
      else if (g.type === 'global-search') { g.onChange?.('') }
      else if (g.type === 'location') { g.onCityChange?.(''); g.onRadiusChange?.('') }
      else { g.selected?.forEach(v => g.onToggle?.(v)) }
    })
  }

  return (
    <div className="flex flex-col flex-shrink-0 bg-[var(--surface)]"
      style={{ width: 220, borderLeft: '1px solid var(--border)' }}>

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
          <button onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                     width: 22, height: 22, background: 'none', border: 'none',
                     cursor: 'pointer', color: 'var(--text-muted)', borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Global search (type: 'global-search') — rendered at top before filter groups */}
      {groups.filter(g => g.type === 'global-search').map(g => (
        <div key={g.key} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
            borderRadius: 7, border: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
            <Search size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input autoFocus={false} value={g.value ?? ''} onChange={e => g.onChange(e.target.value)}
              placeholder={g.placeholder ?? t('filters.searchAll')}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'transparent', padding: 0 }} />
            {g.value && (
              <button onClick={() => g.onChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
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
          <input value={g.city ?? ''} onChange={e => g.onCityChange(e.target.value)}
            placeholder={t('filters.cityPlaceholder')}
            style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--hover-bg)', color: 'var(--text)',
              outline: 'none', boxSizing: 'border-box', marginBottom: 6 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input value={g.radius ?? ''} onChange={e => g.onRadiusChange(e.target.value)}
              placeholder="35"
              type="number" min="1"
              style={{ width: 70, padding: '6px 8px', fontSize: 12, borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--hover-bg)', color: 'var(--text)',
                outline: 'none', boxSizing: 'border-box' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>km</span>
          </div>
        </div>
      ))}

      {/* Groups */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px',
                    display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.filter(g => g.type !== 'global-search' && g.type !== 'location').map((group, i, arr) => (
          <div key={group.key}>
            {/* Category heading — only shown when the category changes */}
            {group.category && group.category !== arr[i - 1]?.category && (
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase',
                            letterSpacing: '0.06em', marginBottom: 8,
                            paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                {group.category}
              </div>
            )}
            {/* Label + clear button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          marginBottom: 5 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                            textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {group.label}
              </div>
              {group.type !== 'period' && group.selected?.length > 0 && (
                <button
                  onClick={() => group.selected.forEach(v => group.onToggle(v))}
                  style={{ fontSize: 9, color: 'var(--text-muted)', background: 'none', border: 'none',
                           cursor: 'pointer', padding: 0 }}>
                  {t('filters.clear')}
                </button>
              )}
            </div>

            {group.type === 'period' ? (
              <PeriodGroup group={group} />
            ) : group.type === 'search-select' ? (
              <SearchSelectGroup group={group} />
            ) : group.type === 'radio' ? (
              <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 7,
                            padding: 2, gap: 2 }}>
                {group.options.map(opt => {
                  const active = group.selected.includes(opt.value)
                  return (
                    <button key={opt.value} onClick={() => group.onToggle(opt.value)}
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
                {group.options.map(opt => {
                  const checked = group.selected.includes(opt.value)
                  return (
                    <label key={opt.value}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                               gap: 6, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => group.onToggle(opt.value)}
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
        ))}
      </div>
    </div>
  )
}

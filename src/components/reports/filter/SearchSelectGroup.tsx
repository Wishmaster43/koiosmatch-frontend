/**
 * SearchSelectGroup — one collapsible, searchable multi-select group of filter
 * options for the report filter sidebar (a trigger button → dropdown with a
 * search box, the option checkboxes and the selected-tags row). Extracted from
 * ReportFilterSidebar.
 */
import { X, Search, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReportFilterGroup } from '@/types/reports'

export default function SearchSelectGroup({ group }: { group: ReportFilterGroup }) {
  const { t } = useTranslation('common')
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')

  const options  = group.options  ?? []
  const selected = group.selected ?? []
  const visible = options.filter(o =>
    (o.label ?? '').toLowerCase().includes(query.toLowerCase())
  )
  const hasSelected = selected.length > 0

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
            ? selected.length === 1
              ? (options.find(o => o.value === selected[0])?.label ?? selected[0])
              : t('filters.selectedCount', { count: selected.length })
            : t('filters.choose', { label: (group.label ?? '').toLowerCase() })}
        </span>
        <ChevronDown size={12} style={{ flexShrink: 0, marginLeft: 4,
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{ marginTop: 4, border: '1px solid var(--border)', borderRadius: 6,
                      background: 'var(--surface)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
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
            {options.length === 0 && (
              <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)' }}>{t('filters.noData')}</div>
            )}
            {options.length > 0 && visible.length === 0 && (
              <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)' }}>{t('noResults')}</div>
            )}
            {visible.map(opt => {
              const checked = selected.includes(opt.value)
              return (
                <label key={opt.value}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px',
                           cursor: 'pointer', background: checked ? 'var(--color-primary-bg)' : 'transparent' }}
                  onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--hover-bg)' }}
                  onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent' }}
                >
                  <input type="checkbox" checked={checked}
                    onChange={() => group.onToggle?.(opt.value)}
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
              {selected.map(val => {
                const opt = options.find(o => o.value === val)
                return (
                  <span key={val} style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
                    borderRadius: 999, padding: '2px 7px', fontSize: 10, fontWeight: 500,
                  }}>
                    {opt?.label ?? val}
                    <button onClick={() => group.onToggle?.(val)}
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

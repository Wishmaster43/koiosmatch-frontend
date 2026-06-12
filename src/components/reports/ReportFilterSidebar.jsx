import { X, Search, ChevronDown } from 'lucide-react'
import { useState } from 'react'

function SearchSelectGroup({ group }) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')

  const visible = group.options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase())
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
          background: hasSelected ? 'var(--color-primary-bg)' : '#F9FAFB',
          border: `1px solid ${hasSelected ? 'var(--color-primary)' : '#E5E7EB'}`,
          color: hasSelected ? 'var(--color-primary)' : '#374151',
        }}
      >
        <span className="truncate">
          {hasSelected
            ? group.selected.length === 1
              ? (group.options.find(o => o.value === group.selected[0])?.label ?? group.selected[0])
              : `${group.selected.length} geselecteerd`
            : `Kies ${group.label.toLowerCase()}…`}
        </span>
        <ChevronDown size={12} style={{ flexShrink: 0, marginLeft: 4,
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{ marginTop: 4, border: '1px solid #E5E7EB', borderRadius: 6,
                      background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          {/* Zoekbalk */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #F3F4F6',
                        display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={11} color="#9CA3AF" style={{ flexShrink: 0 }} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Zoek…`}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 11,
                       color: '#374151', background: 'transparent', padding: 0 }}
            />
            {query && (
              <button onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}>
                <X size={9} />
              </button>
            )}
          </div>

          {/* Opties */}
          <div style={{ maxHeight: 160, overflowY: 'auto', padding: '4px 0' }}>
            {group.options.length === 0 && (
              <div style={{ padding: '6px 10px', fontSize: 11, color: '#9CA3AF' }}>Geen data beschikbaar</div>
            )}
            {group.options.length > 0 && visible.length === 0 && (
              <div style={{ padding: '6px 10px', fontSize: 11, color: '#9CA3AF' }}>Geen resultaten</div>
            )}
            {visible.map(opt => {
              const checked = group.selected.includes(opt.value)
              return (
                <label key={opt.value}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px',
                           cursor: 'pointer', background: checked ? 'var(--color-primary-bg)' : 'transparent' }}
                  onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent' }}
                >
                  <input type="checkbox" checked={checked}
                    onChange={() => group.onToggle(opt.value)}
                    style={{ accentColor: 'var(--color-primary)', width: 12, height: 12, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: checked ? 'var(--color-primary)' : '#374151',
                                 fontWeight: checked ? 500 : 400, overflow: 'hidden',
                                 textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                </label>
              )
            })}
          </div>

          {/* Geselecteerde tags + sluiten */}
          {hasSelected && (
            <div style={{ padding: '5px 8px', borderTop: '1px solid #F3F4F6',
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

export default function ReportFilterSidebar({ title = 'Filters', groups = [], onClose }) {
  return (
    <div className="flex flex-col flex-shrink-0 bg-white"
      style={{ width: 210, borderLeft: '1px solid #F3F4F6' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderBottom: '1px solid #F3F4F6' }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>{title}</span>
        <button onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                   width: 22, height: 22, background: 'none', border: 'none',
                   cursor: 'pointer', color: '#9CA3AF', borderRadius: 4 }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
          <X size={13} />
        </button>
      </div>

      {/* Groepen */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.map(group => (
          <div key={group.key}>
            {/* Label */}
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF',
                          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
              {group.label}
            </div>

            {group.type === 'search-select' ? (
              <SearchSelectGroup group={group} />
            ) : group.type === 'radio' ? (
              // Gesegmenteerde toggle — single select
              <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 7,
                            padding: 2, gap: 2 }}>
                {group.options.map(opt => {
                  const active = group.selected.includes(opt.value)
                  return (
                    <button key={opt.value} onClick={() => group.onToggle(opt.value)}
                      style={{
                        flex: 1, padding: '4px 0', borderRadius: 5, fontSize: 11,
                        fontWeight: active ? 600 : 400, cursor: 'pointer',
                        border: active ? '1px solid #E5E7EB' : '1px solid transparent',
                        background: active ? 'white' : 'transparent',
                        color: active ? '#111827' : '#6B7280',
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
                        <span style={{ fontSize: 12, color: checked ? '#111827' : '#6B7280',
                                       overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {opt.label}
                        </span>
                      </div>
                      {opt.count !== undefined && (
                        <span style={{
                          flexShrink: 0, fontFamily: 'monospace', borderRadius: 999,
                          padding: '1px 5px', fontSize: 10,
                          background: checked ? 'var(--color-primary-bg)' : '#F3F4F6',
                          color:      checked ? 'var(--color-primary)'    : '#9CA3AF',
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

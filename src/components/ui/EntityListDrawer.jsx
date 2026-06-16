/**
 * EntityListDrawer — generic slide-in panel that lists the records behind a KPI tile.
 *
 * items: Array<{ primary: string, secondary?: string, badge?: string, badgeColor?: string, badgeBg?: string }>
 */
import { X, Search } from 'lucide-react'
import { useState } from 'react'

export default function EntityListDrawer({ title, items, onClose }) {
  const [search, setSearch] = useState('')

  const q = search.toLowerCase()
  const filtered = q
    ? items.filter(it =>
        (it.primary ?? '').toLowerCase().includes(q) ||
        (it.secondary ?? '').toLowerCase().includes(q)
      )
    : items

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-white"
           style={{ width: 480, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      padding: '14px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{items.length} resultaten</div>
          </div>
          <button onClick={onClose}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                     background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                     borderRadius: 6, marginLeft: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div style={{ flexShrink: 0, padding: '8px 14px', borderBottom: '1px solid #F9FAFB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                        background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 7 }}>
            <Search size={13} color="#9CA3AF" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Zoeken…"
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none',
                       fontSize: 12, color: '#374151' }} />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 120, fontSize: 13, color: '#9CA3AF' }}>
              Geen resultaten
            </div>
          )}
          {filtered.map((item, i) => (
            <div key={i}
              style={{ padding: '10px 16px', borderBottom: '1px solid #F3F4F6',
                       display: 'flex', alignItems: 'center', gap: 10 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: '#111827',
                               whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.primary}
                </div>
                {item.secondary && (
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{item.secondary}</div>
                )}
              </div>
              {item.badge && (
                <span style={{ background: item.badgeBg ?? '#F9FAFB', color: item.badgeColor ?? '#6B7280',
                               borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 16px', borderTop: '1px solid #F3F4F6', background: '#FAFAFA',
                      flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
            {filtered.length} van {items.length} getoond
          </span>
          <button onClick={onClose}
            style={{ fontSize: 12, borderRadius: 6, padding: '4px 12px',
                     background: 'none', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280' }}>
            Sluiten
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * EntityListDrawer — generic slide-in panel that lists the records behind a KPI tile.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { X, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface EntityListItem {
  primary: string
  secondary?: string
  badge?: string
  badgeColor?: string
  badgeBg?: string
}

interface EntityListDrawerProps {
  title?: ReactNode
  items: EntityListItem[]
  onClose: () => void
}

export default function EntityListDrawer({ title, items, onClose }: EntityListDrawerProps) {
  const { t } = useTranslation('common')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
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

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1}
           className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-white"
           style={{ width: 480, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('resultsCount', { count: items.length })}</div>
          </div>
          <button onClick={onClose} aria-label={t('common:close')}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                     background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                     borderRadius: 6, marginLeft: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div style={{ flexShrink: 0, padding: '8px 14px', borderBottom: '1px solid var(--hover-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                        background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 7 }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('search')} aria-label={t('search')}
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none',
                       fontSize: 12, color: 'var(--text)' }} />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 120, fontSize: 13, color: 'var(--text-muted)' }}>
              {t('noResults')}
            </div>
          )}
          {filtered.map((item, i) => (
            <div key={i}
              style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)',
                       display: 'flex', alignItems: 'center', gap: 10 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)',
                               whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.primary}
                </div>
                {item.secondary && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.secondary}</div>
                )}
              </div>
              {item.badge && (
                <span style={{ background: item.badgeBg ?? 'var(--hover-bg)', color: item.badgeColor ?? 'var(--text-muted)',
                               borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--hover-bg)',
                      flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {t('shownOf', { shown: filtered.length, total: items.length })}
          </span>
          <button onClick={onClose}
            style={{ fontSize: 12, borderRadius: 6, padding: '4px 12px',
                     background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}>
            {t('close')}
          </button>
        </div>
      </div>
    </>
  )
}

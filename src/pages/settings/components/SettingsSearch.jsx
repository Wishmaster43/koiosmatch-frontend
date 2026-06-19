/**
 * SettingsSearch — a ⌘K command-palette over the settings. Its index is built
 * automatically from the visible registry items (translated nav + group labels),
 * so every new setting is searchable for free — no separate index to maintain.
 * Selecting a result jumps to its category + tab.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, CornerDownLeft } from 'lucide-react'

export default function SettingsSearch({ open, onClose, groups, onSelect }) {
  const { t } = useTranslation('settings')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  // Flatten the visible registry into searchable entries once per groups change.
  const entries = useMemo(() => groups.flatMap(group =>
    group.items.map(item => ({
      groupKey: group.key,
      id: item.id,
      icon: item.icon,
      label: t(`nav.${item.id}`),
      group: t(`groups.${group.key}`),
    })),
  ), [groups, t])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(e =>
      e.label.toLowerCase().includes(q) || e.group.toLowerCase().includes(q))
  }, [entries, query])

  useEffect(() => { setActive(0) }, [query])
  useEffect(() => { if (open) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 0) } }, [open])

  if (!open) return null

  const choose = (e) => { if (e) { onSelect(e.groupKey, e.id); onClose() } }
  const onKeyDown = (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)) }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (ev.key === 'Enter') { ev.preventDefault(); choose(results[active]) }
    else if (ev.key === 'Escape') { ev.preventDefault(); onClose() }
  }

  return (
    <div onMouseDown={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(17,24,39,0.35)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh',
    }}>
      <div onMouseDown={e => e.stopPropagation()} style={{
        width: 'min(560px, 92vw)', background: 'white', borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
          <Search size={16} style={{ color: '#9CA3AF', flexShrink: 0 }} />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder={t('shell.search')}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#111827', background: 'transparent' }} />
        </div>

        <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: 6 }}>
          {results.length === 0 && (
            <div style={{ padding: '22px 14px', textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>
              {t('shell.noResults')}
            </div>
          )}
          {results.map((e, i) => {
            const Icon = e.icon
            const isActive = i === active
            return (
              <button key={`${e.groupKey}/${e.id}`} onMouseEnter={() => setActive(i)} onClick={() => choose(e)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                }}>
                {Icon && <Icon size={15} style={{ flexShrink: 0, color: isActive ? 'var(--color-primary)' : '#9CA3AF' }} />}
                <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{e.label}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>{e.group}</span>
                {isActive && <CornerDownLeft size={13} style={{ color: '#C4C4CF', flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

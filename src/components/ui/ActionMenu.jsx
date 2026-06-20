/**
 * ActionMenu — generic drill-in dropdown for batch/row actions.
 *
 * One trigger button opens a panel; each item either fires directly, drills into
 * a sub-panel, or opens a (searchable) option list. Navigation is drill-in: a
 * "back" header returns one level. Dumb + data-driven — no API or business logic
 * lives here; callers pass an `items` tree and callbacks. Reuse for any table's
 * bulk bar or row menu.
 *
 * Node shapes (kind inferred from which field is present):
 *   action     : { key, label, icon?, danger?, onSelect }
 *   submenu    : { key, label, icon?, items: Node[] }
 *   optionList : { key, label, icon?, searchable?, searchPlaceholder?, emptyText?,
 *                  options: [{ value, label, color?, icon? }], onPick }
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, ArrowLeft, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Shared inline styles (CSS-var tokens only, theme-aware).
const headerStyle = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
  fontSize: 12, color: 'var(--text)', background: 'var(--color-primary-bg)',
  border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
}
const rowStyle = (danger) => ({
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
  fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
  color: danger ? 'var(--color-danger)' : 'var(--text)',
})
const hoverOn = e => { e.currentTarget.style.background = 'var(--hover-bg)' }
const hoverOff = e => { e.currentTarget.style.background = 'none' }

export default function ActionMenu({ label, icon: Icon, items = [], menuWidth = 248, align = 'left', disabled = false }) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  // Drill-in stack: each entry is the node we descended into (last = current level).
  const [path, setPath] = useState([])
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  // Reset navigation + search whenever the menu closes.
  const close = () => { setOpen(false); setPath([]); setQuery('') }
  const back = () => { setPath(p => p.slice(0, -1)); setQuery('') }

  // Close on outside click while open.
  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) close() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Move focus into the panel on open/drill: the search box autofocuses itself,
  // otherwise the first menu item, so the menu is keyboard-operable immediately.
  useEffect(() => {
    if (!open) return
    ref.current?.querySelector('input, [data-menuitem]')?.focus()
  }, [open, path])

  // Current level: root items, or the node we last drilled into.
  const current = path[path.length - 1] ?? null
  const levelItems = current ? (current.items ?? null) : items
  const optionNode = current && current.options ? current : null

  // Drill into a submenu/option node, or fire a leaf action and close.
  const choose = (node) => {
    if (node.items || node.options) { setPath(p => [...p, node]); setQuery('') }
    else { node.onSelect?.(); close() }
  }

  // Pick an option inside an option-list node, then close.
  const pick = (value) => { optionNode?.onPick?.(value); close() }

  // Esc steps back one level (or closes at root); arrows roam the menu items.
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); path.length ? back() : close(); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const nodes = [...(ref.current?.querySelectorAll('[data-menuitem]') ?? [])]
      if (!nodes.length) return
      const i = nodes.indexOf(document.activeElement)
      const n = nodes.length
      nodes[e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n]?.focus()
    }
  }

  // Filter the option list by the search query (case-insensitive on label).
  const shownOptions = useMemo(() => {
    if (!optionNode) return []
    const q = query.trim().toLowerCase()
    return q ? optionNode.options.filter(o => (o.label ?? '').toLowerCase().includes(q)) : optionNode.options
  }, [optionNode, query])

  return (
    <div ref={ref} style={{ position: 'relative' }} onKeyDown={onKeyDown}>
      {/* Trigger */}
      <button type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500,
          border: `1px solid ${open ? 'var(--color-primary)' : 'var(--border)'}`, borderRadius: 7,
          background: 'var(--surface)', color: 'var(--text)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
        {Icon && <Icon size={13} />}
        <span>{label}</span>
        <ChevronDown size={13} />
      </button>

      {open && (
        <div role="menu" aria-label={label}
          style={{ position: 'absolute', top: '100%', [align]: 0, zIndex: 200, marginTop: 4, width: menuWidth,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden' }}>

          {/* Back header when drilled into a sub-level */}
          {current && (
            <button type="button" onClick={back} style={headerStyle} aria-label={t('back')}>
              <ArrowLeft size={14} />
              <span style={{ fontWeight: 600 }}>{current.label}</span>
            </button>
          )}

          {/* Search box for an option-list level (unless explicitly disabled) */}
          {optionNode && optionNode.searchable !== false && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={optionNode.searchPlaceholder ?? t('search')}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'none', color: 'var(--text)' }} />
            </div>
          )}

          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {/* Submenu / root: action + drill rows */}
            {levelItems && levelItems.map(node => (
              <button key={node.key} type="button" role="menuitem" data-menuitem onClick={() => choose(node)}
                style={rowStyle(node.danger)} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                {node.icon && <node.icon size={14} style={{ flexShrink: 0 }} />}
                <span style={{ flex: 1 }}>{node.label}</span>
                {(node.items || node.options) && <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              </button>
            ))}

            {/* Option list: empty state + searchable options */}
            {optionNode && shownOptions.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                {query ? t('noResults') : (optionNode.emptyText ?? t('noResults'))}
              </div>
            )}
            {optionNode && shownOptions.map(o => (
              <button key={o.value} type="button" role="menuitem" data-menuitem onClick={() => pick(o.value)}
                style={rowStyle(false)} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                {o.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.color, flexShrink: 0 }} />}
                {o.icon && <o.icon size={14} style={{ flexShrink: 0 }} />}
                <span style={{ flex: 1 }}>{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

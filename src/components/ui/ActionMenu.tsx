/**
 * ActionMenu — generic drill-in dropdown for batch/row actions.
 *
 * One trigger button opens a panel; each item either fires directly, drills into
 * a sub-panel, or opens a (searchable) option list. Navigation is drill-in: a
 * "back" header returns one level. Dumb + data-driven — no API or business logic
 * lives here; callers pass an `items` tree and callbacks. Reuse for any table's
 * bulk bar or row menu.
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import type { CSSProperties, ComponentType, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import { ChevronDown, ChevronRight, ArrowLeft, Search, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Icon contract shared by the trigger, nodes and options (lucide-compatible).
type IconComponent = ComponentType<{ size?: number; style?: CSSProperties; color?: string }>

export interface MenuOption {
  value: string | number
  label?: string
  color?: string
  icon?: IconComponent
}

/**
 * A menu node — its kind is inferred from which field is present:
 *   action     : { onSelect }
 *   submenu    : { items }
 *   optionList : { options, onPick }
 *   multiSelect: { options, multiSelect: true, onSubmit }
 *   input      : { input: true, onSubmit }
 */
export interface MenuNode {
  key: string
  label?: string
  icon?: IconComponent
  danger?: boolean
  onSelect?: () => void
  items?: MenuNode[]
  options?: MenuOption[]
  multiSelect?: boolean
  selected?: Array<string | number>
  searchable?: boolean
  searchPlaceholder?: string
  emptyText?: string
  submitLabel?: string
  onSubmit?: (value: string | Array<string | number>) => void
  onPick?: (value: string | number) => void
  input?: boolean
  placeholder?: string
  // Optional info line shown once this node is drilled into (job 35 — e.g. flagging
  // a bulk action's real BE scope/semantics so it never reads as ambiguous).
  note?: string
}

// Shared inline styles (CSS-var tokens only, theme-aware).
const headerStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
  fontSize: 12, color: 'var(--text)', background: 'var(--color-primary-bg)',
  border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
}
const rowStyle = (danger?: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
  fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
  color: danger ? 'var(--color-danger)' : 'var(--text)',
})
const hoverOn = (e: ReactMouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'var(--hover-bg)' }
const hoverOff = (e: ReactMouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'none' }

interface ActionMenuProps {
  label?: string
  icon?: IconComponent
  items?: MenuNode[]
  menuWidth?: number
  align?: 'left' | 'right'
  disabled?: boolean
}

export default function ActionMenu({ label, icon: Icon, items = [], menuWidth = 280, align = 'left', disabled = false }: ActionMenuProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  // Drill-in stack: each entry is the node we descended into (last = current level).
  const [path, setPath] = useState<MenuNode[]>([])
  const [query, setQuery] = useState('')
  // Working selection for a multi-select level (applied via its confirm button).
  const [multiValues, setMultiValues] = useState<Array<string | number>>([])
  const ref = useRef<HTMLDivElement>(null)

  // Reset navigation + search whenever the menu closes.
  const close = () => { setOpen(false); setPath([]); setQuery(''); setMultiValues([]) }
  const back = () => { setPath(p => p.slice(0, -1)); setQuery(''); setMultiValues([]) }

  // Close on outside click while open.
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Move focus into the panel on open/drill: the search box autofocuses itself,
  // otherwise the first menu item, so the menu is keyboard-operable immediately.
  useEffect(() => {
    if (!open) return
    const el = ref.current?.querySelector('input, textarea, [data-menuitem]')
    if (el instanceof HTMLElement) el.focus()
  }, [open, path])

  // Current level: root items, or the node we last drilled into.
  const current = path[path.length - 1] ?? null
  const levelItems = current ? (current.items ?? null) : items
  const optionNode = current && current.options && !current.multiSelect ? current : null
  const multiNode  = current && current.options && current.multiSelect ? current : null
  const listNode   = optionNode ?? multiNode
  const inputNode = current && current.input ? current : null

  // Drill into a submenu/option/input node, or fire a leaf action and close.
  const choose = (node: MenuNode) => {
    if (node.items || node.options || node.input) {
      setPath(p => [...p, node]); setQuery('')
      if (node.multiSelect) setMultiValues(node.selected ?? [])
    } else { node.onSelect?.(); close() }
  }
  // Toggle one value in the multi-select working set.
  const toggleMulti = (value: string | number) => setMultiValues(v => v.includes(value) ? v.filter(x => x !== value) : [...v, value])

  // Pick an option inside an option-list node, then close.
  const pick = (value: string | number) => { optionNode?.onPick?.(value); close() }

  // Esc steps back one level (or closes at root); arrows roam the menu items.
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); if (path.length) back(); else close(); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const nodes = [...(ref.current?.querySelectorAll('[data-menuitem]') ?? [])]
      if (!nodes.length) return
      e.preventDefault()
      const i = nodes.indexOf(document.activeElement as Element)
      const n = nodes.length
      const target = nodes[e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n]
      if (target instanceof HTMLElement) target.focus()
    }
  }

  // Filter the option list by the search query (case-insensitive on label).
  const shownOptions = useMemo(() => {
    if (!listNode) return []
    const q = query.trim().toLowerCase()
    const options = listNode.options ?? []
    return q ? options.filter(o => (o.label ?? '').toLowerCase().includes(q)) : options
  }, [listNode, query])

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
          style={{ position: 'absolute', top: '100%', zIndex: 200, marginTop: 4, minWidth: menuWidth, maxWidth: 'min(420px, 90vw)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden',
            ...(align === 'right' ? { right: 0 } : { left: 0 }) }}>

          {/* Back header when drilled into a sub-level */}
          {current && (
            <button type="button" onClick={back} style={headerStyle} aria-label={t('back')}>
              <ArrowLeft size={14} />
              <span style={{ fontWeight: 600 }}>{current.label}</span>
            </button>
          )}

          {/* Optional info line for the current level (job 35) — e.g. clarifying that a
              bulk action applies per the backend's actual scope, not a vacancy the user picks. */}
          {current?.note && (
            <div style={{ padding: '8px 12px', fontSize: 11, lineHeight: 1.4, color: 'var(--text-muted)',
              background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)' }}>
              {current.note}
            </div>
          )}

          {/* Search box for an option/multi-select level (unless explicitly disabled) */}
          {listNode && listNode.searchable !== false && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={listNode.searchPlaceholder ?? t('search')}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'none', color: 'var(--text)' }} />
            </div>
          )}

          {/* Free-text input level: textarea + submit (e.g. add a note) */}
          {inputNode && (
            <div style={{ padding: 10 }}>
              <textarea value={query} onChange={e => setQuery(e.target.value)} rows={4} placeholder={inputNode.placeholder ?? ''}
                style={{ width: '100%', resize: 'vertical', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px',
                  fontSize: 12, color: 'var(--text)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
              <button type="button" disabled={!query.trim()}
                onClick={() => { const v = query.trim(); if (v) { inputNode.onSubmit?.(v); close() } }}
                style={{ marginTop: 8, width: '100%', padding: '8px 10px', fontSize: 12, fontWeight: 500, border: 'none', borderRadius: 7,
                  background: 'var(--color-primary)', color: '#fff', cursor: query.trim() ? 'pointer' : 'not-allowed', opacity: query.trim() ? 1 : 0.5 }}>
                {inputNode.submitLabel ?? t('save')}
              </button>
            </div>
          )}

          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {/* Submenu / root: action + drill rows */}
            {levelItems && levelItems.map(node => (
              <button key={node.key} type="button" role="menuitem" data-menuitem onClick={() => choose(node)}
                style={rowStyle(node.danger)} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                {node.icon && <node.icon size={14} style={{ flexShrink: 0 }} />}
                <span style={{ flex: 1 }}>{node.label}</span>
                {(node.items || node.options || node.input) && <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              </button>
            ))}

            {/* Option/multi list: shared empty state */}
            {listNode && shownOptions.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                {query ? t('noResults') : (listNode.emptyText ?? t('noResults'))}
              </div>
            )}
            {/* Single-pick options: fire + close */}
            {optionNode && shownOptions.map(o => (
              <button key={o.value} type="button" role="menuitem" data-menuitem onClick={() => pick(o.value)}
                style={rowStyle(false)} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                {o.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.color, flexShrink: 0 }} />}
                {o.icon && <o.icon size={14} style={{ flexShrink: 0 }} />}
                <span style={{ flex: 1 }}>{o.label}</span>
              </button>
            ))}
            {/* Multi-select options: toggle; applied via the confirm button below */}
            {multiNode && shownOptions.map(o => {
              const on = multiValues.includes(o.value)
              return (
                <button key={o.value} type="button" role="menuitemcheckbox" aria-checked={on} data-menuitem
                  onClick={() => toggleMulti(o.value)} style={rowStyle(false)} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                  <span style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1.5px solid ${on ? 'var(--color-primary)' : 'var(--border)'}`, background: on ? 'var(--color-primary)' : 'transparent' }}>
                    {on && <Check size={10} color="#fff" />}
                  </span>
                  {o.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.color, flexShrink: 0 }} />}
                  <span style={{ flex: 1 }}>{o.label}</span>
                </button>
              )
            })}
          </div>

          {/* Multi-select confirm bar — applies the exact chosen set (may be empty). */}
          {multiNode && (
            <div style={{ padding: 10, borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => { multiNode.onSubmit?.(multiValues); close() }}
                style={{ width: '100%', padding: '8px 10px', fontSize: 12, fontWeight: 500, border: 'none', borderRadius: 7,
                  background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>
                {(multiNode.submitLabel ?? t('save'))}{multiValues.length ? ` (${multiValues.length})` : ''}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

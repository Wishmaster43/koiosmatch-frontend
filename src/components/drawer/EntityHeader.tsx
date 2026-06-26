/**
 * EntityHeader — the configurable top of an EntityDrawer, reused by every entity.
 *
 * Renders: a small type label + expand/close, an avatar (optional photo upload
 * menu), title/subtitle (or a custom renderTitle), right-side actions, a row of
 * meta pickers (status/owner/type…), optional extra `children`, and a tag editor.
 */
import { useState, useRef, useEffect } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { X, Maximize2, Minimize2, Camera } from 'lucide-react'
import AvatarJs from '../ui/Avatar'
import SelectMenuJs from '../ui/SelectMenu'

type AnyProps = Record<string, unknown>
// Still-untyped JS UI — accept any props at the boundary.
const Avatar = AvatarJs as unknown as ComponentType<AnyProps>
const SelectMenu = SelectMenuJs as unknown as ComponentType<AnyProps>

interface AvatarConfig { initials?: string; photo?: string | null; color?: string | null; soft?: boolean }
interface PhotoLabels { upload?: string; remove?: string }

function PhotoAvatar({ avatar, onChange, labels }: { avatar: AvatarConfig; onChange?: (url: string) => void; labels?: PhotoLabels }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  if (!onChange) return <Avatar initials={avatar.initials} size={44} photo={avatar.photo} color={avatar.color} soft={avatar.soft} />

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setMenuOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block', position: 'relative', borderRadius: '50%' }}>
        <Avatar initials={avatar.initials} size={44} photo={avatar.photo} color={avatar.color} soft={avatar.soft} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
          <Camera size={14} color="white" />
        </div>
      </button>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { onChange(URL.createObjectURL(f)); setMenuOpen(false) } }} />
      {menuOpen && (
        <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 200, background: 'white',
          border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: 140 }}>
          <button onClick={() => { fileRef.current?.click(); setMenuOpen(false) }}
            style={{ display: 'block', width: '100%', padding: '9px 14px', fontSize: 12, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            {labels?.upload ?? 'Upload'}
          </button>
          <button onClick={() => { onChange(''); setMenuOpen(false) }}
            style={{ display: 'block', width: '100%', padding: '9px 14px', fontSize: 12, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-danger-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            {labels?.remove ?? 'Remove'}
          </button>
        </div>
      )}
    </div>
  )
}

function TagRow({ items = [], onAdd, onRemove, addLabel }: { items?: string[]; onAdd: (v: string) => void; onRemove: (tag: string) => void; addLabel?: string }) {
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])
  const commit = () => { if (value.trim()) onAdd(value.trim()); setValue(''); setAdding(false) }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
      {items.map(tag => (
        <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '3px 8px', borderRadius: 99,
          border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
          {tag}
          <button onClick={() => onRemove(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 13 }}>×</button>
        </span>
      ))}
      {adding ? (
        <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(''); setAdding(false) } }}
          onBlur={commit} placeholder={addLabel}
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 99, border: '1px solid var(--color-primary)', outline: 'none', color: 'var(--text)', width: 110 }} />
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 99, border: '1px dashed var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>+</button>
      )}
    </div>
  )
}

export interface MetaPicker {
  key: string
  label?: ReactNode
  value?: unknown
  options?: unknown
  // SelectMenu emits the picked option's value (a string from the <select>).
  onChange?: (v: string) => void
  placeholder?: string
  width?: number
  menuWidth?: number
}

interface EntityHeaderProps {
  label?: ReactNode
  avatar?: AvatarConfig
  onPhotoChange?: (url: string) => void
  photoLabels?: PhotoLabels
  title?: ReactNode
  subtitle?: ReactNode
  renderTitle?: () => ReactNode
  actions?: ReactNode
  meta?: MetaPicker[]
  metaExtra?: ReactNode
  tags?: { items?: string[]; onAdd: (v: string) => void; onRemove: (tag: string) => void; addLabel?: string }
  tagsLabel?: ReactNode
  children?: ReactNode
  expanded?: boolean
  onToggleExpand?: () => void
  onClose?: () => void
}

export default function EntityHeader({
  label, avatar, onPhotoChange, photoLabels, title, subtitle, renderTitle,
  actions, meta = [], metaExtra, tags, tagsLabel, children, expanded, onToggleExpand, onClose,
}: EntityHeaderProps) {
  return (
    <>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', flex: 1 }}>{label}</span>
        <button onClick={onToggleExpand} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
          <X size={15} />
        </button>
      </div>

      {/* Avatar + title + actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        {avatar && <PhotoAvatar avatar={avatar} onChange={onPhotoChange} labels={photoLabels} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          {renderTitle ? renderTitle() : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
              {subtitle != null && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle || '—'}</div>}
            </>
          )}
        </div>
        {actions && <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>{actions}</div>}
      </div>

      {/* Meta pickers (status / owner / type / …) */}
      {(meta.length > 0 || metaExtra) && (
        <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          {meta.map(m => (
            // Compact, fixed-width picker (no flex-grow) so the pickers stay tight
            // and left-aligned instead of stretching across the whole header.
            <div key={m.key} style={{ width: m.width ?? 200, maxWidth: '100%', minWidth: 0, flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{m.label}</div>
              <SelectMenu value={m.value} options={m.options} onChange={m.onChange} placeholder={m.placeholder} menuWidth={m.menuWidth ?? 180} />
            </div>
          ))}
          {/* Trailing meta content (e.g. funnel chips) fills the space beside the pickers. */}
          {metaExtra && <div style={{ flex: 1, minWidth: 140, alignSelf: 'flex-end' }}>{metaExtra}</div>}
        </div>
      )}

      {/* Extra header content (e.g. vacancy link, last contact) */}
      {children}

      {/* Tags */}
      {tags && (
        <div style={{ marginBottom: 12 }}>
          {tagsLabel && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{tagsLabel}</div>}
          <TagRow items={tags.items} onAdd={tags.onAdd} onRemove={tags.onRemove} addLabel={tags.addLabel} />
        </div>
      )}
    </>
  )
}

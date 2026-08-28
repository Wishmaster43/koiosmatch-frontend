/**
 * EntityHeader — the configurable top of an EntityDrawer, reused by every entity.
 *
 * Renders: a small type label + expand/close, an avatar (optional photo upload
 * menu), title/subtitle (or a custom renderTitle), right-side actions, a row of
 * meta pickers (status/owner/type…), optional extra `children`, and a tag editor.
 */
import { useState, useRef, useEffect } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Maximize2, Minimize2, Camera } from 'lucide-react'
import AvatarJs from '../ui/Avatar'
import SelectMenuJs from '../ui/SelectMenu'
// PORTAL-MARKER-1: a click inside an open portalled picker menu is never "outside".
import { isInsideDropdownPortal } from '@/lib/useDropdownPlacement'
import { Z } from '@/lib/zIndexScale'
import Button from '@/components/ui/Button'
import { PageTitle, SectionTitle, Caption } from '@/components/ui/typography'
import { useEscapeLayer } from '@/hooks/useEscapeLayer'

type AnyProps = Record<string, unknown>
// Still-untyped JS UI — accept any props at the boundary.
const Avatar = AvatarJs as unknown as ComponentType<AnyProps>
const SelectMenu = SelectMenuJs as unknown as ComponentType<AnyProps>

interface AvatarConfig { initials?: string; photo?: string | null; color?: string | null; soft?: boolean }
interface PhotoLabels { upload?: string; remove?: string; change?: string }

function PhotoAvatar({ avatar, onChange, labels }: { avatar: AvatarConfig; onChange?: (url: string) => void; labels?: PhotoLabels }) {
  // §5 fallbacks resolve via i18n, never a literal — a caller without labels
  // still gets translated names (Opus-verificatie heraudit, MINOR A).
  const { t } = useTranslation('common')
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Tracks the blob: URL this component created for the picked photo, so it can be
  // revoked when replaced/removed and on unmount — otherwise every upload leaks memory.
  const createdUrlRef = useRef<string | null>(null)

  // Close the photo menu on an outside click; a click inside a portalled dropdown
  // is never "outside" (PORTAL-MARKER-1), so it doesn't get mistaken for a dismiss.
  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => { if (isInsideDropdownPortal(e.target as Node)) return; if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  // Revoke the last object URL we created on unmount (drawer closed mid-edit, etc.).
  useEffect(() => () => { if (createdUrlRef.current) URL.revokeObjectURL(createdUrlRef.current) }, [])

  if (!onChange) return <Avatar initials={avatar.initials} size={44} photo={avatar.photo} color={avatar.color} soft={avatar.soft} />

  // Revoke the previous blob URL (if any) before creating+tracking one for the new file.
  const pickFile = (f: File) => {
    if (createdUrlRef.current) URL.revokeObjectURL(createdUrlRef.current)
    const url = URL.createObjectURL(f)
    createdUrlRef.current = url
    onChange(url)
  }

  // Clearing the photo also revokes any blob URL we were still holding.
  const removePhoto = () => {
    if (createdUrlRef.current) { URL.revokeObjectURL(createdUrlRef.current); createdUrlRef.current = null }
    onChange('')
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setMenuOpen(o => !o)}
        // A11Y-3 (heraudit): the icon-only photo trigger sits on EVERY entity
        // drawer header — it carries a name and its menu semantics.
        aria-label={labels?.change ?? t('photoChange')}
        aria-haspopup="menu" aria-expanded={menuOpen}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- circular avatar photo-picker trigger (wraps the round Avatar itself), not a rectangular Button shape
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block', position: 'relative', borderRadius: '50%' }}>
        <Avatar initials={avatar.initials} size={44} photo={avatar.photo} color={avatar.color} soft={avatar.soft} />
        {/* Fixed dark photo scrim (not a themed token on purpose — it darkens the avatar
            PHOTO, not an app surface, so it must stay the same in light and dark mode);
            white on a 35%-black scrim clears contrast in both themes. */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
          <Camera size={14} color="white" />
        </div>
      </button>
      <input ref={fileRef} type="file" accept="image/*" aria-label={labels?.upload ?? t('photoUpload')} style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { pickFile(f); setMenuOpen(false) } }} />
      {menuOpen && (
        // Themed surface, not a raw 'white' — this menu floats over the app in both
        // light and dark mode, and a hardcoded white background broke dark mode.
        // FROZEN candidate-drawer zone value-preserving swap: 200 → Z.modal (also 200).
        <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: Z.modal, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-float)', overflow: 'hidden', minWidth: 140 }}>
          <button onClick={() => { fileRef.current?.click(); setMenuOpen(false) }}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- full-width dropdown menu-item row with an imperative hover swap, not a standalone Button
            style={{ display: 'block', width: '100%', padding: '9px 14px', fontSize: 12, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            {labels?.upload ?? t('photoUpload')}
          </button>
          <button onClick={() => { removePhoto(); setMenuOpen(false) }}
            // Ink is --color-on-danger-bg, not --color-danger: on hover this row sits ON
            // the danger-bg pastel where the raw danger colour reads only 3.95:1 (Opus
            // r3.5); at rest it is on the neutral surface, where the darker on-danger-bg
            // twin stays just as readable, so one ink covers both states.
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- full-width dropdown menu-item row with an imperative hover swap, not a standalone Button
            style={{ display: 'block', width: '100%', padding: '9px 14px', fontSize: 12, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-on-danger-bg)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-danger-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            {labels?.remove ?? t('remove')}
          </button>
        </div>
      )}
    </div>
  )
}

// Renders the tag chip list with an inline "+" add input and click-to-rename per chip
// (rename commits as remove(old)+add(new) so any add/remove-only wiring keeps working).
function TagRow({ items = [], onAdd, onRemove, addLabel }: { items?: string[]; onAdd: (v: string) => void; onRemove: (tag: string) => void; addLabel: string }) {
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')
  // Tag-edit-in-place (Danny punt 51, 16-07): click a tag to rename it — commit
  // as remove(old)+add(new) so every existing onAdd/onRemove wiring keeps working.
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLInputElement>(null)
  // Focus follows the input that just appeared, so adding or renaming a tag stays a
  // keyboard flow: the click that opened it never has to be followed by a second click.
  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])
  useEffect(() => { if (editing != null) editRef.current?.focus() }, [editing])
  const commit = () => { if (value.trim()) onAdd(value.trim()); setValue(''); setAdding(false) }
  // Renaming a tag has no dedicated API, so it commits as remove(old) + add(new); a
  // no-op (empty or unchanged value) just exits edit mode without calling either.
  const commitEdit = () => {
    const next = editValue.trim()
    if (editing != null && next && next !== editing) { onRemove(editing); onAdd(next) }
    setEditing(null); setEditValue('')
  }
  // Inline-edit-cancel layers: the add-tag input and the per-tag rename input each
  // cancel their own mode on Escape, without stealing it from an outer overlay.
  useEscapeLayer(adding, () => { setValue(''); setAdding(false) })
  useEscapeLayer(editing != null, () => { setEditing(null); setEditValue('') })

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
      {items.map(tag => editing === tag ? (
        <input key={tag} ref={editRef} value={editValue} onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}
          onBlur={commitEdit} aria-label={tag}
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 99, border: '1px solid var(--color-primary)', color: 'var(--text)', width: Math.max(70, tag.length * 7 + 30) }} />
      ) : (
        <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '3px 8px', borderRadius: 99,
          border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
          <button onClick={() => { setEditing(tag); setEditValue(tag) }} title={tag}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- inline click-to-rename label inside the tag chip, inherits the chip's own text style, not a Button
            style={{ background: 'none', border: 'none', cursor: 'text', color: 'inherit', font: 'inherit', padding: 0 }}>
            {tag}
          </button>
          {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- inline chip-remove glyph sized to the 11px tag chip, not a standalone Button */}
          <button onClick={() => onRemove(tag)} aria-label={`× ${tag}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 13 }}>×</button>
        </span>
      ))}
      {adding ? (
        <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit() }}
          onBlur={commit} placeholder={addLabel} aria-label={addLabel}
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 99, border: '1px solid var(--color-primary)', color: 'var(--text)', width: 110 }} />
      ) : (
        <button onClick={() => setAdding(true)} aria-label={addLabel}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- compact dashed-pill add-tag trigger sized to match the tag chip row (11px), not a toolbar Button
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
  // Record-level meta controls in the top title-row, left of expand/close
  // (e.g. a changelog popover). Read-only/meta, not primary actions.
  titleActions?: ReactNode
  actions?: ReactNode
  meta?: MetaPicker[]
  metaExtra?: ReactNode
  tags?: { items?: string[]; onAdd: (v: string) => void; onRemove: (tag: string) => void; addLabel: string }
  tagsLabel?: ReactNode
  children?: ReactNode
  expanded?: boolean
  onToggleExpand?: () => void
  onClose?: () => void
}

// The shared drawer header shell: title row + expand/close, avatar/title/actions,
// meta pickers and tags — every entity drawer composes this instead of its own markup.
export default function EntityHeader({
  label, avatar, onPhotoChange, photoLabels, title, subtitle, renderTitle,
  titleActions, actions, meta = [], metaExtra, tags, tagsLabel, children, expanded, onToggleExpand, onClose,
}: EntityHeaderProps) {
  const { t } = useTranslation('common')
  return (
    <>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        {/* Muted override is the calm-header design (§3A): this is the drawer's
            entity LABEL, not a content heading — size/weight stay the atom's. */}
        <SectionTitle as="span" style={{ color: 'var(--text-muted)', flex: 1 }}>{label}</SectionTitle>
        {titleActions}
        <Button variant="ghost" iconOnly onClick={onToggleExpand} aria-label={expanded ? t('collapse') : t('expand')}>
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </Button>
        {/* SWEEP-ESC: `data-drawer-close` is the hook the shared EntityDrawer shell uses
            to close on Escape — it finds and clicks THIS exact button, so every entity
            drawer inherits Escape-to-close from one place with zero caller changes. */}
        <Button variant="ghost" iconOnly onClick={onClose} aria-label={t('close')} data-drawer-close>
          <X size={15} />
        </Button>
      </div>

      {/* Avatar + title + actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        {avatar && <PhotoAvatar avatar={avatar} onChange={onPhotoChange} labels={photoLabels} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          {renderTitle ? renderTitle() : (
            <>
              <PageTitle style={{ fontWeight: 700 }}>{title}</PageTitle>
              {!!subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>}
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
              <Caption as="div" style={{ marginBottom: 4 }}>{m.label}</Caption>
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

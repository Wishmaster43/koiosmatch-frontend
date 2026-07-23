import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { resolveDocTypeIcon, DOC_TYPE_ICON_NAMES } from '@/lib/useDocumentTypes'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'

/** A compact popover grid of the curated document-type icon set (DOCTYPE-ICON-1).
 * Anchored under its trigger button; closes on an outside click (mirrors the
 * ColorPickerPopup pattern in SettingsControls, kept local since this curated
 * 8-icon grid is specific to document types, not a generic lookup control). */
function IconPickerPopup({ onPick, onClose }) {
  const { t } = useTranslation('settings')
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  return (
    <div ref={ref} role="menu" style={{ position: 'absolute', zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', top: 34, left: 0,
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, width: 168 }}>
      {DOC_TYPE_ICON_NAMES.map(name => {
        const Icon = resolveDocTypeIcon(name)
        return (
          <button key={name} type="button" role="menuitem" onClick={() => onPick(name)} title={name}
            aria-label={`${t('documentTypes.icon')}: ${name}`}
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text)' }}>
            <Icon size={15} />
          </button>
        )
      })}
    </div>
  )
}

/** One row's icon control: a compact, colour-tinted button showing the type's
 * current icon that opens the curated picker above (§4 soft-chip tint). */
function IconPickerButton({ item, onPick }) {
  const { t } = useTranslation('settings')
  const [open, setOpen] = useState(false)
  const Icon = resolveDocTypeIcon(item.icon)
  // eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a row without one stored yet, not UI chrome
  const color = item.color ?? '#6B7280'
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={`${t('documentTypes.icon')}: ${item.name}`}
        style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
          borderRadius: 6, cursor: 'pointer', color }}>
        <Icon size={14} />
      </button>
      {open && <IconPickerPopup onPick={(name) => { onPick(name); setOpen(false) }} onClose={() => setOpen(false)} />}
    </div>
  )
}

/** Document types — categorisation + colour + icon of candidate documents (CV, ID, …).
 * Tenant-maintainable lookup, backed by /document-types. Name/colour/reorder/delete
 * are managed by the shared StatusListEditor above (unchanged). The icon assignment
 * below is a bespoke curated-picker control (DOCTYPE-ICON-1): StatusListEditor's
 * generic `withIcon` knob is a free-text slug input with no curated grid, and its
 * row preview (LookupIcon) doesn't know these document-type slugs yet — so this
 * section renders its own picker using the app's curated icon set and persists
 * through the SAME per-id PUT the colour swatch above already uses. It reads its
 * own copy of the list (id + icon aren't exposed by the shared value/label lookup
 * hook) — creating or renaming a type above and reopening this screen keeps both
 * in sync; a rename mid-session only shows here after a refresh. */
export default function DocumentTypesSettings() {
  const { t } = useTranslation('settings')
  const [items, setItems] = useState([])

  // Own read of the same endpoint — alive-guarded so a fast unmount never sets stale state.
  useEffect(() => {
    let alive = true
    api.get('/document-types').then(r => { if (alive) setItems(unwrapList(r).rows) }).catch(() => {})
    return () => { alive = false }
  }, [])

  // Optimistic single-field update, reverted on failure — mirrors StatusListEditor's updateColor.
  const updateIcon = async (item, icon) => {
    const previous = items
    setItems(p => p.map(x => (x.id === item.id ? { ...x, icon } : x)))
    try { await api.put(`/document-types/${item.id}`, { icon }) } catch {
      setItems(previous)
      notifyError(t('statusList.saveFailed'))
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor withColor
        title={t('documentTypes.title')} subtitle={t('documentTypes.subtitle')}
        endpoint="/document-types" addLabel={t('documentTypes.add')} />
      {items.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{t('documentTypes.icon')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IconPickerButton item={item} onPick={(name) => updateIcon(item, name)} />
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

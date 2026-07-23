/**
 * StatusListEditor — generic CRUD list with drag-reorder and optional colour, used
 * by the Phases / Candidate status / Vacancy / Rejection sections. The section
 * passes its own title/subtitle/addLabel + endpoint; internal labels are translated.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import IconPickerControl from './IconPickerControl'
import LookupIcon from '@/components/ui/LookupIcon'
import { AlertTriangle, Check, Save, Plus, X, Trash2, RefreshCw, Pencil } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { DragList, ColorSwatch, ColorBadge, DefaultToggle } from '../components/SettingsControls'

// extraField (optioneel): { key, label, options: [{value,label}], default } —
// rendert een extra keuzeveld in de aanmaak-modal + een badge in de rij.
// flagField (optioneel): { key, label, description } — boolean gedragsvlag (R-1b:
// is_closed/is_reached); checkbox in de modal + badge in de rij. De VLAG bepaalt
// het gedrag, nooit het slug — zo werken tenant-eigen statussen op de schrijfpaden.
// defaultField (optioneel): { key, label } — SINGLETON vlag (bv. is_default), model-
// enforced op de backend (max één per lookup). Geen modal-veld: een losse
// DefaultToggle per rij "promoveert" die rij en zet alle andere rijen lokaal terug
// (optimistisch), zodat de UI de server-singleton weerspiegelt zonder een refetch.
// entity (optioneel): scopes a shared lookup (e.g. /note-types) to one owning entity —
// GET reads `?entity=X`, POST/PUT writes send `entity: X` so create/edit stay scoped
// (mirrors NoteType::ENTITIES on the backend; NOTE-TYPES-2/3).
// notFoundNotice (optioneel): a lookup requested from the backend but not deployed
// yet 404s on GET — pass a calm i18n message and the editor shows it instead of an
// empty list + live CRUD buttons that would silently fail (§3 no fake affordances).
// Omitted (default), a 404 stays silently swallowed like every other lookup here.
export default function StatusListEditor({ title, subtitle, endpoint, addLabel, withColor = true, withSave = true, compact = false, extraField = null, flagField = null, numberField = null, defaultField = null, withIcon = false, iconPicker = null, allowAdd = true, showRank = false, entity = null, notFoundNotice = null }) {
  const { t } = useTranslation('settings')
  // eslint-disable-next-line no-restricted-syntax -- DATA: default swatch colour pre-filled for a newly created lookup row, not UI chrome
  const emptyDraft = () => ({ name: '', color: '#3B8FD4', ...(withIcon ? { icon: '' } : {}), ...(extraField ? { [extraField.key]: extraField.default } : {}), ...(numberField ? { [numberField.key]: numberField.default } : {}), ...(flagField ? { [flagField.key]: false } : {}) })
  // Lookups differ in their display field: name (phases/status) vs label/value (genders/languages).
  const labelOf = (i) => i.name ?? i.label ?? i.value ?? ''
  // An item is protected when the backend marks it as referenced by existing data.
  const inUse = (i) => Boolean(i.in_use ?? i.is_used ?? i.locked ?? ((i.usage_count ?? i.candidates_count ?? 0) > 0))
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState(null)   // null = create; item = edit
  const [draft,     setDraft]     = useState(emptyDraft)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [deleting,  setDeleting]  = useState(null)
  const [settingDefaultId, setSettingDefaultId] = useState(null)

  useEffect(() => {
    // Reset every previous-load flag when the endpoint/entity identity changes —
    // otherwise a stale error/notFound/list from the OLD lookup stays on screen
    // while the new one is loading (§3: no stale state leaking across switches).
    // The alive guard drops a late response after the effect re-runs or unmounts.
    let alive = true
    setLoading(true)
    setLoadError(false)
    setNotFound(false)
    setItems([])
    api.get(endpoint, entity ? { params: { entity } } : undefined)
      .then(r => { if (alive) setItems(unwrapList(r).rows) })
      // A 404 means this lookup isn't deployed on the backend yet — surface the calm
      // notice when the caller opted in; every other/unscoped lookup keeps swallowing
      // silently as before (its endpoint always exists). Any OTHER failure (500/network)
      // is a real error, not "the tenant has no values yet" — show it instead of an
      // empty list with live CRUD buttons that would silently fail (§3).
      .catch(e => {
        if (!alive) return
        if (notFoundNotice && e?.response?.status === 404) setNotFound(true)
        else setLoadError(true)
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [endpoint, entity, notFoundNotice])

  // Open the modal blank (create) or prefilled with an existing item (edit).
  const openCreate = () => { setEditing(null); setDraft(emptyDraft()); setShowModal(true) }
  const openEdit = (item) => {
    setEditing(item)
    // eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome
    setDraft({ name: labelOf(item), color: item.color ?? '#3B8FD4',
      ...(withIcon ? { icon: item.icon ?? '' } : {}),
      ...(extraField ? { [extraField.key]: item[extraField.key] ?? extraField.default } : {}),
      ...(numberField ? { [numberField.key]: item[numberField.key] ?? numberField.default } : {}),
      ...(flagField ? { [flagField.key]: Boolean(item[flagField.key]) } : {}) })
    setShowModal(true)
  }

  // One submit for both create (POST) and edit (PUT). Send name + label so both
  // name-based and label/value-based lookups accept it.
  const submit = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    const body = { ...draft, label: draft.name, ...(entity ? { entity } : {}) }
    try {
      if (editing) {
        const res = await api.put(`${endpoint}/${editing.id}`, { ...editing, ...body })
        const updated = unwrap(res) ?? { ...editing, ...body }
        setItems(p => p.map(x => x.id === editing.id ? { ...x, ...updated } : x))
      } else {
        const res = await api.post(endpoint, body)
        setItems(p => [...p, unwrap(res)])
      }
      setShowModal(false); setDraft(emptyDraft()); setEditing(null)
    } catch { notifyError(t('statusList.saveFailed')) } finally { setSaving(false) }
  }

  const remove = async (item) => {
    if (inUse(item)) return
    if (!confirm(t('statusList.confirmDelete', { name: labelOf(item) }))) return
    setDeleting(item.id)
    // 409 = backend rejects deletion of an in-use item; keep the row and flag it.
    // Any OTHER failure (500/network) still needs a visible signal — otherwise the
    // row silently stays in the list with no explanation (§3: no silent catch).
    try { await api.delete(`${endpoint}/${item.id}`); setItems(p => p.filter(x => x.id !== item.id)) }
    catch (e) {
      if (e?.response?.status === 409) setItems(p => p.map(x => x.id === item.id ? { ...x, in_use: true } : x))
      else notifyError(t('statusList.deleteFailed'))
    } finally { setDeleting(null) }
  }

  // Optimistic per-row icon update (iconPicker mode) — same revert rule as colour.
  const updateIcon = async (item, icon) => {
    const previous = items
    setItems(p => p.map(x => x.id === item.id ? { ...x, icon } : x))
    try { await api.put(`${endpoint}/${item.id}`, { ...item, icon }) }
    catch { setItems(previous); notifyError(t('statusList.saveFailed')) }
  }

  const updateColor = async (item, color) => {
    const previous = items
    setItems(p => p.map(x => x.id === item.id ? { ...x, color } : x))
    // Revert the optimistic colour on failure — otherwise the row keeps showing an
    // unsaved colour as if it had persisted (§3: no silent state drift).
    try { await api.put(`${endpoint}/${item.id}`, { ...item, color }) }
    catch { setItems(previous); notifyError(t('statusList.saveFailed')) }
  }

  // Singleton flip (defaultField): promote one row to the tenant default and clear
  // every other row optimistically — the backend model-enforces the same rule, so
  // this mirrors it locally instead of waiting on a refetch. Roll back on failure.
  const setDefault = async (item) => {
    if (!defaultField || item[defaultField.key] || settingDefaultId) return
    const key = defaultField.key
    const previous = items
    setSettingDefaultId(item.id)
    setItems(p => p.map(x => ({ ...x, [key]: x.id === item.id })))
    try {
      await api.put(`${endpoint}/${item.id}`, { ...item, [key]: true })
    } catch {
      setItems(previous)
      notifyError(t('statusList.saveFailed'))
    } finally {
      setSettingDefaultId(null)
    }
  }

  const saveOrder = async () => {
    setSaving(true)
    try {
      await api.put(`${endpoint}/reorder`, { ids: items.map(x => x.id) })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { notifyError(t('statusList.saveFailed')) } finally { setSaving(false) }
  }

  // Set an item's priority by typing its rank: move it to that 1-based position.
  // Local reorder only — the Save button persists the new order (same as drag).
  const commitRank = (item, raw) => {
    const cur = items.findIndex(x => x.id === item.id)
    const target = Math.max(1, Math.min(items.length, parseInt(raw, 10) || cur + 1)) - 1
    if (target === cur || cur < 0) return
    setItems(prev => {
      const next = [...prev]
      const [moved] = next.splice(cur, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  // Calm "not available yet" state — no list, no Add button (§3: never a dead
  // CRUD affordance whose write silently 404s on this tenant/backend).
  if (notFound) {
    return (
      <div style={{ maxWidth: 640 }}>
        {compact
          ? <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</h3>
          : <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{notFoundNotice}</p>
      </div>
    )
  }

  // A real load failure (500/network) — distinct from notFound: hide the CRUD
  // affordances rather than render an empty list that reads as "no values yet".
  if (loadError) {
    return (
      <div style={{ maxWidth: 640 }}>
        {compact
          ? <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</h3>
          : <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: 'var(--color-danger)', fontSize: 13 }}>
          <AlertTriangle size={14} /> {t('statusList.loadError')}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="flex items-start justify-between" style={{ marginBottom: 20, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          {compact
            ? <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</h3>
            : <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {withSave && (
            <button onClick={saveOrder} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                       fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
                       whiteSpace: 'nowrap', flexShrink: 0,
                       background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
              {saved ? <><Check size={13}/> {t('common.saved')}</> : <><Save size={13}/> {t('common.save')}</>}
            </button>
          )}
          {allowAdd && (
            <button onClick={openCreate}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                       fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
                       whiteSpace: 'nowrap', flexShrink: 0,
                       background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
              <Plus size={13} /> {addLabel}
            </button>
          )}
        </div>
      </div>

      {loading ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p> : (
        <DragList
          items={items}
          onReorder={setItems}
          renderItem={(item) => (
            <>
              {/* Priority rank = position (top = 1 = sent first). Editable: type a number to move
                  it there. key resets the uncommitted value after a reorder; Save persists (like drag). */}
              {showRank && (
                <input type="number" min={1} max={items.length}
                  key={`rank-${item.id}-${items.findIndex(x => x.id === item.id)}`}
                  defaultValue={items.findIndex(x => x.id === item.id) + 1}
                  onMouseDown={e => e.stopPropagation()}
                  onBlur={e => commitRank(item, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  aria-label={t('statusList.priorityRank', { defaultValue: 'Prioriteit (1 = eerst verstuurd)' })}
                  title={t('statusList.priorityRank', { defaultValue: 'Prioriteit (1 = eerst verstuurd)' })}
                  style={{ width: 40, height: 24, textAlign: 'center', padding: 0,
                           fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                           color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)',
                           borderRadius: 6, flexShrink: 0, outline: 'none' }} />
              )}
              {/* eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome */}
              {withColor && <ColorSwatch color={item.color ?? '#6B7280'} onChange={c => updateColor(item, c)} />}
              {withIcon && item.icon && <span style={{ display: 'inline-flex', flexShrink: 0, color: 'var(--text-muted)' }}><LookupIcon icon={item.icon} size={14} /></span>}
              {/* Curated icon picker IN the row, next to the colour (Danny 23-07). */}
              {iconPicker && (
                // eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome
                <IconPickerControl icons={iconPicker.icons} resolve={iconPicker.resolve} value={item.icon}
                  color={item.color ?? '#6B7280'} label={labelOf(item)} onPick={icon => updateIcon(item, icon)} />
              )}
              {withColor
                // eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome
                ? <ColorBadge label={labelOf(item)} color={item.color ?? '#6B7280'} />
                : <span style={{ fontSize: 13, color: 'var(--text)' }}>{labelOf(item)}</span>}
              {flagField && item[flagField.key] && (
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-primary)',
                               background: 'var(--color-primary-bg)', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                  {flagField.label}
                </span>
              )}
              {numberField && item[numberField.key] != null && (
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                  {item[numberField.key]}{numberField.suffix ? ` ${numberField.suffix}` : ''}
                </span>
              )}
              {extraField && item[extraField.key] && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                  {extraField.options.find(o => o.value === item[extraField.key])?.label ?? item[extraField.key]}
                </span>
              )}
              {defaultField && (
                <DefaultToggle active={Boolean(item[defaultField.key])} busy={settingDefaultId === item.id}
                  onClick={() => setDefault(item)}
                  activeLabel={t('common.default')} inactiveLabel={t('common.setDefault')} />
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => openEdit(item)} title={t('statusList.edit')}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                         background: 'var(--border)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text)' }}>
                <Pencil size={11} />
              </button>
              {/* Delete is disabled when the item is still referenced by existing data. */}
              <button onClick={() => remove(item)} disabled={deleting === item.id || inUse(item)}
                title={inUse(item) ? t('statusList.inUse') : undefined}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                         background: 'var(--color-danger-bg)', border: 'none', borderRadius: 6, color: 'var(--color-danger)',
                         cursor: inUse(item) ? 'not-allowed' : 'pointer', opacity: inUse(item) ? 0.4 : 1 }}>
                {deleting === item.id ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
              </button>
            </>
          )}
        />
      )}

      {showModal && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setShowModal(false)} />
          <div className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--surface)', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{editing ? t('statusList.editTitle') : addLabel}</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('statusList.nameLabel')}</div>
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder={t('statusList.namePlaceholder')}
                style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {withColor && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('statusList.colorLabel')}</div>
                <ColorSwatch color={draft.color} onChange={c => setDraft(d => ({ ...d, color: c }))} />
              </div>
            )}
            {withIcon && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('statusList.iconLabel')}</div>
                <input value={draft.icon ?? ''} maxLength={64}
                  onChange={e => setDraft(d => ({ ...d, icon: e.target.value }))}
                  placeholder={t('statusList.iconPlaceholder')}
                  style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
            {numberField && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{numberField.label}</div>
                <input type="number" min={numberField.min ?? 1} max={numberField.max ?? 999} value={draft[numberField.key] ?? ''}
                  onChange={e => setDraft(d => ({ ...d, [numberField.key]: Number(e.target.value) || 0 }))}
                  style={{ width: 120, height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
            {extraField && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{extraField.label}</div>
                <select value={draft[extraField.key]} onChange={e => setDraft(d => ({ ...d, [extraField.key]: e.target.value }))}
                  style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)' }}>
                  {extraField.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            {flagField && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(draft[flagField.key])}
                  onChange={e => setDraft(d => ({ ...d, [flagField.key]: e.target.checked }))}
                  style={{ accentColor: 'var(--color-primary)', width: 14, height: 14, marginTop: 2, flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{flagField.label}</span>
                  {flagField.description && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{flagField.description}</span>}
                </span>
              </label>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={submit} disabled={saving || !draft.name.trim()}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: draft.name.trim() ? 1 : 0.4 }}>
                {saving ? t('common.saving') : (editing ? t('common.save') : t('statusList.addBtn'))}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

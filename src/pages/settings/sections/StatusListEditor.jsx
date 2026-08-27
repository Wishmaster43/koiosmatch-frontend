/**
 * StatusListEditor — generic CRUD list with drag-reorder and optional colour, used
 * by the Phases / Candidate status / Vacancy / Rejection sections. The section
 * passes its own title/subtitle/addLabel + endpoint; internal labels are translated.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import IconPickerControl from './IconPickerControl'
import { GENERIC_LOOKUP_ICON_NAMES, resolveGenericLookupIcon } from './lookupIcons'
import SearchSelect from '@/components/ui/SearchSelect'
import Spinner from '@/components/ui/Spinner'
import { AlertTriangle, X, Trash2, Pencil } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import { DragList, ColorSwatch, ColorBadge, DefaultToggle } from '../components/SettingsControls'
import { Toggle } from '../components/SettingsKit'
import Button from '@/components/ui/Button'
import ModalFooter from '@/components/ui/ModalFooter'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { PageTitle, Caption } from '@/components/ui/typography'
import { useFocusTrap } from '@/hooks/useFocusTrap'

// eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome
const FALLBACK_SWATCH = '#6B7280'

// Typed label → the immutable backend slug ("Vaste klant" → "vaste_klant"). Diacritics
// are folded first so "Café-klant" still yields a slug the ^[a-z0-9_]+$ rule accepts;
// a label with no usable characters falls back to a unique, valid placeholder slug.
const slugify = (s) => {
  const base = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64)
  return base || `item_${Date.now().toString(36)}`
}

// extraField (optional): { key, label, options: [{value,label}], default } —
// renders one extra picker in the create modal plus a badge on the row
// flagField (optioneel): { key, label, description } — a single boolean behaviour
// flag (R-1b: is_closed/is_reached); checkbox in the modal + badge in the row. The
// FLAG drives behaviour, never the slug — so tenant-own statuses work on the write
// paths. flagFields (optional): array of flagField-shaped objects — MULTIPLE
// independent behaviour flags on the same lookup (back-compat sugar exactly like
// defaultField → defaultFields below); flagField stays supported as a one-element
// shorthand for existing callers
// defaultField (optional): { key, label } — a SINGLETON flag (is_default and the
// like), enforced by the backend model (at most one per lookup). Deliberately not a
// modal field: a per-row DefaultToggle promotes that row and optimistically clears
// every other row, so the UI mirrors the server's singleton without a refetch.
// The shared DefaultToggle is undoable by default (DEFAULT-UNDO, Danny 04-08:
// "je kan niet undo doen") — clicking the active pill clears the flag; setDefault
// below flips true/false on the same per-id PUT route
// entity (optioneel): scopes a shared lookup (e.g. /note-types) to one owning entity —
// GET reads `?entity=X`, POST/PUT writes send `entity: X` so create/edit stay scoped
// (mirrors NoteType::ENTITIES on the backend; NOTE-TYPES-2/3)
// notFoundNotice (optioneel): a lookup requested from the backend but not deployed
// yet 404s on GET — pass a calm i18n message and the editor shows it instead of an
// empty list + live CRUD buttons that would silently fail (§3 no fake affordances).
// Omitted (default), a 404 stays silently swallowed like every other lookup here
// withValueSlug (optioneel): the SLUG-shaped lookups (SlugLookupController /
// CustomerLookupController) validate `value` as REQUIRED on create — this editor only
// ever sent name/label, so their "+ toevoegen" 422'd. Opt in and the create POST
// carries a slug derived from the typed name; name-shaped lookups stay untouched
// extraField.hideRowBadge (optioneel): suppresses extraField's own generic text
// badge in the row — for a lookup that renders its extraField value a DIFFERENT
// way (rowPrefix below), so the row never shows the same value twice (NATION-FLAG-1:
// the flag prefix already conveys the country, a trailing "Netherlands" text chip
// would be redundant clutter)
// rowPrefix (optioneel): (item) => ReactNode, rendered right before the name/
// ColorBadge — a small row-adornment hook for a lookup whose "extra" value needs
// a bespoke glyph rather than the generic extraField/flagField/numberField badges
// (NATION-FLAG-1: a flag emoji derived from item.country_code).

export default function StatusListEditor({ title, subtitle, endpoint, addLabel, withColor = true, compact = false, extraField = null, flagField = null, flagFields = null, numberField = null, defaultField = null, defaultFields = null, withIcon = false, iconPicker = null, allowAdd = true, showRank = false, entity = null, notFoundNotice = null, withValueSlug = false, reorderable = true, rowPrefix = null }) {
  const { t } = useTranslation('settings')
  // defaultField (singular) is sugar for a one-element defaultFields array — both
  // props stay supported so existing callers are untouched (DEFAULT-UNDO, 04-08).
  const singletons = defaultFields ?? (defaultField ? [defaultField] : [])
  // flagField (singular) is sugar for a one-element flagFields array — same back-
  // compat pattern as defaultField → defaultFields above.
  const flagList = flagFields ?? (flagField ? [flagField] : [])
  // The generic curated icon set backs the bare withIcon mode — an explicit iconPicker
  // prop still wins (DocumentTypesSettings' own curated set), never overridden here.
  const resolvedIconPicker = iconPicker ?? (withIcon ? { icons: GENERIC_LOOKUP_ICON_NAMES, resolve: resolveGenericLookupIcon } : null)
  // eslint-disable-next-line no-restricted-syntax -- DATA: default swatch colour pre-filled for a newly created lookup row, not UI chrome
  const emptyDraft = () => ({ name: '', color: '#3B8FD4', ...(withIcon ? { icon: '' } : {}), ...(extraField ? { [extraField.key]: extraField.default } : {}), ...(numberField ? { [numberField.key]: numberField.default } : {}), ...Object.fromEntries(flagList.map(f => [f.key, false])) })
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
  const [deleting,  setDeleting]  = useState(null)
  // Busy marker per singleton flip, keyed `${field}:${id}` — several independent
  // singletons (is_default / is_default_for_application) can be mid-flight at once.
  const [busyDefaultKey, setBusyDefaultKey] = useState(null)
  // House confirmation dialog (§0 restschuld) — replaces the native window.confirm() below.
  const { confirm, dialog } = useConfirm()
  // MODAL-HERBOUW-1: shared focus-trap (arm-on-attach, Escape-to-close, restores
  // focus on close) — the trap's own close callback always reads the latest one.
  const modalPanelRef = useFocusTrap(() => setShowModal(false))

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
  // Opens the modal prefilled from an existing item, seeding every optional field (icon/extra/number) from its current value or a sane default.
  const openEdit = (item) => {
    setEditing(item)
    // eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome
    setDraft({ name: labelOf(item), color: item.color ?? '#3B8FD4',
      ...(withIcon ? { icon: item.icon ?? '' } : {}),
      ...(extraField ? { [extraField.key]: item[extraField.key] ?? extraField.default } : {}),
      ...(numberField ? { [numberField.key]: item[numberField.key] ?? numberField.default } : {}),
      ...Object.fromEntries(flagList.map(f => [f.key, Boolean(item[f.key])])) })
    setShowModal(true)
  }

  // One submit for both create (POST) and edit (PUT). Send name + label so both
  // name-based and label/value-based lookups accept it; a slug lookup additionally
  // needs the immutable `value` on create (withValueSlug).
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
        const res = await api.post(endpoint, withValueSlug ? { ...body, value: slugify(draft.name) } : body)
        setItems(p => [...p, unwrap(res)])
      }
      setShowModal(false); setDraft(emptyDraft()); setEditing(null)
    } catch (e) {
      // Surface the server's validation reason when there is one (e.g. portie-5
      // unique-slug 422 "al in gebruik" on opportunity stages) instead of the
      // generic failure toast; extractApiError falls back to the i18n'd message.
      notifyError(extractApiError(e, t('statusList.saveFailed')))
    } finally { setSaving(false) }
  }

  // Confirms and deletes a row, blocked upfront when it is in use; a 409 from the server still keeps the row and flags it, since another change could have made it in-use meanwhile.
  const remove = (item) => {
    if (inUse(item)) return
    confirm(t('statusList.confirmDelete', { name: labelOf(item) }), async () => {
      setDeleting(item.id)
      // 409 = backend rejects deletion of an in-use item; keep the row and flag it.
      // Any OTHER failure (500/network) still needs a visible signal — otherwise the
      // row silently stays in the list with no explanation (§3: no silent catch).
      try { await api.delete(`${endpoint}/${item.id}`); setItems(p => p.filter(x => x.id !== item.id)) }
      catch (e) {
        if (e?.response?.status === 409) setItems(p => p.map(x => x.id === item.id ? { ...x, in_use: true } : x))
        else notifyError(t('statusList.deleteFailed'))
      } finally { setDeleting(null) }
    }, { danger: true })
  }

  // Optimistic per-row icon update (iconPicker mode) — same revert rule as colour.
  const updateIcon = async (item, icon) => {
    const previous = items
    setItems(p => p.map(x => x.id === item.id ? { ...x, icon } : x))
    try { await api.put(`${endpoint}/${item.id}`, { ...item, icon }) }
    catch { setItems(previous); notifyError(t('statusList.saveFailed')) }
  }

  // Optimistic per-row colour update; reverts to the previous colour on a failed save so the row never shows an unsaved value as persisted.
  const updateColor = async (item, color) => {
    const previous = items
    setItems(p => p.map(x => x.id === item.id ? { ...x, color } : x))
    // Revert the optimistic colour on failure — otherwise the row keeps showing an
    // unsaved colour as if it had persisted (§3: no silent state drift).
    try { await api.put(`${endpoint}/${item.id}`, { ...item, color }) }
    catch { setItems(previous); notifyError(t('statusList.saveFailed')) }
  }

  // Singleton flip (defaultFields[i]): promote a row to that singleton's default,
  // clearing every other row's flag optimistically (the backend model-enforces the
  // same invariant, so this mirrors it locally instead of waiting on a refetch).
  // DEFAULT-UNDO (Danny 04-08): clicking the ACTIVE default now CLEARS it instead of
  // being a one-way ratchet — same PUT route, body `{ [key]: false }`, same revert.
  const setDefault = async (field, item) => {
    const key = field.field ?? field.key
    const busyKey = `${key}:${item.id}`
    if (busyDefaultKey) return
    const next = !item[key]
    const previous = items
    setBusyDefaultKey(busyKey)
    setItems(p => p.map(x => (x.id === item.id ? { ...x, [key]: next } : (next ? { ...x, [key]: false } : x))))
    try {
      await api.put(`${endpoint}/${item.id}`, { ...item, [key]: next })
    } catch {
      setItems(previous)
      notifyError(t('statusList.saveFailed'))
    } finally {
      setBusyDefaultKey(null)
    }
  }

  // REORDER-SAVES-ON-DROP (decision 04-08): a drag-drop persists immediately —
  // optimistic, revert + notify on a failed PUT. No pending-order/Save-button state.
  const persistOrder = async (nextItems, previousItems) => {
    try {
      await api.put(`${endpoint}/reorder`, { ids: nextItems.map(x => x.id) })
    } catch {
      setItems(previousItems)
      notifyError(t('statusList.saveFailed'))
    }
  }

  // DragList calls this on drop with the already-reordered array — apply it locally
  // then fire the persist PUT against the order it replaced (for revert on failure).
  const handleReorder = (nextItems) => {
    const previousItems = items
    setItems(nextItems)
    persistOrder(nextItems, previousItems)
  }

  // Set an item's priority by typing its rank: move it to that 1-based position,
  // then persist immediately (same reorder route as drag-drop).
  const commitRank = (item, raw) => {
    const cur = items.findIndex(x => x.id === item.id)
    const target = Math.max(1, Math.min(items.length, parseInt(raw, 10) || cur + 1)) - 1
    if (target === cur || cur < 0) return
    const next = [...items]
    const [moved] = next.splice(cur, 1)
    next.splice(target, 0, moved)
    handleReorder(next)
  }

  // Calm "not available yet" state — no list, no Add button (§3: never a dead
  // CRUD affordance whose write silently 404s on this tenant/backend).
  if (notFound) {
    return (
      <div style={{ maxWidth: 640 }}>
        {compact
          ? <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</h3>
          : <PageTitle>{title}</PageTitle>}
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
          : <PageTitle>{title}</PageTitle>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: 'var(--color-danger-text)', fontSize: 13 }}>
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
            : <PageTitle>{title}</PageTitle>}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {/* HUISSTIJL-1: the ONE "+ add" affordance, app-wide (§3A). */}
          {allowAdd && <DrawerAddButton onClick={openCreate} label={addLabel} />}
        </div>
      </div>

      {loading ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p> : (
        <DragList
          items={items}
          sortable={reorderable}
          onReorder={handleReorder}
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
              {withColor && <ColorSwatch color={item.color ?? FALLBACK_SWATCH} onChange={c => updateColor(item, c)} />}
              {/* Curated icon picker IN the row, next to the colour (Danny 23-07). withIcon=true
                  without an explicit iconPicker prop now ALSO renders the picker, fed by the
                  generic curated set — the old free-text lucide-key input is retired (it
                  silently accepted wrong keys). */}
              {resolvedIconPicker && (
                <IconPickerControl icons={resolvedIconPicker.icons} resolve={resolvedIconPicker.resolve} value={item.icon}
                  color={item.color ?? FALLBACK_SWATCH} label={labelOf(item)} onPick={icon => updateIcon(item, icon)} />
              )}
              {/* Bespoke row adornment (NATION-FLAG-1: a flag emoji) — before the name,
                  same slot a colour swatch would otherwise occupy. */}
              {rowPrefix && rowPrefix(item)}
              {withColor
                ? <ColorBadge label={labelOf(item)} color={item.color ?? FALLBACK_SWATCH} />
                : <span style={{ fontSize: 13, color: 'var(--text)' }}>{labelOf(item)}</span>}
              {/* One badge per active flag (flagFields) — independent booleans, no singleton rule. */}
              {flagList.map(f => item[f.key] && (
                <span key={f.key} style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-primary-text)',
                               background: 'var(--color-primary-bg)', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                  {f.label}
                </span>
              ))}
              {numberField && item[numberField.key] != null && (
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                  {item[numberField.key]}{numberField.suffix ? ` ${numberField.suffix}` : ''}
                </span>
              )}
              {extraField && !extraField.hideRowBadge && item[extraField.key] && (
                <Caption style={{ background: 'var(--border)', padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                  {extraField.options.find(o => o.value === item[extraField.key])?.label ?? item[extraField.key]}
                </Caption>
              )}
              {/* One independent pill per singleton (defaultFields) — each has its own
                  tinted marker + tooltip + undo (SECOND SINGLETON, 04-08). */}
              {singletons.map((field) => {
                const key = field.field ?? field.key
                const active = Boolean(item[key])
                const label = field.labelKey ? t(field.labelKey) : undefined
                return (
                  <DefaultToggle key={key} active={active} busy={busyDefaultKey === `${key}:${item.id}`}
                    onClick={() => setDefault(field, item)}
                    activeLabel={label ?? t('common.default')} inactiveLabel={label ?? t('common.setDefault')}
                    title={active ? t('statusList.clearDefault') : undefined} />
                )
              })}
              <div style={{ flex: 1 }} />
              <Button variant="secondary" iconOnly onClick={() => openEdit(item)} title={t('statusList.edit')} aria-label={t('statusList.edit')}>
                <Pencil size={11} />
              </Button>
              {/* Delete is disabled when the item is still referenced by existing data.
                  Accessible name stays the plain "delete" verb even while disabled —
                  title carries the in-use reason as a tooltip, aria-label never goes
                  undefined (VAC-CLEAR-style regression: name must survive both states). */}
              <Button variant="dangerSoft" iconOnly onClick={() => remove(item)} disabled={deleting === item.id || inUse(item)}
                title={inUse(item) ? t('statusList.inUse') : undefined} aria-label={t('common:delete')}>
                {deleting === item.id ? <Spinner size={11} /> : <Trash2 size={11} />}
              </Button>
            </>
          )}
        />
      )}

      {showModal && (
        <>
          {/* Backdrop + panel stack on the shared overlay token, never a raw Tailwind z-40/z-50. */}
          <div className="fixed inset-0" style={{ zIndex: 'var(--z-overlay)', background: 'rgba(0,0,0,0.3)' }} onClick={() => setShowModal(false)} />
          <div ref={modalPanelRef} role="dialog" aria-modal="true" aria-label={editing ? t('statusList.editTitle') : addLabel} tabIndex={-1}
            className="fixed" style={{ zIndex: 'var(--z-overlay)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--surface)', borderRadius: 12, padding: '24px 24px 0', width: 400, boxShadow: 'var(--shadow-modal)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <PageTitle as="span">{editing ? t('statusList.editTitle') : addLabel}</PageTitle>
              <Button variant="ghost" iconOnly size="sm" onClick={() => setShowModal(false)} title={t('common:close')} aria-label={t('common:close')}><X size={16} /></Button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="status-list-name" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('statusList.nameLabel')}</label>
              <input id="status-list-name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder={t('statusList.namePlaceholder')} aria-label={t('statusList.nameLabel')}
                style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {withColor && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('statusList.colorLabel')}</div>
                <ColorSwatch color={draft.color} onChange={c => setDraft(d => ({ ...d, color: c }))} />
              </div>
            )}
            {resolvedIconPicker && (
              // The bare free-text lucide-key input is retired (silently accepted wrong
              // keys) — the same curated IconPickerControl now backs create/edit too.
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('statusList.iconLabel')}</div>
                <IconPickerControl icons={resolvedIconPicker.icons} resolve={resolvedIconPicker.resolve} value={draft.icon}
                  color={draft.color ?? FALLBACK_SWATCH} label={draft.name || t('statusList.iconLabel')}
                  onPick={icon => setDraft(d => ({ ...d, icon }))} />
              </div>
            )}
            {numberField && (
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="status-list-number" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{numberField.label}</label>
                <input id="status-list-number" type="number" min={numberField.min ?? 1} max={numberField.max ?? 999} value={draft[numberField.key] ?? ''}
                  onChange={e => setDraft(d => ({ ...d, [numberField.key]: e.target.value === '' ? null : Number(e.target.value) }))}
                  aria-label={numberField.label}
                  style={{ width: 120, height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
            {extraField && (
              // The hand-rolled native <select> is replaced by the shared searchable
              // SearchSelect (single-select via closeOnToggle) — extraField's prop API
              // (key/label/options/default) is unchanged.
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{extraField.label}</div>
                <SearchSelect closeOnToggle width={352}
                  options={extraField.options}
                  selected={[draft[extraField.key]]}
                  onToggle={value => setDraft(d => ({ ...d, [extraField.key]: value }))}
                  triggerLabel={extraField.options.find(o => o.value === draft[extraField.key])?.label ?? extraField.label} />
              </div>
            )}
            {/* One toggle per behaviour flag (flagFields) — independent booleans. */}
            {flagList.map(f => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
                <Toggle checked={Boolean(draft[f.key])} ariaLabel={f.label}
                  onChange={v => setDraft(d => ({ ...d, [f.key]: v }))} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{f.label}</span>
                  {f.description && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{f.description}</span>}
                </span>
              </div>
            ))}
            {/* Shared modal footer (§4/HUISSTIJL-1) — spans the panel's full width past the body padding. */}
            <div style={{ margin: '20px -24px 0' }}>
              <ModalFooter onCancel={() => setShowModal(false)} onSubmit={submit}
                disabled={saving || !draft.name.trim()} busy={saving}
                cancelLabel={t('common.cancel')} submitLabel={editing ? t('common.save') : t('statusList.addBtn')} />
            </div>
          </div>
        </>
      )}
      {dialog}
    </div>
  )
}

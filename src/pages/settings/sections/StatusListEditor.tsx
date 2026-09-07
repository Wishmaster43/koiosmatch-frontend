/**
 * StatusListEditor — generic CRUD list with drag-reorder and optional colour, used
 * by the Phases / Candidate status / Vacancy / Rejection sections. The section
 * passes its own title/subtitle/addLabel + endpoint; internal labels are translated.
 *
 * extraField (optional): { key, label, options: [{value,label}], default } —
 * renders one extra picker in the create modal plus a badge on the row
 * flagField (optioneel): { key, label, description } — a single boolean behaviour
 * flag (R-1b: is_closed/is_reached); checkbox in the modal + badge in the row. The
 * FLAG drives behaviour, never the slug — so tenant-own statuses work on the write
 * paths. flagFields (optional): array of flagField-shaped objects — MULTIPLE
 * independent behaviour flags on the same lookup (back-compat sugar exactly like
 * defaultField → defaultFields below); flagField stays supported as a one-element
 * shorthand for existing callers
 * defaultField (optional): { key, label } — a SINGLETON flag (is_default and the
 * like), enforced by the backend model (at most one per lookup). Deliberately not a
 * modal field: a per-row DefaultToggle promotes that row and optimistically clears
 * every other row, so the UI mirrors the server's singleton without a refetch.
 * The shared DefaultToggle is undoable by default (DEFAULT-UNDO, Danny 04-08:
 * "je kan niet undo doen") — clicking the active pill clears the flag; setDefault
 * below flips true/false on the same per-id PUT route
 * entity (optioneel): scopes a shared lookup (e.g. /note-types) to one owning entity —
 * GET reads `?entity=X`, POST/PUT writes send `entity: X` so create/edit stay scoped
 * (mirrors NoteType::ENTITIES on the backend; NOTE-TYPES-2/3)
 * fetchEntity (optioneel): the `?entity=` param sent on GET only — defaults to
 * `entity`. Lets a caller write rows scoped to `entity` while reading a DIFFERENT
 * slice of the response (postFilter below), e.g. a "General" tab that reads the
 * unscoped list (every row) but only ever writes/shows the entity-less ones
 * (NOTE-TYPES-3: GET ?entity=X already merges in the global/null rows server-side).
 * postFilter (optioneel): (item) => bool, applied to the fetched rows client-side —
 * splits a merged entity+global response into the "this entity only" vs "global
 * only" slice a tab actually wants to show, so global rows don't render twice
 * (once under their own entity tab, once under General).
 * notFoundNotice (optioneel): a lookup requested from the backend but not deployed
 * yet 404s on GET — pass a calm i18n message and the editor shows it instead of an
 * empty list + live CRUD buttons that would silently fail (§3 no fake affordances).
 * Omitted (default), a 404 stays silently swallowed like every other lookup here
 * withValueSlug (optioneel): the SLUG-shaped lookups (SlugLookupController /
 * CustomerLookupController) validate `value` as REQUIRED on create — this editor only
 * ever sent name/label, so their "+ toevoegen" 422'd. Opt in and the create POST
 * carries a slug derived from the typed name; name-shaped lookups stay untouched
 * extraField.hideRowBadge (optioneel): suppresses extraField's own generic text
 * badge in the row — for a lookup that renders its extraField value a DIFFERENT
 * way (rowPrefix below), so the row never shows the same value twice (NATION-FLAG-1:
 * the flag prefix already conveys the country, a trailing "Netherlands" text chip
 * would be redundant clutter)
 * rowPrefix (optioneel): (item) => ReactNode, rendered right before the name/
 * ColorBadge — a small row-adornment hook for a lookup whose "extra" value needs
 * a bespoke glyph rather than the generic extraField/flagField/numberField badges
 * (NATION-FLAG-1: a flag emoji derived from item.country_code).
 *
 * Row rendering lives in StatusListRow.tsx, the create/edit form in
 * StatusListModal.tsx (SIZE-SPLIT-B extraction, zero behaviour change).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GENERIC_LOOKUP_ICON_NAMES, resolveGenericLookupIcon } from './lookupIcons'
import { AlertTriangle } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import { DragList } from '../components/SettingsControls'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { PageTitle } from '@/components/ui/typography'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import StatusListRow from './StatusListRow'
import StatusListModal from './StatusListModal'
import type { StatusListEditorProps, StatusListItem, StatusListDraft, DefaultFieldDef } from './statusListEditorTypes'

// Typed label → the immutable backend slug ("Vaste klant" → "vaste_klant"). Diacritics
// are folded first so "Café-klant" still yields a slug the ^[a-z0-9_]+$ rule accepts;
// a label with no usable characters falls back to a unique, valid placeholder slug.
const slugify = (s: string): string => {
  const base = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64)
  return base || `item_${Date.now().toString(36)}`
}

export default function StatusListEditor({
  title, subtitle, endpoint, addLabel, withColor = true, compact = false, extraField = null, flagField = null,
  flagFields = null, numberField = null, defaultField = null, defaultFields = null, withIcon = false, iconPicker = null,
  allowAdd = true, showRank = false, entity = null, fetchEntity = undefined, postFilter = null, notFoundNotice = null,
  withValueSlug = false, reorderable = true, rowPrefix = null,
}: StatusListEditorProps) {
  const { t } = useTranslation('settings')
  // defaultField (singular) is sugar for a one-element defaultFields array — both
  // props stay supported so existing callers are untouched (DEFAULT-UNDO, 04-08).
  const singletons: DefaultFieldDef[] = defaultFields ?? (defaultField ? [defaultField] : [])
  // flagField (singular) is sugar for a one-element flagFields array — same back-
  // compat pattern as defaultField → defaultFields above.
  const flagList = flagFields ?? (flagField ? [flagField] : [])
  // The generic curated icon set backs the bare withIcon mode — an explicit iconPicker
  // prop still wins (DocumentTypesSettings' own curated set), never overridden here.
  const resolvedIconPicker = iconPicker ?? (withIcon ? { icons: GENERIC_LOOKUP_ICON_NAMES, resolve: resolveGenericLookupIcon } : null)
  // eslint-disable-next-line no-restricted-syntax -- DATA: default swatch colour pre-filled for a newly created lookup row, not UI chrome
  const emptyDraft = (): StatusListDraft => ({ name: '', color: '#3B8FD4', ...(withIcon ? { icon: '' } : {}), ...(extraField ? { [extraField.key]: extraField.default } : {}), ...(numberField ? { [numberField.key]: numberField.default } : {}), ...Object.fromEntries(flagList.map(f => [f.key, f.default ?? false])) })
  // Lookups differ in their display field: name (phases/status) vs label/value (genders/languages).
  const labelOf = (i: StatusListItem): string => i.name ?? i.label ?? i.value ?? ''
  // An item is protected when the backend marks it as referenced by existing data.
  const inUse = (i: StatusListItem): boolean => Boolean(i.in_use ?? i.is_used ?? i.locked ?? (((i.usage_count ?? i.candidates_count ?? 0) as number) > 0))
  const [items,     setItems]     = useState<StatusListItem[]>([])
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<StatusListItem | null>(null)   // null = create; item = edit
  const [draft,     setDraft]     = useState<StatusListDraft>(emptyDraft)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<string | number | null>(null)
  // Busy marker per singleton flip, keyed `${field}:${id}` — several independent
  // singletons (is_default / is_default_for_application) can be mid-flight at once.
  const [busyDefaultKey, setBusyDefaultKey] = useState<string | null>(null)
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
    const readEntity = fetchEntity !== undefined ? fetchEntity : entity
    api.get(endpoint, readEntity ? { params: { entity: readEntity } } : undefined)
      .then(r => { if (alive) setItems(postFilter ? unwrapList<StatusListItem>(r).rows.filter(postFilter) : unwrapList<StatusListItem>(r).rows) })
      // A 404 means this lookup isn't deployed on the backend yet — surface the calm
      // notice when the caller opted in; every other/unscoped lookup keeps swallowing
      // silently as before (its endpoint always exists). Any OTHER failure (500/network)
      // is a real error, not "the tenant has no values yet" — show it instead of an
      // empty list with live CRUD buttons that would silently fail (§3).
      .catch((e: { response?: { status?: number } }) => {
        if (!alive) return
        if (notFoundNotice && e?.response?.status === 404) setNotFound(true)
        else setLoadError(true)
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [endpoint, entity, fetchEntity, postFilter, notFoundNotice])

  // Open the modal blank (create) or prefilled with an existing item (edit).
  const openCreate = () => { setEditing(null); setDraft(emptyDraft()); setShowModal(true) }
  // Opens the modal prefilled from an existing item, seeding every optional field (icon/extra/number) from its current value or a sane default.
  const openEdit = (item: StatusListItem) => {
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
        setItems(p => p.map(x => x.id === editing.id ? { ...x, ...(updated as StatusListItem) } : x))
      } else {
        const res = await api.post(endpoint, withValueSlug ? { ...body, value: slugify(draft.name) } : body)
        setItems(p => [...p, unwrap(res) as StatusListItem])
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
  const remove = (item: StatusListItem) => {
    if (inUse(item)) return
    confirm(t('statusList.confirmDelete', { name: labelOf(item) }), async () => {
      setDeleting(item.id)
      // 409 = backend rejects deletion of an in-use item; keep the row and flag it.
      // Any OTHER failure (500/network) still needs a visible signal — otherwise the
      // row silently stays in the list with no explanation (§3: no silent catch).
      try { await api.delete(`${endpoint}/${item.id}`); setItems(p => p.filter(x => x.id !== item.id)) }
      catch (e) {
        const status = (e as { response?: { status?: number } })?.response?.status
        if (status === 409) setItems(p => p.map(x => x.id === item.id ? { ...x, in_use: true } : x))
        else notifyError(t('statusList.deleteFailed'))
      } finally { setDeleting(null) }
    }, { danger: true })
  }

  // Optimistic per-row icon update (iconPicker mode) — same revert rule as colour.
  const updateIcon = async (item: StatusListItem, icon: string) => {
    const previous = items
    setItems(p => p.map(x => x.id === item.id ? { ...x, icon } : x))
    try { await api.put(`${endpoint}/${item.id}`, { ...item, icon }) }
    catch { setItems(previous); notifyError(t('statusList.saveFailed')) }
  }

  // Optimistic per-row colour update; reverts to the previous colour on a failed save so the row never shows an unsaved value as persisted.
  const updateColor = async (item: StatusListItem, color: string) => {
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
  const setDefault = async (field: DefaultFieldDef, item: StatusListItem) => {
    const key = field.field ?? field.key ?? ''
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
  const persistOrder = async (nextItems: StatusListItem[], previousItems: StatusListItem[]) => {
    try {
      await api.put(`${endpoint}/reorder`, { ids: nextItems.map(x => x.id) })
    } catch {
      setItems(previousItems)
      notifyError(t('statusList.saveFailed'))
    }
  }

  // DragList calls this on drop with the already-reordered array — apply it locally
  // then fire the persist PUT against the order it replaced (for revert on failure).
  const handleReorder = (nextItems: StatusListItem[]) => {
    const previousItems = items
    setItems(nextItems)
    persistOrder(nextItems, previousItems)
  }

  // Set an item's priority by typing its rank: move it to that 1-based position,
  // then persist immediately (same reorder route as drag-drop).
  const commitRank = (item: StatusListItem, raw: string) => {
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
          renderItem={(item: StatusListItem) => (
            <StatusListRow
              item={item} items={items} showRank={showRank} withColor={withColor}
              resolvedIconPicker={resolvedIconPicker} rowPrefix={rowPrefix} flagList={flagList}
              numberField={numberField} extraField={extraField} singletons={singletons}
              busyDefaultKey={busyDefaultKey} deleting={deleting} labelOf={labelOf} commitRank={commitRank}
              updateColor={updateColor} updateIcon={updateIcon} setDefault={setDefault} openEdit={openEdit}
              remove={remove} inUse={inUse}
            />
          )}
        />
      )}

      {showModal && (
        <StatusListModal
          modalPanelRef={modalPanelRef} editing={editing} addLabel={addLabel} draft={draft} setDraft={setDraft}
          withColor={withColor} resolvedIconPicker={resolvedIconPicker} numberField={numberField} extraField={extraField}
          flagList={flagList} saving={saving} onClose={() => setShowModal(false)} onSubmit={submit}
        />
      )}
      {dialog}
    </div>
  )
}

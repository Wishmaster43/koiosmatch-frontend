import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Map as MapIcon, AlertTriangle } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import { useConfirm } from '@/hooks/useConfirm'
import { DEFAULT_LOCATION_COLOR, DEFAULT_LOCATION_ICON } from '@/lib/locationIcons'
import LocationsTable from './locations/LocationsTable'
import LocationFormModal from './locations/LocationFormModal'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'

// STRAAL-1: Leaflet only loads when the map view opens (§9 — lazy heavy deps).
const LocationsMapView = lazy(() => import('./LocationsMapView'))

// Structured address — kept as separate fields so it can be matched/validated and
// composed consistently. Falls back to a legacy `address`/`full_address` string.
const EMPTY_FORM = {
  name: '', street: '', house_number: '', house_number_suffix: '',
  // `province` rides along with the rest of the address (the backend's
  // Store/UpdateLocationRequest validate it) — added 08-08 with the searchable
  // country/province pickers in the form.
  postal_code: '', city: '', province: '', country: '',
  // Business identifiers + contact details, so a location is a full entity.
  coc_number: '', vat_number: '', contact_name: '', phone: '', email: '',
  // VESTIGING-ICOON-1: branding — rides along in the same create/update payload.
  color: DEFAULT_LOCATION_COLOR, icon: DEFAULT_LOCATION_ICON,
}
// Field keys the API returns/accepts 1:1 (LocationResource ↔ Store/UpdateLocationRequest).
const FORM_KEYS = Object.keys(EMPTY_FORM)

// Prefill the edit form from an existing row — field names already match 1:1.
// Colour/icon fall back to today's default swatch/glyph only when the row truly
// has neither (saved before these columns existed) — never an empty picker state.
function toFormValues(loc) {
  const values = { ...EMPTY_FORM }
  FORM_KEYS.forEach(k => { values[k] = loc[k] ?? '' })
  values.color = loc.color || DEFAULT_LOCATION_COLOR
  values.icon = loc.icon || DEFAULT_LOCATION_ICON
  return values
}

// LOC-DELETE-GUARD-1: the 409 payload's `counts` object uses backend source keys —
// map each to its own i18n label (mirrors the shared lookup in-use pattern §3A).
const USAGE_LABEL_KEYS = {
  candidates: 'candidates', candidate_links: 'candidateLinks', customers: 'customers',
  vacancies: 'vacancies', opportunities: 'opportunities', tasks: 'tasks',
  matches: 'matches', appointments: 'appointments',
}

// Turn `{ candidates: 3, tasks: 1 }` into "3 candidates, 1 task" (translated,
// ICU-plural) instead of surfacing the raw server payload/message.
function formatUsageCounts(counts, t) {
  return Object.entries(counts ?? {})
    .filter(([, count]) => count > 0)
    .map(([key, count]) => t(`locations.usage.${USAGE_LABEL_KEYS[key] ?? key}`, { count }))
    .join(', ')
}

export default function LocationsSettings() {
  const { t } = useTranslation(['settings', 'common'])
  const [locations, setLocations] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  // STRAAL-1: table ↔ map quick-view (office network on the shared radius map).
  const [view,      setView]      = useState('table')
  const [showModal, setShowModal] = useState(false)
  // null = create mode; an id = editing that row (house pencil pattern, §3A).
  const [editingId, setEditingId] = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [deletingId,setDeletingId]= useState(null)
  const [page,      setPage]      = useState(1)
  const PER_PAGE = 10
  // a11y (§6): trap focus in the "+ Vestiging" panel + close on Escape while open
  // (Danny 27-07 — the wide-form frame gets the same dialog behaviour as +Match/
  // +Kandidaat). The trap itself is armed INSIDE LocationFormModal (see its
  // docblock) so its effect attaches to a freshly mounted node every time the
  // dialog opens — arming it here would run once at page mount with no node yet.
  // useCallback still keeps ONE stable `onClose` identity across re-renders —
  // every keystroke into `form` re-renders this component and, via props,
  // LocationFormModal too; a fresh inline closure here would re-trigger the
  // child's useFocusTrap effect (its deps include `onClose`) on every keystroke,
  // stealing focus back to the first focusable element each time.
  const closeModal = useCallback(() => setShowModal(false), [])
  // House confirm dialog (never native window.confirm, §3A) — staged by remove().
  const { confirm, dialog } = useConfirm()

  // Load once — failure is its own state (never a false "no locations yet").
  useEffect(() => {
    api.get('/locations').then(r => setLocations(unwrapList(r).rows))
      .catch(() => setLoadError(true)).finally(() => setLoading(false))
  }, [])

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (loc) => { setEditingId(loc.id); setForm(toFormValues(loc)); setShowModal(true) }

  // One submit for both create (POST) and edit (PATCH — measured contract:
  // `PATCH/PUT /locations/{id}`, permission `settings.update`, see LocationController).
  // LocationResource is a wrapped single resource (`{"data": {...}}`) — unwrap()
  // strips that envelope instead of storing it as-is (the create path silently
  // stored the wrapper before; fixed here so the new edit path renders correctly).
  const submit = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        const res = await api.patch(`/locations/${editingId}`, form)
        const updated = unwrap(res)
        setLocations(p => p.map(l => (l.id === editingId ? updated : l)))
      } else {
        const res = await api.post('/locations', form)
        setLocations(p => [unwrap(res), ...p])
      }
      setShowModal(false); setForm(EMPTY_FORM); setEditingId(null)
    } catch {
      notifyError(t('locations.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // The list endpoint already flags a location referenced by other data
  // (LOC-DELETE-GUARD-1) — mirrors the shared lookup `inUse(item)` convention.
  const inUse = (loc) => Boolean(loc.in_use)

  // The actual DELETE /locations/{id} — remove on success or surface the in-use
  // counts on a 409 (never drop the row silently in either case). Only runs after
  // the confirm dialog below approves.
  const doRemove = async (loc) => {
    setDeletingId(loc.id)
    try {
      await api.delete(`/locations/${loc.id}`)
      setLocations(p => p.filter(l => l.id !== loc.id))
      notifySuccess(t('locations.deleteSuccess'))
    } catch (e) {
      if (e?.response?.status === 409) {
        // In-use guard: keep the row, flag it, and show WHAT is still linked.
        const list = formatUsageCounts(e.response.data?.counts, t)
        setLocations(p => p.map(l => (l.id === loc.id ? { ...l, in_use: true } : l)))
        notifyError(list ? t('locations.deleteBlocked', { list }) : t('locations.deleteBlockedTooltip'))
      } else {
        notifyError(t('locations.deleteFailed'))
      }
    } finally {
      setDeletingId(null)
    }
  }

  // Stage the house confirm dialog (never native window.confirm) before deleting.
  const remove = (loc) => {
    if (inUse(loc)) return
    confirm(t('locations.confirmDelete', { name: loc.name }), () => doRemove(loc), { danger: true })
  }

  const totalPages = Math.ceil(locations.length / PER_PAGE)
  // Clamp the page against the CURRENT page count as a derived render-time value
  // (no extra effect/state needed — "you might not need an effect"): deleting the
  // last row of page 2 drops totalPages to 1, and without this the raw `page`
  // state kept pointing at the now-gone page 2, showing an empty "no locations
  // yet" table with no way back except a reload. `|| 1` covers the empty-list
  // case (totalPages 0) so the slice below still reads from page 1.
  const safePage = Math.min(page, totalPages) || 1
  const paginated = locations.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('locations.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('locations.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Map quick-view via the ONE shared toggle (§4 — never hand-rolled). */}
          <QuickViewToggle size="compact" active={view === 'map'} onToggle={() => setView(v => (v === 'map' ? 'table' : 'map'))}
            label={t('common:map.view')} color="var(--color-primary)" icon={MapIcon} />
          {/* HUISSTIJL-1: the ONE "+ add" affordance, app-wide (§3A). */}
          <DrawerAddButton onClick={openCreate} label={t('locations.create')} />
        </div>
      </div>

      {loading ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p> : loadError ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--color-danger)', fontSize: 13 }}>
          <AlertTriangle size={14} /> {t('locations.loadError')}
        </div>
      ) : view === 'map' ? (
        // Office-network map (STRAAL-1) — lazy so Leaflet ships only when opened.
        <Suspense fallback={<p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common:map.loading')}</p>}>
          <LocationsMapView locations={locations} />
        </Suspense>
      ) : (
        <LocationsTable isLocked={inUse} rows={paginated} page={safePage} totalPages={totalPages} onPageChange={setPage}
          onEdit={openEdit} onDelete={remove} deletingId={deletingId} />
      )}

      {showModal && (
        <LocationFormModal editingId={editingId} form={form} setForm={setForm}
          saving={saving} onClose={closeModal} onSubmit={submit} />
      )}
      {/* House confirm dialog (never native window.confirm) — staged by remove(). */}
      {dialog}
    </div>
  )
}

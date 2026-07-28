import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Map as MapIcon, Pencil, Trash2, AlertTriangle, RefreshCw, Building2, Building, Home, Store, Warehouse, Landmark, MapPin, Briefcase } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import GeocodeButton from '@/components/ui/GeocodeButton'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useConfirm } from '@/hooks/useConfirm'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import { BTN_H } from '@/config/buttonMetrics'
import { ColorSwatch } from '../components/SettingsControls'
import IconPickerControl from './IconPickerControl'
// Deterministic per-row colour hash — the SAME helper as Avatar/Shiftmanager
// entities (§11: reuse, never a second hash). See LocationBadge below for why.
import { avatarColor } from '@/lib/avatarColor'

// Curated lucide set for the location badge/colour picker (VESTIGING-ICOON-1) —
// mirrors the document-type icon picker (lib/useDocumentTypes.ts): keys are the
// slugs Store/UpdateLocationRequest persist and LocationResource returns as-is.
const LOCATION_ICON_MAP = {
  'building-2': Building2, building: Building, home: Home, store: Store,
  warehouse: Warehouse, landmark: Landmark, 'map-pin': MapPin, briefcase: Briefcase,
}
const LOCATION_ICON_NAMES = Object.keys(LOCATION_ICON_MAP)
// Resolve a stored icon slug to its lucide component — unknown/null never crashes,
// it falls back to the same Building2 glyph the read-only hash badge always used.
function resolveLocationIcon(name) {
  return LOCATION_ICON_MAP[(name ?? '').trim().toLowerCase()] ?? Building2
}
// Defaults for a brand-new row's picker — a real, visible swatch/glyph instead of
// an empty string, mirroring the neutral fallback other lookup rows use
// (StatusListEditor's `item.color ?? '#6B7280'`).
const DEFAULT_LOCATION_ICON = 'building-2'
// eslint-disable-next-line no-restricted-syntax -- DATA: neutral default swatch colour for a brand-new row, not decorative UI chrome
const DEFAULT_LOCATION_COLOR = '#6B7280'

// STRAAL-1: Leaflet only loads when the map view opens (§9 — lazy heavy deps).
const LocationsMapView = lazy(() => import('./LocationsMapView'))

// Structured address — kept as separate fields so it can be matched/validated and
// composed consistently. Falls back to a legacy `address`/`full_address` string.
const EMPTY_FORM = {
  name: '', street: '', house_number: '', house_number_suffix: '',
  postal_code: '', city: '', country: '',
  // Business identifiers + contact details, so a location is a full entity.
  coc_number: '', vat_number: '', contact_name: '', phone: '', email: '',
  // VESTIGING-ICOON-1: branding — rides along in the same create/update payload.
  color: DEFAULT_LOCATION_COLOR, icon: DEFAULT_LOCATION_ICON,
}
// Field keys the API returns/accepts 1:1 (LocationResource ↔ Store/UpdateLocationRequest).
const FORM_KEYS = Object.keys(EMPTY_FORM)

function formatAddress(loc) {
  if (loc.address)      return loc.address
  if (loc.full_address) return loc.full_address
  const streetLine = [loc.street, loc.house_number].filter(Boolean).join(' ')
    + (loc.house_number_suffix ? ` ${loc.house_number_suffix}` : '')
  const cityLine = [loc.postal_code, loc.city].filter(Boolean).join(' ')
  const parts = [streetLine.trim(), cityLine.trim(), loc.country].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

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

// VESTIGING-ICOON-1 (Danny 28-07): `locations.color`/`locations.icon` now exist
// end-to-end (LocationResource + Store/UpdateLocationRequest, verified against the
// running DB) — this badge renders the row's OWN colour/icon when the backend has
// them. Older rows saved before these columns landed still have neither, so they
// fall back to the same deterministic avatarColor hash + Building2 glyph this
// badge always used (§11 reuse — one hash helper, shared with Avatar/Shiftmanager
// entities), so every row stays identifiable at a glance either way.
function LocationBadge({ name, color, icon }) {
  const resolvedColor = color || avatarColor(name)
  const Icon = icon ? resolveLocationIcon(icon) : Building2
  return (
    <span aria-hidden="true" style={{ width: 26, height: 26, flexShrink: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center', borderRadius: 7,
      background: `color-mix(in srgb, ${resolvedColor} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${resolvedColor} 45%, transparent)`, color: resolvedColor }}>
      <Icon size={13} />
    </span>
  )
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
  // +Kandidaat). Safe to call unconditionally: the hook itself no-ops without a
  // mounted node, so it can sit above the `showModal &&` render branch below.
  // useCallback keeps ONE stable function identity across re-renders — every
  // keystroke into `form` re-renders this component, and a fresh inline closure
  // here would re-trigger useFocusTrap's effect (its deps include `onClose`) on
  // every keystroke, stealing focus back to the first focusable element each time.
  const closeModal = useCallback(() => setShowModal(false), [])
  const modalPanelRef = useFocusTrap(closeModal)
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

  const paginated = locations.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(locations.length / PER_PAGE)

  const TH = { padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)' }
  const TD = { padding: '12px 14px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)' }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('locations.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('locations.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Map quick-view via the ONE shared toggle (§4 — never hand-rolled). */}
          <QuickViewToggle active={view === 'map'} onToggle={() => setView(v => (v === 'map' ? 'table' : 'map'))}
            label={t('common:map.view')} color="var(--color-primary)" icon={MapIcon} />
          <button onClick={openCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                     fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
                     background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
            <Plus size={13} /> {t('locations.create')}
          </button>
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
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>{t('locations.colName')}</th>
                <th style={TH}>{t('locations.colAddress')}</th>
                <th style={TH}>{t('locations.colCreated')}</th>
                <th style={{ ...TH, textAlign: 'right' }}>{t('locations.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={4} style={{ ...TD, textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>{t('locations.empty')}</td></tr>
              ) : paginated.map((loc, i) => (
                <tr key={loc.id ?? i}>
                  <td style={{ ...TD, fontWeight: 500, color: 'var(--text)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <LocationBadge name={loc.name} color={loc.color} icon={loc.icon} />
                      {loc.name}
                    </div>
                  </td>
                  <td style={TD}>{formatAddress(loc)}</td>
                  <td style={{ ...TD, color: 'var(--text-muted)', fontSize: 12 }}>
                    {loc.created_at ? new Date(loc.created_at).toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      {/* GEO-REGEOCODE-1: manual "PDOK opnieuw ophalen" — queued + async,
                          never claims "done" (see GeocodeButton). No bulk for locations (BE spec). */}
                      <GeocodeButton endpoint={`/locations/${loc.id}/geocode`} permission="settings.update"
                        disabled={!loc.postal_code && !loc.city && !loc.street} variant="row" />
                      <button onClick={() => openEdit(loc)} title={t('locations.edit')} aria-label={t('locations.edit')}
                        style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                 background: 'var(--hover-bg)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text)' }}>
                        <Pencil size={12} />
                      </button>
                      {/* Delete is live (LOC-DELETE-GUARD-1): disabled only when the backend
                          already flagged this location as in use; the 409 catch in remove()
                          is the belt-and-suspenders path for a race with a fresher link. */}
                      <button onClick={() => remove(loc)} disabled={deletingId === loc.id || inUse(loc)}
                        title={inUse(loc) ? t('locations.deleteBlockedTooltip') : t('locations.delete')}
                        aria-label={inUse(loc) ? t('locations.deleteBlockedTooltip') : t('locations.delete')}
                        style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                 background: inUse(loc) ? 'var(--hover-bg)' : 'var(--color-danger-bg)', border: 'none', borderRadius: 6,
                                 cursor: (deletingId === loc.id || inUse(loc)) ? 'not-allowed' : 'pointer',
                                 color: inUse(loc) ? 'var(--text-muted)' : 'var(--color-danger)', opacity: inUse(loc) ? 0.5 : 1 }}>
                        {deletingId === loc.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                style={{ height: 30, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--border)' : 'var(--text)' }}>
                {t('locations.prev')}
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                style={{ height: 30, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--border)' : 'var(--text)' }}>
                {t('locations.next')}
              </button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={closeModal} />
          {/* Wide-form frame (Danny 27-07: "+ vestiging... moet net zo breed en hoog
              worden als + match of + nieuwe kandidaat") — same WIDE_MODAL footprint
              as AddCandidateModal/MatchPlacementModal, `94vw` cap so it still breathes
              on narrow viewports (mirrors matchPlacement/styles.ts' `panel`, this
              component being `position: fixed` with no flex-centering overlay of its
              own). role="dialog" + useFocusTrap (§6): focus trap, Escape-to-close,
              focus restore — this panel had none of that before. */}
          <div ref={modalPanelRef} role="dialog" aria-modal="true" tabIndex={-1}
            aria-label={editingId ? t('locations.editTitle') : t('locations.create')}
            className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--surface)', borderRadius: 12, padding: 24, width: '94vw', maxWidth: WIDE_MODAL.maxWidth, maxHeight: WIDE_MODAL.maxHeight, overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{editingId ? t('locations.editTitle') : t('locations.create')}</span>
              <button onClick={closeModal} aria-label={t('common.cancel')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>

            {(() => {
              // House field footprint (Danny 27-07 point D): 11px uppercase muted
              // label above each input, fontSize 13 / borderRadius 8 — mirrors
              // matchPlacement/styles.ts' `lbl`/`input` exactly.
              const lbl = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 5 }
              const inp = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
              // Titled-card chrome (Danny 27-07 point B: "kaders om elk blokje") — the
              // shared cardHead/cardBox (CLAUDE.md §11: one source instead of a
              // per-entity copy), imported at module top since this file stays plain JSX.
              const setF = (k) => (e) => setForm(x => ({ ...x, [k]: e.target.value }))
              // Called as a function (not <F/>) so inputs keep focus while typing.
              const field = (k, label, placeholder, type = 'text', flex = 1) => (
                <div style={{ flex, minWidth: 0 }}>
                  <div style={lbl}>{label}</div>
                  <input type={type} value={form[k]} onChange={setF(k)} placeholder={placeholder} aria-label={label} style={inp} />
                </div>
              )
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Algemeen — just the name; this form carries no "standaard"/default
                      flag (unlike the customer-location modal), so nothing invented here. */}
                  <div>
                    <div style={cardHead}>{t('locations.sectionGeneral')}</div>
                    <div style={cardBox}>
                      {field('name', t('locations.nameLabel'), t('locations.namePlaceholder'))}
                      {/* Branding (VESTIGING-ICOON-1) — the same ColorSwatch/IconPickerControl
                          every other lookup editor reuses (StatusListEditor), not a bespoke
                          picker. Both ride along in the create/update payload below. */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                        <div>
                          <div style={lbl}>{t('locations.color')}</div>
                          <ColorSwatch color={form.color} onChange={c => setForm(x => ({ ...x, color: c }))} />
                        </div>
                        <div>
                          <div style={lbl}>{t('locations.icon')}</div>
                          <IconPickerControl icons={LOCATION_ICON_NAMES} resolve={resolveLocationIcon}
                            value={form.icon} color={form.color || DEFAULT_LOCATION_COLOR}
                            label={t('locations.icon')} onPick={icon => setForm(x => ({ ...x, icon }))} />
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{t('locations.colorHint')}</p>
                    </div>
                  </div>

                  {/* Structured address — separate fields so they can be matched/validated. */}
                  <div>
                    <div style={cardHead}>{t('locations.sectionAddress')}</div>
                    <div style={cardBox}>
                      {/* Street + number + suffix on one line (compact, NL convention). */}
                      <div style={{ display: 'flex', gap: 12 }}>
                        {field('street', t('locations.street'), t('locations.street'), 'text', 3)}
                        {field('house_number', t('locations.houseNumber'), '28', 'text', 1)}
                        {field('house_number_suffix', t('locations.houseNumberSuffix'), 'A', 'text', 1)}
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {field('postal_code', t('locations.postalCode'), '1234 AB')}
                        {field('city', t('locations.city'), t('locations.city'))}
                      </div>
                      {field('country', t('locations.country'), 'Nederland')}
                    </div>
                  </div>

                  {/* Business identifiers for invoicing/registration. */}
                  <div>
                    <div style={cardHead}>{t('locations.sectionBusiness')}</div>
                    <div style={cardBox}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {field('coc_number', t('locations.cocNumber'), '12345678')}
                        {field('vat_number', t('locations.vatNumber'), 'NL000000000B01')}
                      </div>
                    </div>
                  </div>

                  {/* Contact details for this location. */}
                  <div>
                    <div style={cardHead}>{t('locations.sectionContact')}</div>
                    <div style={cardBox}>
                      {field('contact_name', t('locations.contactName'), t('locations.contactName'))}
                      <div style={{ display: 'flex', gap: 12 }}>
                        {field('phone', t('locations.phone'), '+31 6 12345678', 'tel')}
                        {field('email', t('locations.email'), 'name@company.com', 'email')}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={closeModal} style={{ height: BTN_H, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common.cancel')}</button>
              <button onClick={submit} disabled={saving || !form.name.trim()}
                style={{ height: BTN_H, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: form.name.trim() ? 1 : 0.4 }}>
                {saving ? t('common.saving') : (editingId ? t('common.save') : t('locations.createBtn'))}
              </button>
            </div>
          </div>
        </>
      )}
      {/* House confirm dialog (never native window.confirm) — staged by remove(). */}
      {dialog}
    </div>
  )
}

import { useState, useEffect, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Map as MapIcon, Pencil, Trash2, AlertTriangle, RefreshCw } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import QuickViewToggle from '@/components/ui/QuickViewToggle'

// STRAAL-1: Leaflet only loads when the map view opens (§9 — lazy heavy deps).
const LocationsMapView = lazy(() => import('./LocationsMapView'))

// Structured address — kept as separate fields so it can be matched/validated and
// composed consistently. Falls back to a legacy `address`/`full_address` string.
const EMPTY_FORM = {
  name: '', street: '', house_number: '', house_number_suffix: '',
  postal_code: '', city: '', country: '',
  // Business identifiers + contact details, so a location is a full entity.
  coc_number: '', vat_number: '', contact_name: '', phone: '', email: '',
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
function toFormValues(loc) {
  const values = { ...EMPTY_FORM }
  FORM_KEYS.forEach(k => { values[k] = loc[k] ?? '' })
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

  // DELETE /locations/{id} — confirm, then remove on success or surface the
  // in-use counts on a 409 (never drop the row silently in either case).
  const remove = async (loc) => {
    if (inUse(loc)) return
    if (!confirm(t('locations.confirmDelete', { name: loc.name }))) return
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
                  <td style={{ ...TD, fontWeight: 500, color: 'var(--text)' }}>{loc.name}</td>
                  <td style={TD}>{formatAddress(loc)}</td>
                  <td style={{ ...TD, color: 'var(--text-muted)', fontSize: 12 }}>
                    {loc.created_at ? new Date(loc.created_at).toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
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
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setShowModal(false)} />
          <div className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--surface)', borderRadius: 12, padding: 24, width: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{editingId ? t('locations.editTitle') : t('locations.create')}</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>

            {(() => {
              const lbl = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
              const inp = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }
              const sectionLbl = { fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 4 }
              const setF = (k) => (e) => setForm(x => ({ ...x, [k]: e.target.value }))
              // Called as a function (not <F/>) so inputs keep focus while typing.
              const field = (k, label, placeholder, type = 'text', flex = 1) => (
                <div style={{ flex, minWidth: 0 }}>
                  <div style={lbl}>{label}</div>
                  <input type={type} value={form[k]} onChange={setF(k)} placeholder={placeholder} aria-label={label} style={inp} />
                </div>
              )
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {field('name', t('locations.nameLabel'), t('locations.namePlaceholder'))}

                  {/* Structured address — separate fields so they can be matched/validated. */}
                  <div style={sectionLbl}>{t('locations.sectionAddress')}</div>
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

                  {/* Business identifiers for invoicing/registration. */}
                  <div style={sectionLbl}>{t('locations.sectionBusiness')}</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {field('coc_number', t('locations.cocNumber'), '12345678')}
                    {field('vat_number', t('locations.vatNumber'), 'NL000000000B01')}
                  </div>

                  {/* Contact details for this location. */}
                  <div style={sectionLbl}>{t('locations.sectionContact')}</div>
                  {field('contact_name', t('locations.contactName'), t('locations.contactName'))}
                  <div style={{ display: 'flex', gap: 12 }}>
                    {field('phone', t('locations.phone'), '+31 6 12345678', 'tel')}
                    {field('email', t('locations.email'), 'name@company.com', 'email')}
                  </div>
                </div>
              )
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={submit} disabled={saving || !form.name.trim()}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: form.name.trim() ? 1 : 0.4 }}>
                {saving ? t('common.saving') : (editingId ? t('common.save') : t('locations.createBtn'))}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

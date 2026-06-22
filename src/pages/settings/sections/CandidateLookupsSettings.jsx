/**
 * Candidate lookups — the three lookups behind the candidate model, each now its
 * own settings sub-tab (Contract forms · Funnel stages · Statuses). CRUD +
 * drag-reorder against /settings/candidate-lookups/{type}. The `value` slug is
 * immutable once created (only label/colour/order/active change); a new item's
 * slug is derived from its label but can be overridden. Colours/labels per tenant.
 *
 * Two per-item flags live here:
 *   - statuses    → `is_applicant`        (legacy funnel-reveal flag, model A)
 *   - funnel_types→ `requires_appointment` (this stage expects a planned intake
 *                    appointment; missing one is flagged — see §3B / C-22)
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Trash2, RefreshCw, Pencil } from 'lucide-react'
import api from '../../../lib/api'
import { DragList, ColorSwatch, ColorBadge } from '../components/SettingsControls'

const BASE = '/settings/candidate-lookups'
const unwrap = (res) => res?.data?.data ?? res?.data

// "Niet actief" → "niet_actief" — a stable English-ish slug suggestion.
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

// One lookup list (contract forms / funnel stages / statuses) with inline CRUD.
export function LookupBlock({ slug, title, subtitle, items, setItems }) {
  const { t } = useTranslation('settings')
  const [modal,    setModal]    = useState(null) // null | { mode, id?, value, label, color, is_applicant, requires_appointment }
  const [busy,     setBusy]     = useState(false)
  const [deleting, setDeleting] = useState(null)

  // Per-item flag location: is_applicant on statuses, requires_appointment on the funnel.
  const isStatusBlock = slug === 'statuses'
  const isFunnelBlock = slug === 'funnel-types'

  const openAdd  = ()   => setModal({ mode: 'add',  value: '', label: '', color: '#3B8FD4', is_applicant: false, requires_appointment: false, requires_reason: false, is_match: false, is_rejected: false })
  const openEdit = (it) => setModal({ mode: 'edit', id: it.id, value: it.value, label: it.label, color: it.color ?? '#6B7280',
    is_applicant: it.is_applicant === true, requires_appointment: it.requires_appointment === true, requires_reason: it.requires_reason === true,
    is_match: it.is_match === true, is_rejected: it.is_rejected === true })

  const save = async () => {
    if (!modal.label.trim()) return
    setBusy(true)
    // Only send the flag that exists on this lookup; the backend guards the rest.
    const flagFields = {
      ...(isStatusBlock ? { is_applicant: modal.is_applicant, requires_reason: modal.requires_reason } : {}),
      ...(isFunnelBlock ? { requires_appointment: modal.requires_appointment, is_match: modal.is_match, is_rejected: modal.is_rejected } : {}),
    }
    try {
      if (modal.mode === 'add') {
        const value = modal.value.trim() || slugify(modal.label)
        const created = unwrap(await api.post(`${BASE}/${slug}`, { value, label: modal.label.trim(), color: modal.color, ...flagFields }))
        setItems(p => [...p, created])
      } else {
        await api.put(`${BASE}/${slug}/${modal.id}`, { label: modal.label.trim(), color: modal.color, ...flagFields })
        setItems(p => p.map(x => x.id === modal.id ? { ...x, label: modal.label.trim(), color: modal.color, ...flagFields } : x))
      }
      setModal(null)
    } catch { /* noop */ } finally { setBusy(false) }
  }

  const updateColor = async (it, color) => {
    setItems(p => p.map(x => x.id === it.id ? { ...x, color } : x))
    try { await api.put(`${BASE}/${slug}/${it.id}`, { label: it.label, color }) } catch { /* noop */ }
  }

  // An item is protected when the backend marks it as referenced by existing data.
  const inUse = (i) => Boolean(i.in_use ?? i.is_used ?? i.locked ?? ((i.usage_count ?? i.candidates_count ?? 0) > 0))

  const remove = async (it) => {
    if (inUse(it)) return
    if (!confirm(t('lookups.confirmDelete', { name: it.label }))) return
    setDeleting(it.id)
    // 409 = backend rejects deletion of an in-use item; keep the row and flag it.
    try { await api.delete(`${BASE}/${slug}/${it.id}`); setItems(p => p.filter(x => x.id !== it.id)) }
    catch (e) {
      if (e?.response?.status === 409) setItems(p => p.map(x => x.id === it.id ? { ...x, in_use: true } : x))
    } finally { setDeleting(null) }
  }

  const reorder = async (next) => {
    setItems(next)
    try { await api.put(`${BASE}/${slug}/reorder`, { ids: next.map(x => x.id) }) } catch { /* noop */ }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{title}</h3>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{subtitle}</p>
        </div>
        <button onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #E5E7EB',
                   background: 'white', cursor: 'pointer', color: '#374151' }}>
          <Plus size={13} /> {t('lookups.add')}
        </button>
      </div>

      <DragList
        items={items}
        onReorder={reorder}
        renderItem={(item) => (
          <>
            <ColorSwatch color={item.color ?? '#6B7280'} onChange={c => updateColor(item, c)} />
            <ColorBadge label={item.label} color={item.color ?? '#6B7280'} />
            <code style={{ fontSize: 11, color: '#9CA3AF' }}>{item.value}</code>
            {/* Funnel badge: marks the status that reveals the application funnel. */}
            {isStatusBlock && item.is_applicant && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-primary)',
                             background: 'var(--color-primary-bg, #EEF2FF)', padding: '2px 7px', borderRadius: 999 }}>
                {t('lookups.applicantBadge')}
              </span>
            )}
            {/* Reason badge: marks a status that requires a reason when set (e.g. Inactive). */}
            {isStatusBlock && item.requires_reason && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-warning)',
                             background: 'var(--color-warning-bg, #FEF3C7)', padding: '2px 7px', borderRadius: 999 }}>
                {t('lookups.reasonBadge')}
              </span>
            )}
            {/* Appointment badge: marks the funnel stage that requires a planned intake. */}
            {isFunnelBlock && item.requires_appointment && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-primary)',
                             background: 'var(--color-primary-bg, #EEF2FF)', padding: '2px 7px', borderRadius: 999 }}>
                {t('lookups.appointmentBadge')}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={() => openEdit(item)} title={t('lookups.edit')}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: '#F3F4F6', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#6B7280' }}>
              <Pencil size={11} />
            </button>
            <button onClick={() => remove(item)} disabled={deleting === item.id || inUse(item)}
              title={inUse(item) ? t('lookups.inUse') : undefined}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: '#FEF2F2', border: 'none', borderRadius: 6, color: 'var(--color-danger)',
                       cursor: inUse(item) ? 'not-allowed' : 'pointer', opacity: inUse(item) ? 0.4 : 1 }}>
              {deleting === item.id ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
            </button>
          </>
        )}
      />
      {items.length === 0 && <p style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 0' }}>{t('lookups.empty')}</p>}

      {modal && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setModal(null)} />
          <div className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{modal.mode === 'add' ? t('lookups.add') : t('lookups.edit')}</span>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={16} /></button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>{t('lookups.labelField')}</div>
              <input value={modal.label} autoFocus onChange={e => setModal(m => ({ ...m, label: e.target.value }))}
                placeholder={t('lookups.labelPlaceholder')}
                style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>{t('lookups.valueField')}</div>
              <input value={modal.value}
                disabled={modal.mode === 'edit'}
                onChange={e => setModal(m => ({ ...m, value: e.target.value }))}
                placeholder={modal.label ? slugify(modal.label) : 'slug'}
                style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, fontFamily: 'monospace',
                         border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                         background: modal.mode === 'edit' ? '#F9FAFB' : 'white', color: modal.mode === 'edit' ? '#9CA3AF' : '#111827' }} />
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                {modal.mode === 'edit' ? t('lookups.valueImmutable') : t('lookups.valueHint')}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>{t('lookups.colorField')}</div>
              <ColorSwatch color={modal.color} onChange={c => setModal(m => ({ ...m, color: c }))} />
            </div>

            {/* Funnel-reveal toggle — statuses only; flags the applicant status. */}
            {isStatusBlock && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={modal.is_applicant}
                    onChange={e => setModal(m => ({ ...m, is_applicant: e.target.checked }))} />
                  <span style={{ fontSize: 13, color: '#374151' }}>{t('lookups.isApplicant')}</span>
                </label>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{t('lookups.isApplicantHint')}</div>
              </div>
            )}

            {/* Reason-required toggle — statuses only (e.g. Inactive needs a reason). */}
            {isStatusBlock && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={modal.requires_reason}
                    onChange={e => setModal(m => ({ ...m, requires_reason: e.target.checked }))} />
                  <span style={{ fontSize: 13, color: '#374151' }}>{t('lookups.requiresReason')}</span>
                </label>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{t('lookups.requiresReasonHint')}</div>
              </div>
            )}

            {/* Appointment toggle — funnel stages only; flags the intake stage. */}
            {isFunnelBlock && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={modal.requires_appointment}
                    onChange={e => setModal(m => ({ ...m, requires_appointment: e.target.checked }))} />
                  <span style={{ fontSize: 13, color: '#374151' }}>{t('lookups.requiresAppointment')}</span>
                </label>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{t('lookups.requiresAppointmentHint')}</div>
              </div>
            )}

            {/* Match toggle — funnel stages only; this stage turns the application into a Match (matched bucket). */}
            {isFunnelBlock && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={modal.is_match}
                    onChange={e => setModal(m => ({ ...m, is_match: e.target.checked }))} />
                  <span style={{ fontSize: 13, color: '#374151' }}>{t('lookups.isMatch')}</span>
                </label>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{t('lookups.isMatchHint')}</div>
              </div>
            )}

            {/* Rejected toggle — funnel stages only; this stage is the rejected bucket. */}
            {isFunnelBlock && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={modal.is_rejected}
                    onChange={e => setModal(m => ({ ...m, is_rejected: e.target.checked }))} />
                  <span style={{ fontSize: 13, color: '#374151' }}>{t('lookups.isRejected')}</span>
                </label>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{t('lookups.isRejectedHint')}</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setModal(null)} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, background: 'white', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={save} disabled={busy || !modal.label.trim()}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: modal.label.trim() ? 1 : 0.4 }}>
                {busy ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// One candidate-lookup type rendered as its own settings tab. Each tab loads the
// combined endpoint and renders only its slice, so the tabs stay independent.
function CandidateLookupSection({ typeKey, slug }) {
  const { t } = useTranslation('settings')
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(BASE)
      .then(r => { const d = unwrap(r) ?? {}; setItems(d[typeKey] ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [typeKey])

  return (
    <div style={{ maxWidth: 640 }}>
      {loading
        ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>{t('common.loadingShort')}</p>
        : <LookupBlock slug={slug} title={t(`lookups.${typeKey}.title`)} subtitle={t(`lookups.${typeKey}.subtitle`)} items={items} setItems={setItems} />}
    </div>
  )
}

// Contract forms (multi-value per candidate).
export function ContractFormsSettings() {
  return <CandidateLookupSection typeKey="candidate_types" slug="candidate-types" />
}

// Funnel stages (per application) — carries the requires_appointment flag.
export function FunnelStagesSettings() {
  return <CandidateLookupSection typeKey="funnel_types" slug="funnel-types" />
}

// Candidate statuses (person lifecycle).
export function CandidateStatusesSettings() {
  return <CandidateLookupSection typeKey="statuses" slug="statuses" />
}

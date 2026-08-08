/**
 * Candidate lookups — the three lookups behind the candidate model, each now its
 * own settings sub-tab (Contract forms · Funnel stages · Statuses). CRUD +
 * drag-reorder against /settings/candidate-lookups/{type}. The `value` slug is
 * immutable once created (only label/colour/order/active change); a new item's
 * slug is derived from its label but can be overridden. Colours/labels per tenant.
 *
 * Two per-item flags live here:
 *   - phases      → `is_applicant`        (the phase a Lead auto-promotes to on
 *                    their first application — ApplicantStatusTransition reads
 *                    it; NOT a backend singleton, see the phase block below)
 *   - funnel_types→ `requires_appointment` (this stage expects a planned intake
 *                    appointment; missing one is flagged — see §3B / C-22)
 *
 * `is_default` (LOOKUP-DEFAULT-1, api 4c25677) is a backend-enforced SINGLETON on
 * funnel_types (application_stages) and phases — at most one row may carry it per
 * lookup (seeded: Gesolliciteerd/Applied). A dedicated DefaultToggle per row promotes
 * one row and clears the others optimistically; no modal field (see setDefault below).
 * DEFAULT-UNDO (Danny 04-08) made the shared DefaultToggle undoable by default, but
 * THIS caller stays one-way (`undoable={false}`) — verified against
 * CandidateLookupController::update() (koiosmatch-api, CandidateLookupController.php:
 * 138-143): the backend 422s a PUT that clears is_default on funnel-types/phases, so
 * there is no clear path to mirror here.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Trash2, RefreshCw, Pencil } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import { DragList, ColorSwatch, ColorBadge, DefaultToggle } from '../components/SettingsControls'
import { Toggle } from '../components/SettingsKit'
import { BTN_H } from '@/config/buttonMetrics'

const BASE = '/settings/candidate-lookups'

// "Niet actief" → "niet_actief" — a stable English-ish slug suggestion.
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

// One lookup list (contract forms / funnel stages / statuses) with inline CRUD.
export function LookupBlock({ slug, title, subtitle, items, setItems, locked = false }) {
  const { t } = useTranslation('settings')
  const [modal,    setModal]    = useState(null) // null | { mode, id?, value, label, color, is_applicant, requires_appointment }
  const [busy,     setBusy]     = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [settingDefaultId, setSettingDefaultId] = useState(null)
  // House confirmation dialog (§0 restschuld) — replaces the native window.confirm() below.
  const { confirm, dialog } = useConfirm()

  // Per-item flag location: is_applicant on statuses, requires_appointment on the funnel.
  const isStatusBlock = slug === 'statuses'
  const isFunnelBlock = slug === 'funnel-types'
  const isPhaseBlock  = slug === 'phases'
  // Default flag is settable on both funnel stages and phases (04-08: phases list stays
  // add/remove-locked, but the default toggle becomes interactive on it).
  const supportsDefault = isFunnelBlock || isPhaseBlock

  // eslint-disable-next-line no-restricted-syntax -- DATA: default swatch colour pre-filled for a newly created lookup row, not UI chrome
  const openAdd  = ()   => setModal({ mode: 'add',  value: '', label: '', color: '#3B8FD4', requires_appointment: false, requires_reason: false, requires_match: false, expects_return_date: false, is_match: false, is_rejected: false, is_proposal: false, is_blacklist: false, is_applicant: false })
  // eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome
  const openEdit = (it) => setModal({ mode: 'edit', id: it.id, value: it.value, label: it.label, color: it.color ?? '#6B7280',
    requires_appointment: it.requires_appointment === true, requires_reason: it.requires_reason === true,
    requires_match: it.requires_match === true, expects_return_date: it.expects_return_date === true,
    is_match: it.is_match === true, is_rejected: it.is_rejected === true,
    is_proposal: it.is_proposal === true, is_blacklist: it.is_blacklist === true,
    is_applicant: it.is_applicant === true })

  const save = async () => {
    if (!modal.label.trim()) return
    setBusy(true)
    // Only send the flag that exists on this lookup; the backend guards the rest.
    const flagFields = {
      ...(isStatusBlock ? { requires_reason: modal.requires_reason, requires_match: modal.requires_match, expects_return_date: modal.expects_return_date, is_blacklist: modal.is_blacklist } : {}),
      ...(isFunnelBlock ? { requires_appointment: modal.requires_appointment, is_match: modal.is_match, is_rejected: modal.is_rejected, is_proposal: modal.is_proposal } : {}),
      ...(isPhaseBlock  ? { is_applicant: modal.is_applicant } : {}),
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
    const previous = items
    setItems(p => p.map(x => x.id === it.id ? { ...x, color } : x))
    // Revert the optimistic colour on failure — otherwise the row keeps showing an
    // unsaved colour as if it had persisted (§3: no silent state drift).
    try { await api.put(`${BASE}/${slug}/${it.id}`, { label: it.label, color }) }
    catch { setItems(previous); notifyError(t('statusList.saveFailed')) }
  }

  // Singleton flip (funnel stages only): promote one stage to is_default and clear
  // every other row optimistically — mirrors the backend's model-enforced max-one
  // rule so the UI doesn't need a refetch. Roll back the local state on failure.
  const setDefault = async (it) => {
    if (it.is_default || settingDefaultId) return
    const previous = items
    setSettingDefaultId(it.id)
    setItems(p => p.map(x => ({ ...x, is_default: x.id === it.id })))
    try {
      await api.put(`${BASE}/${slug}/${it.id}`, { label: it.label, color: it.color, is_default: true })
    } catch {
      // Audit r4: revert alone read as "saved" — tell the user, like the siblings.
      setItems(previous)
      notifyError(t('statusList.saveFailed'))
    } finally {
      setSettingDefaultId(null)
    }
  }

  // An item is protected when the backend marks it as referenced by existing data.
  const inUse = (i) => Boolean(i.in_use ?? i.is_used ?? i.locked ?? ((i.usage_count ?? i.candidates_count ?? 0) > 0))

  const remove = (it) => {
    if (inUse(it)) return
    confirm(t('lookups.confirmDelete', { name: it.label }), async () => {
      setDeleting(it.id)
      // 409 = backend rejects deletion of an in-use item; keep the row and flag it.
      try { await api.delete(`${BASE}/${slug}/${it.id}`); setItems(p => p.filter(x => x.id !== it.id)) }
      catch (e) {
        if (e?.response?.status === 409) setItems(p => p.map(x => x.id === it.id ? { ...x, in_use: true } : x))
      } finally { setDeleting(null) }
    }, { danger: true })
  }

  const reorder = async (next) => {
    const previous = items
    setItems(next)
    // Revert the optimistic order on failure — otherwise the list shows an order
    // that was never actually saved (§3: no silent state drift).
    try { await api.put(`${BASE}/${slug}/reorder`, { ids: next.map(x => x.id) }) }
    catch { setItems(previous); notifyError(t('statusList.saveFailed')) }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>
        </div>
        {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        {!locked && <button onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 12px',
                   fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid var(--border)',
                   background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
          <Plus size={13} /> {t('lookups.add')}
        </button>}
      </div>

      <DragList
        items={items}
        onReorder={reorder}
        renderItem={(item) => (
          <>
            {/* eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome */}
            <ColorSwatch color={item.color ?? '#6B7280'} onChange={c => updateColor(item, c)} />
            {/* eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome */}
            <ColorBadge label={item.label} color={item.color ?? '#6B7280'} />
            <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.value}</code>
            {/* Reason badge: marks a status that requires a reason when set (e.g. Inactive). */}
            {isStatusBlock && item.requires_reason && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-warning)',
                             background: 'var(--color-warning-bg)', padding: '2px 7px', borderRadius: 999 }}>
                {t('lookups.reasonBadge')}
              </span>
            )}
            {/* Appointment badge: marks the funnel stage that requires a planned intake. */}
            {isFunnelBlock && item.requires_appointment && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-primary-text)',
                             background: 'var(--color-primary-bg)', padding: '2px 7px', borderRadius: 999 }}>
                {t('lookups.appointmentBadge')}
              </span>
            )}
            {/* Applicant badge: marks the phase a Lead auto-promotes to on their first
                application (CandidatePhase.is_applicant — ApplicantStatusTransition,
                koiosmatch-api). Audit finding: the flag drives real backend automation
                but had zero FE control until now. Keys are namespaced `phaseApplicant*`
                (not `isApplicant`/`applicantBadge`) — those two already exist in every
                locale for an unrelated, now-dead "statuses reveal the funnel" flag from
                the retired model-A UI; reusing them would show stale copy here. */}
            {isPhaseBlock && item.is_applicant && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-success)',
                             background: 'var(--color-success-bg)', padding: '2px 7px', borderRadius: 999 }}>
                {t('lookups.phaseApplicantBadge')}
              </span>
            )}
            {/* Default toggle: the singleton stage/phase new records land on when none is chosen.
                undoable={false}: CandidateLookupController::update() (koiosmatch-api,
                app/Http/Controllers/CandidateLookupController.php:138-143) 422s any PUT that
                clears is_default on funnel-types/phases — ApplicationStage::SINGLETON_FLAGS
                (app/Models/ApplicationStage.php:22) includes is_default and the controller
                aborts "At least one stage must keep its is_default flag." for BOTH lookup
                types (the guard iterates SINGLETON_FLAGS against cfg['flags'], which lists
                is_default for both). Verified 04-08 — this pill stays a one-way ratchet
                until the backend adds a real clear path. */}
            {supportsDefault && (
              <DefaultToggle active={Boolean(item.is_default)} busy={settingDefaultId === item.id}
                onClick={() => setDefault(item)} undoable={false}
                activeLabel={t('common.default')} inactiveLabel={t('common.setDefault')} />
            )}
            <div style={{ flex: 1 }} />
            {/* Locked (system) list: only ADD/DELETE are blocked here — CandidateLookupController
                (koiosmatch-api) only abort_if($type === 'phases') inside store()/destroy()
                (PHASE-LOCK-1); update() carries NO phases restriction, so rename/colour/flag
                edits stay open on a system phase. The edit pencil must therefore stay enabled
                (audit finding, 04-08 — it used to be wrongly disabled here too). */}
            <button onClick={() => openEdit(item)} title={t('lookups.edit')}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'var(--border)', border: 'none', borderRadius: 6,
                       cursor: 'pointer', color: 'var(--text-muted)' }}>
              <Pencil size={11} />
            </button>
            {!locked && <button onClick={() => remove(item)} disabled={deleting === item.id || inUse(item)}
              title={inUse(item) ? t('lookups.inUse') : undefined}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'var(--color-danger-bg)', border: 'none', borderRadius: 6, color: 'var(--color-danger)',
                       cursor: inUse(item) ? 'not-allowed' : 'pointer', opacity: inUse(item) ? 0.4 : 1 }}>
              {deleting === item.id ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
            </button>}
          </>
        )}
      />
      {items.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>{t('lookups.empty')}</p>}

      {modal && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setModal(null)} />
          <div className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--surface)', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{modal.mode === 'add' ? t('lookups.add') : t('lookups.edit')}</span>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('lookups.labelField')}</div>
              <input value={modal.label} autoFocus onChange={e => setModal(m => ({ ...m, label: e.target.value }))}
                placeholder={t('lookups.labelPlaceholder')}
                style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('lookups.valueField')}</div>
              <input value={modal.value}
                disabled={modal.mode === 'edit'}
                onChange={e => setModal(m => ({ ...m, value: e.target.value }))}
                placeholder={modal.label ? slugify(modal.label) : 'slug'}
                style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, fontFamily: 'monospace',
                         border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                         background: modal.mode === 'edit' ? 'var(--hover-bg)' : 'var(--surface)', color: modal.mode === 'edit' ? 'var(--text-muted)' : 'var(--text)' }} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {modal.mode === 'edit' ? t('lookups.valueImmutable') : t('lookups.valueHint')}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('lookups.colorField')}</div>
              <ColorSwatch color={modal.color} onChange={c => setModal(m => ({ ...m, color: c }))} />
            </div>

            {/* Applicant toggle — phases only. Not backend-singleton (verified against
                CandidateLookupController::update(), koiosmatch-api: ApplicationStage::
                SINGLETON_FLAGS does not include is_applicant for the phases config), so a
                plain toggle — multiple phases may carry it, ApplicantStatusTransition just
                reads the first active match. */}
            {isPhaseBlock && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Toggle checked={modal.is_applicant} onChange={v => setModal(m => ({ ...m, is_applicant: v }))} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('lookups.phaseApplicant')}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('lookups.phaseApplicantHint')}</div>
              </div>
            )}

            {/* Reason-required toggle — statuses only (e.g. Inactive needs a reason). */}
            {isStatusBlock && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Toggle checked={modal.requires_reason} onChange={v => setModal(m => ({ ...m, requires_reason: v }))} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('lookups.requiresReason')}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('lookups.requiresReasonHint')}</div>
              </div>
            )}

            {/* Match-required toggle — statuses only (e.g. Placed needs a linked Match). */}
            {isStatusBlock && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Toggle checked={modal.requires_match} onChange={v => setModal(m => ({ ...m, requires_match: v }))} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('lookups.requiresMatch')}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('lookups.requiresMatchHint')}</div>
              </div>
            )}

            {/* Return-date toggle — statuses only (e.g. Unavailable asks "available again on"). */}
            {isStatusBlock && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Toggle checked={modal.expects_return_date} onChange={v => setModal(m => ({ ...m, expects_return_date: v }))} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('lookups.expectsReturnDate')}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('lookups.expectsReturnDateHint')}</div>
              </div>
            )}

            {/* Blacklist toggle — statuses only (§3B: Blacklist is a deployability value, danger-styled). */}
            {isStatusBlock && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Toggle checked={modal.is_blacklist} onChange={v => setModal(m => ({ ...m, is_blacklist: v }))} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>{t('lookups.isBlacklist')}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('lookups.isBlacklistHint')}</div>
              </div>
            )}

            {/* Appointment toggle — funnel stages only; flags the intake stage. */}
            {isFunnelBlock && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Toggle checked={modal.requires_appointment} onChange={v => setModal(m => ({ ...m, requires_appointment: v }))} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('lookups.requiresAppointment')}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('lookups.requiresAppointmentHint')}</div>
              </div>
            )}

            {/* Match toggle — funnel stages only; this stage turns the application into a Match (matched bucket). */}
            {isFunnelBlock && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Toggle checked={modal.is_match} onChange={v => setModal(m => ({ ...m, is_match: v }))} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('lookups.isMatch')}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('lookups.isMatchHint')}</div>
              </div>
            )}

            {/* Rejected toggle — funnel stages only; this stage is the rejected bucket. */}
            {isFunnelBlock && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Toggle checked={modal.is_rejected} onChange={v => setModal(m => ({ ...m, is_rejected: v }))} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('lookups.isRejected')}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('lookups.isRejectedHint')}</div>
              </div>
            )}

            {/* Proposal toggle — funnel stages only; this stage represents the "proposed to customer" step. */}
            {isFunnelBlock && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Toggle checked={modal.is_proposal} onChange={v => setModal(m => ({ ...m, is_proposal: v }))} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('lookups.isProposal')}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('lookups.isProposalHint')}</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setModal(null)} style={{ height: 34, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={save} disabled={busy || !modal.label.trim()}
                style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'var(--color-on-accent)', cursor: 'pointer', opacity: modal.label.trim() ? 1 : 0.4 }}>
                {busy ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </>
      )}
      {dialog}
    </div>
  )
}

// One candidate-lookup type rendered as its own settings tab. Each tab loads the
// combined endpoint and renders only its slice, so the tabs stay independent.
function CandidateLookupSection({ typeKey, slug, locked = false }) {
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
        ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
        : <LookupBlock slug={slug} title={t(`lookups.${typeKey}.title`)} subtitle={t(`lookups.${typeKey}.subtitle`)} items={items} setItems={setItems} locked={locked} />}
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

// Candidate phase (relationship lifecycle: Lead → Kandidaat) — model v2 axis.
export function CandidatePhasesSettings() {
  // Lead/Kandidaat are SYSTEM values (automations + the matrix depend on them):
  // no add, no delete — rename/colour/flags only (Danny 23-07; BE guard ticketed;
  // the edit pencil itself must stay enabled, audit finding fixed 04-08).
  return <CandidateLookupSection typeKey="phases" slug="phases" locked />
}

// Candidate deployability ("status": Beschikbaar/Geplaatst/… ) — model v2 axis.
export function CandidateStatusesSettings() {
  return <CandidateLookupSection typeKey="statuses" slug="statuses" />
}

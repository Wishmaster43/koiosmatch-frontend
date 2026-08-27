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
import { Trash2, Pencil } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import { DragList, ColorSwatch, ColorBadge, DefaultToggle } from '../components/SettingsControls'
import IconPickerControl from './IconPickerControl'
import { GENERIC_LOOKUP_ICON_NAMES, resolveGenericLookupIcon } from './lookupIcons'
import CandidateLookupItemModal from './CandidateLookupItemModal'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import Button from '@/components/ui/Button'
import { Caption } from '@/components/ui/typography'

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
  const isContractFormBlock = slug === 'candidate-types'
  // Default flag is settable on both funnel stages and phases (04-08: phases list stays
  // add/remove-locked, but the default toggle becomes interactive on it).
  const supportsDefault = isFunnelBlock || isPhaseBlock
  // Icon support (batch 12, P22-30): statuses + contract forms only, for now.
  const supportsIcon = isStatusBlock || isContractFormBlock

  // eslint-disable-next-line no-restricted-syntax -- DATA: default swatch colour pre-filled for a newly created lookup row, not UI chrome
  const openAdd  = ()   => setModal({ mode: 'add',  value: '', label: '', color: '#3B8FD4', icon: null, requires_appointment: false, requires_reason: false, requires_match: false, expects_return_date: false, is_match: false, is_rejected: false, is_proposal: false, is_blacklist: false, is_applicant: false, customer_not_applicable: false })
  // eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome
  const openEdit = (it) => setModal({ mode: 'edit', id: it.id, value: it.value, label: it.label, color: it.color ?? '#6B7280', icon: it.icon ?? null,
    requires_appointment: it.requires_appointment === true, requires_reason: it.requires_reason === true,
    requires_match: it.requires_match === true, expects_return_date: it.expects_return_date === true,
    is_match: it.is_match === true, is_rejected: it.is_rejected === true,
    is_proposal: it.is_proposal === true, is_blacklist: it.is_blacklist === true,
    is_applicant: it.is_applicant === true, customer_not_applicable: it.customer_not_applicable === true })

  // Persists the add/edit modal: creates or updates the lookup row, sending only the
  // per-type flag fields this lookup actually supports (the backend guards the rest).
  const save = async () => {
    if (!modal.label.trim()) return
    setBusy(true)
    // Only send the flag that exists on this lookup; the backend guards the rest.
    const flagFields = {
      ...(supportsIcon  ? { icon: modal.icon || null } : {}),
      ...(isStatusBlock ? { requires_reason: modal.requires_reason, requires_match: modal.requires_match, expects_return_date: modal.expects_return_date, is_blacklist: modal.is_blacklist } : {}),
      ...(isFunnelBlock ? { requires_appointment: modal.requires_appointment, is_match: modal.is_match, is_rejected: modal.is_rejected, is_proposal: modal.is_proposal } : {}),
      ...(isPhaseBlock  ? { is_applicant: modal.is_applicant } : {}),
      // MATCH-KLANTLOOS-1: contract forms only — a match resolved to this form
      // rejects customer/location/department/contact server-side and requires branch_id.
      ...(isContractFormBlock ? { customer_not_applicable: modal.customer_not_applicable } : {}),
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
    } catch { notifyError(t('statusList.saveFailed')) } finally { setBusy(false) }
  }

  // In-row colour change: applies optimistically, reverts + notifies on failure.
  const updateColor = async (it, color) => {
    const previous = items
    setItems(p => p.map(x => x.id === it.id ? { ...x, color } : x))
    // Revert the optimistic colour on failure — otherwise the row keeps showing an
    // unsaved colour as if it had persisted (§3: no silent state drift).
    try { await api.put(`${BASE}/${slug}/${it.id}`, { label: it.label, color }) }
    catch { setItems(previous); notifyError(t('statusList.saveFailed')) }
  }

  // In-row icon change (statuses/contract forms) — same optimistic+revert shape as updateColor.
  const updateIcon = async (it, icon) => {
    const previous = items
    setItems(p => p.map(x => x.id === it.id ? { ...x, icon } : x))
    try { await api.put(`${BASE}/${slug}/${it.id}`, { label: it.label, color: it.color, icon }) }
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

  // Confirms then deletes a lookup row; an in-use item is never sent (guarded above by
  // the caller's disabled state too) and a 409 from the backend flags it in_use instead
  // of silently failing.
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

  // Drag-reorder: applies the new order optimistically, reverts + notifies on failure.
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
          {/* KANDIDATEN-13 (Danny): everything hangs off these two phases (automation,
              KPIs) — the list stays locked (no add/remove/reorder) and only the colour
              is tenant-adjustable. Shown here so the reason is visible without opening
              the edit modal. */}
          {isPhaseBlock && <Caption as="p" style={{ marginTop: 4 }}>{t('lookups.phaseLockedHint')}</Caption>}
        </div>
        {/* HUISSTIJL-1: the ONE "+ add" affordance, app-wide (§3A). */}
        {!locked && <DrawerAddButton onClick={openAdd} label={t('lookups.add')} />}
      </div>

      <DragList
        items={items}
        onReorder={reorder}
        // KANDIDATEN-13: add is already blocked so this set can never grow past its two
        // seeded phases — reordering two fixed rows carries no meaning, so hide the
        // drag handle and the keyboard move buttons entirely.
        // One lock concept (verify round 22-08): reorder follows `locked`, like add/delete.
        sortable={!locked}
        renderItem={(item) => (
          <>
            {/* eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome */}
            <ColorSwatch color={item.color ?? '#6B7280'} onChange={c => updateColor(item, c)} />
            {/* Icon picker IN the row, next to the colour (mirrors StatusListEditor,
                batch 12 P22-30) — statuses + contract forms only. */}
            {supportsIcon && (
              <IconPickerControl icons={GENERIC_LOOKUP_ICON_NAMES} resolve={resolveGenericLookupIcon} value={item.icon}
                // eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome
                color={item.color ?? '#6B7280'} label={item.label} onPick={icon => updateIcon(item, icon)} />
            )}
            {/* eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome */}
            <ColorBadge label={item.label} color={item.color ?? '#6B7280'} />
            {/* eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- <code> renders the lookup's raw stored value/slug (an ID field, §3A), not a Caption/label copy */}
            <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.value}</code>
            {/* Reason badge: marks a status that requires a reason when set (e.g. Inactive). */}
            {isStatusBlock && item.requires_reason && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-warning-text)',
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
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-on-success-bg)',
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
            <Button variant="secondary" iconOnly onClick={() => openEdit(item)} title={t('lookups.edit')} aria-label={t('lookups.edit')}>
              <Pencil size={11} />
            </Button>
            {/* Accessible name stays the plain "delete" verb even while disabled —
                title carries the in-use reason as a tooltip, aria-label never goes
                undefined (VAC-CLEAR-style regression: name must survive both states). */}
            {!locked && (
              <Button variant="dangerSoft" iconOnly onClick={() => remove(item)} disabled={deleting === item.id || inUse(item)}
                title={inUse(item) ? t('lookups.inUse') : undefined} aria-label={t('common:delete')}>
                {deleting === item.id ? <Spinner size={11} /> : <Trash2 size={11} />}
              </Button>
            )}
          </>
        )}
      />
      {items.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>{t('lookups.empty')}</p>}

      {/* Add/edit modal — extracted to its own file once this block crossed the
          ~400-line split trigger (batch 12, P22-30). Thin container passes state
          + block-kind flags down; the modal itself owns no persistence. */}
      {modal && (
        <CandidateLookupItemModal
          modal={modal} setModal={setModal} onClose={() => setModal(null)} onSave={save} busy={busy} locked={locked}
          isStatusBlock={isStatusBlock} isFunnelBlock={isFunnelBlock} isPhaseBlock={isPhaseBlock} isContractFormBlock={isContractFormBlock} supportsIcon={supportsIcon}
        />
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
  const [error,   setError]   = useState(false)

  // Loads this tab's slice from the combined lookups endpoint whenever the type changes.
  // An alive guard stops a stale response from a previous typeKey overwriting a newer one.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(false)
    api.get(BASE)
      .then(r => { if (!alive) return; const d = unwrap(r) ?? {}; setItems(d[typeKey] ?? []) })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [typeKey])

  return (
    <div style={{ maxWidth: 640 }}>
      {loading
        ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
        : error
          ? <p style={{ fontSize: 13, color: 'var(--color-danger-text)' }}>{t('statusList.loadError')}</p>
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

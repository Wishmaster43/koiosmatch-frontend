/**
 * CandidateLookupItemModal — the add/edit modal for a single candidate-lookup
 * row (contract forms / funnel stages / phases / statuses). Extracted from
 * CandidateLookupsSettings (batch 12, P22-30) once the parent crossed the
 * ~400-line split trigger; this file only renders the modal body — all state
 * and persistence stay in the parent (`modal`/`setModal`/`save`/`busy`).
 */
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { ColorSwatch } from '../components/SettingsControls'
import { Toggle } from '../components/SettingsKit'
import IconPickerControl from './IconPickerControl'
import { GENERIC_LOOKUP_ICON_NAMES, resolveGenericLookupIcon } from './lookupIcons'
import Button from '@/components/ui/Button'

// "Niet actief" → "niet_actief" — a stable English-ish slug suggestion (mirrors
// the parent's slugify; duplicated here to avoid a cross-file import cycle).
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

// Props: modal state + setter, save/close callbacks, block-kind flags and the
// `locked` (system list) flag that disables the label field in edit mode.
export default function CandidateLookupItemModal({
  modal, setModal, onClose, onSave, busy, locked,
  isStatusBlock, isFunnelBlock, isPhaseBlock, isContractFormBlock, supportsIcon,
}) {
  const { t } = useTranslation('settings')

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--surface)', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{modal.mode === 'add' ? t('lookups.add') : t('lookups.edit')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('lookups.labelField')}</div>
          {/* Phase label lock (P21, mirrors the BE 422 in CandidateLookupController::update()):
              a locked lookup's label is structural (automations/matrix read it by slug, but
              tenants renaming the seeded Lead/Candidate label breaks recognisability across
              screens) — so on a locked list, only the label input disables in edit mode.
              Colour/is_applicant/is_default stay editable (04-08 audit re-enabled the pencil
              deliberately) — this is a narrower lock, not a re-disable of the whole modal. */}
          <input value={modal.label} autoFocus={!(locked && modal.mode === 'edit')}
            disabled={locked && modal.mode === 'edit'}
            onChange={e => setModal(m => ({ ...m, label: e.target.value }))}
            placeholder={t('lookups.labelPlaceholder')}
            style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                     background: (locked && modal.mode === 'edit') ? 'var(--hover-bg)' : 'var(--surface)',
                     color: (locked && modal.mode === 'edit') ? 'var(--text-muted)' : 'var(--text)' }} />
          {locked && modal.mode === 'edit' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('lookups.labelLocked')}</div>
          )}
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

        {/* Icon picker — statuses + contract forms only (batch 12, P22-30). Same
            curated generic set / resolver as StatusListEditor, so the picked icon
            reads identically wherever it later surfaces (row chip, avatar, …). */}
        {supportsIcon && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('lookups.iconField')}</div>
            {/* eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome */}
            <IconPickerControl icons={GENERIC_LOOKUP_ICON_NAMES} resolve={resolveGenericLookupIcon} value={modal.icon}
              color={modal.color ?? '#6B7280'} label={modal.label || t('lookups.iconField')}
              onPick={icon => setModal(m => ({ ...m, icon }))} />
          </div>
        )}

        {/* Customer-not-applicable toggle — contract forms only (MATCH-KLANTLOOS-1):
            a match resolved to this Contractvorm has no customer/location/department/
            contact — the server rejects those fields and requires a branch instead. */}
        {isContractFormBlock && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Toggle checked={modal.customer_not_applicable} onChange={v => setModal(m => ({ ...m, customer_not_applicable: v }))} />
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('lookups.customerNotApplicable')}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('lookups.customerNotApplicableHint')}</div>
          </div>
        )}

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
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <button onClick={onSave} disabled={busy || !modal.label.trim()}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'var(--color-on-accent)', cursor: 'pointer', opacity: modal.label.trim() ? 1 : 0.4 }}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </>
  )
}

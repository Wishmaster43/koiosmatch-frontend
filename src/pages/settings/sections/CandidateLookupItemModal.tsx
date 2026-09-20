/**
 * CandidateLookupItemModal — the add/edit modal for a single candidate-lookup
 * row (contract forms / funnel stages / phases / statuses). Extracted from
 * CandidateLookupsSettings (batch 12, P22-30) once the parent crossed the
 * ~400-line split trigger; this file only renders the modal body — all state
 * and persistence stay in the parent (`modal`/`setModal`/`save`/`busy`).
 *
 * SETTINGS-INCON-B2 (Danny 13-09, "AUDIT op alle pop-ups!!"): migrated off a
 * hand-rolled fixed/centered div onto the shared FloatingPanel — draggable
 * header, resizable, remembered position; it arms its own focus trap now.
 */
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { ColorSwatch } from '../components/SettingsControls'
import { Toggle } from '../components/SettingsKit'
import IconPickerControl from './IconPickerControl'
import { GENERIC_LOOKUP_ICON_NAMES, resolveGenericLookupIcon } from './lookupIcons'
import { type CandidateLookupFlags, slugify } from './candidateLookupFlags'
import FloatingPanel from '@/components/ui/FloatingPanel'
import ModalFooter from '@/components/ui/ModalFooter'
import { Caption, BodyText, SectionTitle } from '@/components/ui/typography'

// The backend's `value` rule on every candidate lookup (CandidateGenderController and its siblings: max:50).
const LOOKUP_VALUE_MAX = 50

// The full add/edit modal state — one shared shape across every candidate-lookup
// block (statuses/funnel-types/phases/candidate-types); each block only reads/writes
// the flags relevant to it (isStatusBlock/isFunnelBlock/… below), the rest ride along.
export interface LookupModalState extends CandidateLookupFlags {
  mode: 'add' | 'edit'
  id?: string | number
  value: string
  label: string
  color: string
  icon: string | null
}

// Props for one flag toggle row: the label/hint translation keys, checked state and its setter.
interface FlagRowProps {
  labelKey: string
  hintKey: string
  checked?: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  isDanger?: boolean
}

// FlagRow renders a consistent flag toggle row (Toggle + label + Caption) for all flag types.
function FlagRow({ labelKey, hintKey, checked, onChange, disabled, isDanger }: FlagRowProps) {
  const { t } = useTranslation('settings')
  const LabelComponent = isDanger ? SectionTitle : BodyText
  const labelColor = isDanger ? { color: 'var(--color-danger-text)' } : {}

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Toggle checked={!!checked} onChange={onChange} disabled={disabled} ariaLabel={t(labelKey)} />
        <LabelComponent as="span" style={labelColor}>{t(labelKey)}</LabelComponent>
      </div>
      <Caption as="div" style={{ marginTop: 4 }}>{t(hintKey)}</Caption>
    </div>
  )
}

// Props: modal state + setter, save/close callbacks, block-kind flags.
// The old `locked` (system-list read-only label) flag was retired here (Danny
// 13-09, F2): the phases block's pencil is now fully disabled by StatusListRow's
// own readOnly gate, so this modal never opens on a locked list any more — the
// label-lock branch and the is_applicant disabled-switch it drove were dead code.
interface CandidateLookupItemModalProps {
  modal: LookupModalState
  setModal: Dispatch<SetStateAction<LookupModalState | null>>
  onClose: () => void
  onSave: () => void
  busy: boolean
  isStatusBlock: boolean
  isFunnelBlock: boolean
  isPhaseBlock: boolean
  isContractFormBlock: boolean
  supportsIcon: boolean
}

export default function CandidateLookupItemModal({
  modal, setModal, onClose, onSave, busy,
  isStatusBlock, isFunnelBlock, isPhaseBlock, isContractFormBlock, supportsIcon,
}: CandidateLookupItemModalProps) {
  const { t } = useTranslation('settings')
  const title = modal.mode === 'add' ? t('lookups.add') : t('lookups.edit')

  return (
    <FloatingPanel open onClose={onClose} title={title} persistKey="candidate-lookup-item" resizable
      scrollBody={false} width={400}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 0' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('lookups.labelField')}</div>
          <input value={modal.label} autoFocus
            onChange={e => setModal(m => m && ({ ...m, label: e.target.value }))}
            placeholder={t('lookups.labelPlaceholder')}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- native form <input> text size/colour; BodyText renders a span/div and cannot replace an editable form control
            style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                     background: 'var(--surface)', color: 'var(--text)' }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('lookups.valueField')}</div>
          {/* LOOKUP-VALUE-MAX-1 (Danny 19-09, 422 "Het veld value mag niet meer dan 50 tekens bevatten"
              on the gender lookup): the backend caps every lookup value at 50 characters, so the
              input stops there and the hint says so — the server's own message never has to. */}
          <input value={modal.value} maxLength={LOOKUP_VALUE_MAX}
            disabled={modal.mode === 'edit'}
            onChange={e => setModal(m => m && ({ ...m, value: e.target.value.slice(0, LOOKUP_VALUE_MAX) }))}
            placeholder={modal.label ? slugify(modal.label) : 'slug'}
            style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, fontFamily: 'monospace',
                     border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                     background: modal.mode === 'edit' ? 'var(--hover-bg)' : 'var(--surface)', color: modal.mode === 'edit' ? 'var(--text-muted)' : 'var(--text)' }} />
          <Caption as="div" style={{ marginTop: 4 }}>
            {modal.mode === 'edit' ? t('lookups.valueImmutable') : t('lookups.valueHint', { max: LOOKUP_VALUE_MAX })}
          </Caption>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('lookups.colorField')}</div>
          <ColorSwatch color={modal.color} onChange={(c: string) => setModal(m => m && ({ ...m, color: c }))} />
        </div>

        {/* Icon picker — statuses + contract forms only (batch 12, P22-30). Same
            curated generic set / resolver as StatusListEditor, so the picked icon
            reads identically wherever it later surfaces (row chip, avatar, …). */}
        {supportsIcon && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('lookups.iconField')}</div>
            {/* eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a lookup row without one stored yet, not UI chrome */}
            <IconPickerControl color={modal.color ?? '#6B7280'}
              icons={GENERIC_LOOKUP_ICON_NAMES} resolve={resolveGenericLookupIcon} value={modal.icon}
              label={modal.label || t('lookups.iconField')}
              onPick={(icon: string) => setModal(m => m && ({ ...m, icon }))} />
          </div>
        )}

        {/* Customer-not-applicable toggle — contract forms only (MATCH-KLANTLOOS-1):
            a match resolved to this Contractvorm has no customer/location/department/
            contact — the server rejects those fields and requires a branch instead. */}
        {isContractFormBlock && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Toggle checked={!!modal.customer_not_applicable} onChange={(v: boolean) => setModal(m => m && ({ ...m, customer_not_applicable: v }))} />
              <BodyText as="span">{t('lookups.customerNotApplicable')}</BodyText>
            </div>
            <Caption as="div" style={{ marginTop: 4 }}>{t('lookups.customerNotApplicableHint')}</Caption>
          </div>
        )}

        {/* Contract-lines toggle — contract forms only (SAC-10): a match resolved to
            this Contractvorm shows the contract-lines block (ContractLinesSection reads
            it via useMatchForm). Was persisted/returned by the backend but had no FE
            control, so every tenant-created form was stuck false. */}
        {isContractFormBlock && (
          <FlagRow labelKey="lookups.hasContractLines" hintKey="lookups.hasContractLinesHint"
            checked={!!modal.has_contract_lines} onChange={(v: boolean) => setModal(m => m && ({ ...m, has_contract_lines: v }))} />
        )}

        {/* Applicant toggle — phases only. Not backend-singleton (verified against
            CandidateLookupController::update(), koiosmatch-api: ApplicationStage::
            SINGLETON_FLAGS does not include is_applicant for the phases config), so a
            plain toggle — multiple phases may carry it, ApplicantStatusTransition just
            reads the first active match. This modal no longer opens on the phases
            block at all (its pencil is disabled by readOnly, F2), so the toggle stays
            simply interactive here — the old "locked" disabled-state was dead code. */}
        {isPhaseBlock && (
          <FlagRow labelKey="lookups.phaseApplicant" hintKey="lookups.phaseApplicantHint"
            checked={modal.is_applicant} onChange={(v: boolean) => setModal(m => m && ({ ...m, is_applicant: v }))} />
        )}

        {/* Reason-required toggle — statuses only (e.g. Inactive needs a reason). */}
        {isStatusBlock && (
          <FlagRow labelKey="lookups.requiresReason" hintKey="lookups.requiresReasonHint"
            checked={modal.requires_reason} onChange={(v: boolean) => setModal(m => m && ({ ...m, requires_reason: v }))} />
        )}

        {/* Match-required toggle — statuses only (e.g. Placed needs a linked Match). */}
        {isStatusBlock && (
          <FlagRow labelKey="lookups.requiresMatch" hintKey="lookups.requiresMatchHint"
            checked={modal.requires_match} onChange={(v: boolean) => setModal(m => m && ({ ...m, requires_match: v }))} />
        )}

        {/* Return-date toggle — statuses only (e.g. Unavailable asks "available again on"). */}
        {isStatusBlock && (
          <FlagRow labelKey="lookups.expectsReturnDate" hintKey="lookups.expectsReturnDateHint"
            checked={modal.expects_return_date} onChange={(v: boolean) => setModal(m => m && ({ ...m, expects_return_date: v }))} />
        )}

        {/* Blacklist toggle — statuses only (§3B: Blacklist is a deployability value, danger-styled). */}
        {isStatusBlock && (
          <FlagRow labelKey="lookups.isBlacklist" hintKey="lookups.isBlacklistHint"
            checked={modal.is_blacklist} onChange={(v: boolean) => setModal(m => m && ({ ...m, is_blacklist: v }))} isDanger />
        )}

        {/* Leave status toggle — statuses only (B-38: candidate status flags round-trip). */}
        {isStatusBlock && (
          <FlagRow labelKey="lookups.isLeave" hintKey="lookups.isLeaveHint"
            checked={modal.is_leave} onChange={(v: boolean) => setModal(m => m && ({ ...m, is_leave: v }))} />
        )}

        {/* Unavailable status toggle — statuses only (B-38: candidate status flags round-trip). */}
        {isStatusBlock && (
          <FlagRow labelKey="lookups.isUnavailable" hintKey="lookups.isUnavailableHint"
            checked={modal.is_unavailable} onChange={(v: boolean) => setModal(m => m && ({ ...m, is_unavailable: v }))} />
        )}

        {/* Appointment toggle — funnel stages only; flags the intake stage. */}
        {isFunnelBlock && (
          <FlagRow labelKey="lookups.requiresAppointment" hintKey="lookups.requiresAppointmentHint"
            checked={modal.requires_appointment} onChange={(v: boolean) => setModal(m => m && ({ ...m, requires_appointment: v }))} />
        )}

        {/* Match toggle — funnel stages only; this stage turns the application into a Match (matched bucket). */}
        {isFunnelBlock && (
          <FlagRow labelKey="lookups.isMatch" hintKey="lookups.isMatchHint"
            checked={modal.is_match} onChange={(v: boolean) => setModal(m => m && ({ ...m, is_match: v }))} />
        )}

        {/* Rejected toggle — funnel stages only; this stage is the rejected bucket. */}
        {isFunnelBlock && (
          <FlagRow labelKey="lookups.isRejected" hintKey="lookups.isRejectedHint"
            checked={modal.is_rejected} onChange={(v: boolean) => setModal(m => m && ({ ...m, is_rejected: v }))} />
        )}

        {/* Proposal toggle — funnel stages only; this stage represents the "proposed to customer" step. */}
        {isFunnelBlock && (
          <FlagRow labelKey="lookups.isProposal" hintKey="lookups.isProposalHint"
            checked={modal.is_proposal} onChange={(v: boolean) => setModal(m => m && ({ ...m, is_proposal: v }))} />
        )}

      </div>
      {/* Shared modal footer row (§4) — pinned outside the scrolling body. */}
      <ModalFooter onCancel={onClose} onSubmit={onSave} busy={busy}
        disabled={busy || !modal.label.trim()}
        cancelLabel={t('common.cancel')} submitLabel={busy ? t('common.saving') : t('common.save')} />
    </FloatingPanel>
  )
}

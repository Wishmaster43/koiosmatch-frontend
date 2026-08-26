/**
 * CandidateStatusModals — the two overlays the drawer raises on a deployability change:
 * (1) "Placed" needs a linked Match → pick an existing one or create against a vacancy
 * (G-2); (2) a status that requires a reason and/or an "available again" date. Kept out
 * of CandidateDrawer so the container stays a thin composition (§3 / A-5). Presentational:
 * the parent owns the state + the two confirm handlers.
 *
 * Each overlay is its OWN component (MatchPickModal / StatusReasonModal), mounted only
 * while open — useFocusTrap (item 20) needs a fresh mount to attach correctly; a single
 * always-mounted component with two conditional <div>s never re-runs the trap effect
 * when the overlay first appears.
 */
import { useState, useEffect } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import api, { unwrapList } from '@/lib/api'
import FloatingPanel from '@/components/ui/FloatingPanel'
// G34: the house searchable dropdown replaces every native <select> in this
// file (candidate/customer/status relational pickers, never a raw <select>).
import CreatableSelect from '@/components/ui/CreatableSelect'
import LookupIcon from '@/components/ui/LookupIcon'
import { Z } from '@/lib/zIndexScale'
import { Caption, GroupLabel } from '@/components/ui/typography'
import type { VacancyOption } from '../hooks/useVacancyOptions'
import Button from '@/components/ui/Button'

// Mirrors the backend's `status_reason` column limit (CandidateProfileRequest: string|max:255).
const STATUS_REASON_MAX = 255

interface MatchRow { id?: string | number; vacancyTitle?: string; client?: string }
// BLACKLIST-ICON-1: the blacklist-reason picker carries the full lookup object
// (value/label/icon) — mirrors SelectMenu's S-icon-1 shape now that CreatableSelect
// supports it, instead of the previous bare `string[]` of names.
interface BlacklistReasonOption { value: string; label: string; icon?: ReactNode }
// isBlacklist → the reason is the lookup-backed blacklist_reason (dropdown from
// /candidate-blacklist-reasons; BE validates Rule::exists), never free text.
export interface StatusModalState { target: string; reason: string; date: string; needReason: boolean; needDate: boolean; isBlacklist?: boolean }

interface Props {
  // "Placed" → link an existing match or create one against a vacancy.
  matchPrompt: boolean
  onCloseMatch: () => void
  matches: MatchRow[]
  matchChoice: string | null
  setMatchChoice: Dispatch<SetStateAction<string | null>>
  newMatchVacancyId: string
  setNewMatchVacancyId: Dispatch<SetStateAction<string>>
  vacancyOptions: VacancyOption[]
  creatingMatch: boolean
  onConfirmMatch: () => void
  // Status reason / return-date prompt.
  statusModal: StatusModalState | null
  setStatusModal: Dispatch<SetStateAction<StatusModalState | null>>
  onConfirmStatus: () => void
}

// "Geplaatst" → pick one of the candidate's matches to link; if none, prompt to create one first.
function MatchPickModal({
  onCloseMatch, matches, matchChoice, setMatchChoice, newMatchVacancyId, setNewMatchVacancyId,
  vacancyOptions, creatingMatch, onConfirmMatch, t,
}: Pick<Props, 'onCloseMatch' | 'matches' | 'matchChoice' | 'setMatchChoice' | 'newMatchVacancyId' | 'setNewMatchVacancyId' | 'vacancyOptions' | 'creatingMatch' | 'onConfirmMatch'> & { t: TFunction }) {
  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // SE-resize, remembered position; keeps its above-the-drawer layer via Z.confirm.
    <FloatingPanel open onClose={onCloseMatch} title={t('drawer.placedPickMatch')} ariaLabel={t('drawer.placedPickMatch')}
      persistKey="candidate-match-pick" width={400} zIndex={Z.confirm} bodyStyle={{ padding: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{t('drawer.placedPickMatchBody')}</div>

        {/* Pick one of the candidate's existing matches (searchable dropdown). */}
        {matches.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <CreatableSelect value={matchChoice} allowCreate={false} clearable
              onChange={v => { setMatchChoice(v || null); if (v) setNewMatchVacancyId('') }}
              placeholder={t('drawer.placedPickPlaceholder')}
              options={matches.map((m, i) => ({ value: String(m.id ?? i), label: [m.vacancyTitle || '—', m.client].filter(Boolean).join(' · ') }))}
              style={{ padding: '8px 11px', fontSize: 13 }} />
          </div>
        )}

        {/* Or create a new match by picking a vacancy (G-2 direct match → POST /matches). */}
        <GroupLabel style={{ letterSpacing: '0.04em', margin: '2px 0 6px' }}>{t('drawer.placedOrNew')}</GroupLabel>
        <div style={{ marginBottom: 16 }}>
          <CreatableSelect value={newMatchVacancyId || null} allowCreate={false} clearable
            onChange={v => { setNewMatchVacancyId(v); if (v) setMatchChoice(null) }}
            placeholder={t('drawer.placedNewPlaceholder')}
            options={vacancyOptions.map(v => ({ value: String(v.value), label: [v.label || '—', v.client].filter(Boolean).join(' · ') }))}
            style={{ padding: '8px 11px', fontSize: 13 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onCloseMatch}>{t('common:cancel')}</Button>
          <Button variant="primary" size="sm" disabled={(!matchChoice && !newMatchVacancyId) || creatingMatch} onClick={onConfirmMatch}>{t('drawer.placedConfirm')}</Button>
        </div>
    </FloatingPanel>
  )
}

// Status change asking a reason and/or a "available again" date (status flags).
function StatusReasonModal({
  statusModal, setStatusModal, onConfirmStatus, blReasons, t,
}: Pick<Props, 'setStatusModal' | 'onConfirmStatus'> & { statusModal: StatusModalState; blReasons: BlacklistReasonOption[]; t: TFunction }) {
  const close = () => setStatusModal(null)
  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel — draggable header,
    // SE-resize, remembered position; keeps its above-the-drawer layer via Z.confirm.
    <FloatingPanel open onClose={close} title={t('drawer.statusReasonTitle')} ariaLabel={t('drawer.statusReasonTitle')}
      persistKey="candidate-status-reason" width={400} zIndex={Z.confirm} bodyStyle={{ padding: 20 }}>
        {statusModal.needReason && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
              {statusModal.isBlacklist ? t('drawer.blacklistReasonLabel') : t('drawer.reasonLabel')}
            </div>
            {statusModal.isBlacklist ? (
              // Blacklist: lookup-backed searchable dropdown (BE validates exists on blacklist_reasons.name).
              <CreatableSelect value={statusModal.reason || null} allowCreate={false} clearable
                onChange={v => setStatusModal(m => m && ({ ...m, reason: v }))}
                placeholder={t('drawer.blacklistReasonPick')} options={blReasons}
                style={{ padding: '8px 10px', fontSize: 12 }} />
            ) : (
              // Plain textarea, not RichTextEditor — the backend validates status_reason
              // as `string|max:255` and folds it into the status-change NOTE body via a
              // ' · '-joined plain-text template (StatusChangeNoteWriter::composeStatusBody);
              // it is never parsed/rendered as HTML, so rich markup would just be visible
              // tags in the note. Same documented deviation as DetachReasonModal (short,
              // structured "why" prompts stay plain). maxLength mirrors the BE limit.
              <textarea value={statusModal.reason} maxLength={STATUS_REASON_MAX}
                onChange={e => setStatusModal(m => m && ({ ...m, reason: e.target.value }))} rows={3}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, outline: 'none', resize: 'vertical' }} />
            )}
          </div>
        )}
        {statusModal.needDate && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{t('drawer.returnDateLabel')}</div>
            <input type="date" value={statusModal.date} onChange={e => setStatusModal(m => m && ({ ...m, date: e.target.value }))}
              style={{ padding: '7px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, outline: 'none' }} />
            {/* Return date is honestly optional — empty means "nog onbekend" (Danny 2026-07-06). */}
            <Caption as="div" style={{ marginTop: 4, fontStyle: 'italic' }}>{t('drawer.returnDateUnknownHint')}</Caption>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={close}>{t('common:cancel')}</Button>
          <Button variant="primary" size="sm" onClick={onConfirmStatus} disabled={statusModal.needReason && !statusModal.reason.trim()}>{t('common:save')}</Button>
        </div>
    </FloatingPanel>
  )
}

// Composes the two deployability-change overlays (match-pick, status-reason) described in the file's top doc; purely presentational, the parent owns state and the confirm handlers.
export default function CandidateStatusModals({
  matchPrompt, onCloseMatch, matches, matchChoice, setMatchChoice, newMatchVacancyId, setNewMatchVacancyId,
  vacancyOptions, creatingMatch, onConfirmMatch, statusModal, setStatusModal, onConfirmStatus,
}: Props) {
  const { t } = useTranslation('candidates')

  // Blacklist reasons (tenant lookup) — loaded once when a blacklist prompt opens; the
  // backend validates against blacklist_reasons.name, so free text would 422.
  const [blReasons, setBlReasons] = useState<BlacklistReasonOption[]>([])
  // Loads the blacklist-reason tenant lookup once, the first time a blacklist prompt opens, since the backend validates against these names rather than accepting free text.
  useEffect(() => {
    if (!statusModal?.isBlacklist || blReasons.length) return
    api.get('/candidate-blacklist-reasons')
      .then(r => setBlReasons(
        ((unwrapList(r).rows) as Array<{ name?: string; icon?: string }>)
          .filter(x => x.name)
          // BLACKLIST-ICON-1: full lookup object, mirroring S-icon-1 — the value the
          // BE validates against stays `name` (unchanged contract), the icon just
          // rides alongside it for display, resolved via the shared LookupIcon.
          .map(x => ({ value: String(x.name), label: String(x.name), icon: x.icon ? <LookupIcon icon={x.icon} size={12} /> : undefined })),
      ))
      .catch(() => setBlReasons([]))
  }, [statusModal?.isBlacklist, blReasons.length])

  return (
    <>
      {matchPrompt && (
        <MatchPickModal onCloseMatch={onCloseMatch} matches={matches} matchChoice={matchChoice} setMatchChoice={setMatchChoice}
          newMatchVacancyId={newMatchVacancyId} setNewMatchVacancyId={setNewMatchVacancyId}
          vacancyOptions={vacancyOptions} creatingMatch={creatingMatch} onConfirmMatch={onConfirmMatch} t={t} />
      )}
      {statusModal && (
        <StatusReasonModal statusModal={statusModal} setStatusModal={setStatusModal} onConfirmStatus={onConfirmStatus} blReasons={blReasons} t={t} />
      )}
    </>
  )
}

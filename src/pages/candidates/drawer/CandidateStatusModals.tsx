/**
 * CandidateStatusModals — the two overlays the drawer raises on a deployability change:
 * (1) "Placed" needs a linked Match → pick an existing one or create against a vacancy
 * (G-2); (2) a status that requires a reason and/or an "available again" date. Kept out
 * of CandidateDrawer so the container stays a thin composition (§3 / A-5). Presentational:
 * the parent owns the state + the two confirm handlers.
 */
import { useState, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import type { VacancyOption } from '../hooks/useVacancyOptions'

interface MatchRow { id?: string | number; vacancyTitle?: string; client?: string }
// isBlacklist → the reason is the lookup-backed blacklist_reason (dropdown from
// /blacklist-reasons; BE validates Rule::exists), never free text.
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

export default function CandidateStatusModals({
  matchPrompt, onCloseMatch, matches, matchChoice, setMatchChoice, newMatchVacancyId, setNewMatchVacancyId,
  vacancyOptions, creatingMatch, onConfirmMatch, statusModal, setStatusModal, onConfirmStatus,
}: Props) {
  const { t } = useTranslation('candidates')

  // Blacklist reasons (tenant lookup) — loaded once when a blacklist prompt opens; the
  // backend validates against blacklist_reasons.name, so free text would 422.
  const [blReasons, setBlReasons] = useState<string[]>([])
  useEffect(() => {
    if (!statusModal?.isBlacklist || blReasons.length) return
    api.get('/blacklist-reasons')
      .then(r => setBlReasons(((r.data?.data ?? r.data ?? []) as Array<{ name?: string }>).map(x => String(x.name ?? '')).filter(Boolean)))
      .catch(() => setBlReasons([]))
  }, [statusModal?.isBlacklist, blReasons.length])

  return (
    <>
      {/* "Geplaatst" → pick one of the candidate's matches to link; if none, prompt to create one first. */}
      {matchPrompt && (
        <div onClick={onCloseMatch} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('drawer.placedPickMatch')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{t('drawer.placedPickMatchBody')}</div>

            {/* Pick one of the candidate's existing matches (dropdown). */}
            {matches.length > 0 && (
              <select value={matchChoice ?? ''} onChange={e => { setMatchChoice(e.target.value || null); if (e.target.value) setNewMatchVacancyId('') }}
                style={{ width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none', marginBottom: 12 }}>
                <option value="">{t('drawer.placedPickPlaceholder')}</option>
                {matches.map((m, i) => {
                  const mid = String(m.id ?? i)
                  return <option key={mid} value={mid}>{[m.vacancyTitle || '—', m.client].filter(Boolean).join(' · ')}</option>
                })}
              </select>
            )}

            {/* Or create a new match by picking a vacancy (G-2 direct match → POST /matches). */}
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '2px 0 6px' }}>{t('drawer.placedOrNew')}</div>
            <select value={newMatchVacancyId} onChange={e => { setNewMatchVacancyId(e.target.value); if (e.target.value) setMatchChoice(null) }}
              aria-label={t('drawer.placedNewPlaceholder')}
              style={{ width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none', marginBottom: 16 }}>
              <option value="">{t('drawer.placedNewPlaceholder')}</option>
              {vacancyOptions.map(v => (
                <option key={String(v.value)} value={String(v.value)}>{[v.label || '—', v.client].filter(Boolean).join(' · ')}</option>
              ))}
            </select>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onCloseMatch} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 7, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>{t('common:cancel')}</button>
              <button disabled={(!matchChoice && !newMatchVacancyId) || creatingMatch} onClick={onConfirmMatch}
                style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', opacity: ((matchChoice || newMatchVacancyId) && !creatingMatch) ? 1 : 0.5 }}>{t('drawer.placedConfirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Status change asking a reason and/or a "available again" date (status flags). */}
      {statusModal && (
        <div onClick={() => setStatusModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{t('drawer.statusReasonTitle')}</div>
            {statusModal.needReason && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
                  {statusModal.isBlacklist ? t('drawer.blacklistReasonLabel') : t('drawer.reasonLabel')}
                </div>
                {statusModal.isBlacklist ? (
                  // Blacklist: lookup-backed dropdown (BE validates exists on blacklist_reasons.name).
                  <select value={statusModal.reason} onChange={e => setStatusModal(m => m && ({ ...m, reason: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, outline: 'none', background: 'var(--surface)' }}>
                    <option value="">{t('drawer.blacklistReasonPick')}</option>
                    {blReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <textarea value={statusModal.reason} onChange={e => setStatusModal(m => m && ({ ...m, reason: e.target.value }))} rows={3}
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
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{t('drawer.returnDateUnknownHint')}</div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setStatusModal(null)} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 7, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>{t('common:cancel')}</button>
              <button onClick={onConfirmStatus} disabled={statusModal.needReason && !statusModal.reason.trim()}
                style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', opacity: (statusModal.needReason && !statusModal.reason.trim()) ? 0.5 : 1 }}>{t('common:save')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

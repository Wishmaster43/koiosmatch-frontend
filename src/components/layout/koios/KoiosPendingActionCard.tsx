/**
 * KoiosPendingActionCard — the confirmation card for a proposed Koios write
 * (KOIOS-AGENT-PLAN §6, dormant until the backend attaches `pending_action` to
 * a chat reply — feature-detected by the caller, KoiosPanel). Entity chip
 * (+ owner when the preview carries one) · preview rows (old → new / payload
 * lines) · the shared ActionRuleBanner for the matrix warning · Bevestigen/
 * Annuleren, with a second confirm step for destructive actions · a subtle
 * expiry countdown that auto-expires the card. Confirm/cancel POST to the
 * pending-action endpoints (koiosApi); an expired/already-resolved action
 * (404/410/422) renders an honest "this proposal has expired" state instead of
 * a generic error.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, AlertTriangle } from 'lucide-react'
import { ActionRuleBanner } from '@/components/actionrules'
import { confirmPendingAction, cancelPendingAction } from './koiosApi'
import { entityIconEl } from './koiosEntityIcons'
import type { KoiosPendingAction, KoiosPreviewRow } from './koiosTypes'

type CardStatus = 'proposed' | 'confirming' | 'submitting' | 'confirmed' | 'cancelled' | 'expired' | 'error'

// A pending-action REST call's error status, when the server rejects it because
// the proposal is gone/already resolved (never a generic error in that case).
const isExpiredStatus = (status?: number) => status === 404 || status === 410 || status === 422

// Best-effort: surface an "owner" preview row next to the entity chip, if present
// (KOIOS-AGENT-PLAN §7 Job 2 — "naam + eigenaar wanneer aanwezig in preview").
function findOwner(preview: KoiosPreviewRow[]): string | null {
  const row = preview.find((r) => /eigenaar|owner/i.test(r.label))
  return row ? (row.after ?? row.text ?? row.before ?? null) : null
}

// Remaining seconds until `expiresAt` (never negative).
function secondsLeft(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

// One preview row: "label · before → after" or "label: text".
function PreviewRow({ row }: { row: KoiosPreviewRow }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 12, padding: '3px 0' }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{row.label}</span>
      {row.before != null || row.after != null ? (
        <span style={{ color: 'var(--text)' }}>{row.before ?? '—'} → {row.after ?? '—'}</span>
      ) : (
        <span style={{ color: 'var(--text)' }}>{row.text}</span>
      )}
    </div>
  )
}

export default function KoiosPendingActionCard({ action }: { action: KoiosPendingAction }) {
  const { t } = useTranslation('common')
  const [status, setStatus] = useState<CardStatus>('proposed')
  const [remaining, setRemaining] = useState(() => secondsLeft(action.expires_at))

  // Tick the expiry countdown every second; auto-expire once it hits zero.
  useEffect(() => {
    if (status !== 'proposed' && status !== 'confirming') return
    const id = setInterval(() => {
      const left = secondsLeft(action.expires_at)
      setRemaining(left)
      if (left <= 0) setStatus('expired')
    }, 1000)
    return () => clearInterval(id)
  }, [status, action.expires_at])

  const confirm = () => {
    if (action.destructive && status !== 'confirming') { setStatus('confirming'); return }
    setStatus('submitting')
    confirmPendingAction(action.id)
      .then(() => setStatus('confirmed'))
      .catch((e) => setStatus(isExpiredStatus(e?.response?.status) ? 'expired' : 'error'))
  }

  // The secondary button either steps BACK out of the destructive 2nd-step
  // confirm (no API call — nothing was submitted yet) or actually cancels the
  // proposal server-side.
  const cancel = () => {
    if (status === 'confirming') { setStatus('proposed'); return }
    setStatus('submitting')
    cancelPendingAction(action.id)
      .then(() => setStatus('cancelled'))
      .catch((e) => setStatus(isExpiredStatus(e?.response?.status) ? 'expired' : 'error'))
  }

  const owner = findOwner(action.preview) ?? action.entity_ref.owner

  return (
    <div data-testid="koios-pending-action" data-status={status}
      style={{ marginTop: 8, padding: 12, borderRadius: 10, background: 'var(--surface)',
        border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{action.title}</div>

      {/* Entity chip + owner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
        <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>
          {entityIconEl(action.entity_ref.type, { size: 12 })}
        </span>
        <span style={{ fontWeight: 500, color: 'var(--text)' }}>{action.entity_ref.label}</span>
        {owner && <span style={{ color: 'var(--text-muted)' }}>· {t('koios.pendingAction.owner', { name: owner })}</span>}
      </div>

      {/* Preview / diff rows */}
      {action.preview.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
          {action.preview.map((row, i) => <PreviewRow key={i} row={row} />)}
        </div>
      )}

      {action.warning && (
        <ActionRuleBanner decision={{ effect: 'warn', popup_code: action.warning.popup_code, message: action.warning.message }} />
      )}

      {/* Terminal states */}
      {status === 'confirmed' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-success)' }}>
          <Check size={14} /> {t('koios.pendingAction.confirmed')}
        </div>
      )}
      {status === 'cancelled' && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('koios.pendingAction.cancelled')}</div>
      )}
      {status === 'expired' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-warning)' }}>
          <AlertTriangle size={14} /> {t('koios.pendingAction.expired')}
        </div>
      )}
      {status === 'error' && (
        <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('koios.pendingAction.error')}</div>
      )}

      {/* Actions — hidden once resolved (confirmed/cancelled/expired/error are terminal) */}
      {(status === 'proposed' || status === 'confirming' || status === 'submitting') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <button onClick={confirm} disabled={status === 'submitting'}
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: 'none',
              background: action.destructive && status === 'confirming' ? 'var(--color-danger)' : 'var(--color-primary)',
              color: '#fff', cursor: status === 'submitting' ? 'default' : 'pointer', opacity: status === 'submitting' ? 0.6 : 1 }}>
            {status === 'confirming' ? t('koios.pendingAction.confirmFinal') : t('koios.pendingAction.confirm')}
          </button>
          <button onClick={cancel} disabled={status === 'submitting'}
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 7,
              border: '1px solid var(--border)', background: 'none', color: 'var(--text)',
              cursor: status === 'submitting' ? 'default' : 'pointer' }}>
            {status === 'confirming' ? t('koios.pendingAction.back') : t('koios.pendingAction.cancel')}
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
            {t('koios.pendingAction.expiresIn', { seconds: remaining })}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * DeletionPreviewModal (TRASH-OVERAL-2) — the ONE shared "Definitief verwijderen"
 * dialog for every trash-enabled entity. Purely presentational: the caller wires
 * useDeletionLifecycle and passes the preview + confirm handler. Reuses the house
 * FloatingPanel shell (focus trap, Escape, draggable — same as ConfirmDialog).
 */
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import CreatableSelect from '@/components/ui/CreatableSelect'
import Button from '@/components/ui/Button'
import { Mono } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import { Z } from '@/lib/zIndexScale'
import type { DeletionPreview } from '@/types/deletion'
import Spinner from './Spinner'

export interface DeletionPreviewModalProps {
  open: boolean
  onClose: () => void
  /** Human name of the record ("Jansen B.V.") woven into the intro sentence. */
  entityLabel: string
  preview: DeletionPreview | null
  loading: boolean
  error: boolean
  /** Owner options for the optional transfer picker. */
  users: Array<{ value: string; label: string }>
  onConfirm: (transferToOwnerId?: string | null) => void
  busy: boolean
  /** A mark attempt came back 409 in_use; preview.blocking holds the refreshed list. */
  blocked: boolean
  /** Tenant grace window in days (useDeletionLifecycle.graceDays); null/absent = unknown. */
  graceDays?: number | null
}

// Purely presentational shared trash-confirm dialog (see the module doc above): renders the loading/error/blocked/confirm states from props, owning only the local transfer-picker choice and the projected erase date.
export default function DeletionPreviewModal({
  open, onClose, entityLabel, preview, loading, error, users, onConfirm, busy, blocked, graceDays = null,
}: DeletionPreviewModalProps) {
  const { t } = useTranslation('common')
  const { formatDate } = useDateFormat()
  const { formatNumber } = useNumberFormat()
  const transferLabelId = useId()
  // Locally held transfer choice; reset on every open so a previous pick never leaks.
  const [transferTo, setTransferTo] = useState('')
  // Projected erasure moment, stamped ON OPEN (not during render — purity rule):
  // marking stamps pending_erase_at at ~now, so the modal previews now + grace window.
  const [eraseDate, setEraseDate] = useState<Date | null>(null)
  // Resets the transfer choice and stamps the projected erase date on OPEN, not during render (purity rule): the grace window is computed from now at the moment the modal appears, not recomputed on every re-render.
  useEffect(() => {
    if (!open) return
    setTransferTo('')
    setEraseDate(graceDays != null ? new Date(Date.now() + graceDays * 86400000) : null)
  }, [open, graceDays])

  const blockers = preview?.blocking ?? []
  // The confirm button is honest: disabled while busy, still loading, failed, or
  // while the server says marking is impossible (initial preview or a fresh 409).
  const confirmDisabled = busy || loading || error || blocked || !preview?.can_mark
  const showBlockedNotice = !loading && !error && (blocked || (preview != null && !preview.can_mark))
  // Unknown grace window = neutral wording, never a made-up date.
  const eraseLine = eraseDate != null
    ? t('trash.eraseAround', { date: formatDate(eraseDate) })
    : t('trash.eraseAutomatic')

  return (
    // HUISSTIJL-1: Z.confirm comes from lib/zIndexScale.ts (out of scope for this batch)
    // and FloatingPanel's `zIndex` prop is typed `number` — a CSS var string cannot
    // substitute here without touching that out-of-scope contract; kept as-is.
    <FloatingPanel open={open} onClose={onClose} title={t('trash.modal.title')}
      ariaLabel={t('trash.modal.title')} persistKey="deletion-preview" zIndex={Z.confirm}
      width={440} maxWidth="min(560px, 90vw)"
      bodyStyle={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Loading state — the preview GET is in flight. */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          <Spinner size={14} />
          {t('loading')}
        </div>
      )}
      {/* Error state — never a blank panel with a dead button. */}
      {!loading && error && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--color-danger-text)' }}>{t('errorGeneric')}</div>
      )}
      {!loading && !error && (
        <>
          {/* Calm intro: the row goes to the trash, erased after the grace window. */}
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
            {t('trash.modal.intro', { entity: entityLabel })}
          </div>
          {/* Blocking relations — translated via the stable type tokens; the server's
              NL-only label is only the fallback for a token this build doesn't know. */}
          {blockers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t('trash.modal.blockedTitle')}</div>
              {blockers.map(b => (
                <div key={b.type} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: 'var(--text)' }}>
                  <span>{t(`trash.blockers.${b.type}`, { defaultValue: b.label })}</span>
                  <Mono style={{ fontWeight: 600 }}>{formatNumber(b.count)}</Mono>
                </div>
              ))}
            </div>
          )}
          {/* Honest notice whenever confirm is disabled by blockers (preview or fresh 409). */}
          {showBlockedNotice && (
            <div role="status" style={{ fontSize: 12, color: 'var(--color-danger-text)', lineHeight: 1.5 }}>
              {t('trash.modal.blockedIntro')}
            </div>
          )}
          {/* Optional ownership hand-over: searchable picker, clearable (optional field). */}
          {preview?.transferable && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span id={transferLabelId} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {t('trash.modal.transferLabel')}
              </span>
              <CreatableSelect aria-labelledby={transferLabelId} value={transferTo} options={users}
                onChange={setTransferTo} allowCreate={false} clearable
                clearLabel={t('trash.modal.transferLabel')}
                placeholder={t('trash.modal.transferPlaceholder')} menuWidth={280} />
            </div>
          )}
        </>
      )}
      {/* Footer: the projected erase moment + the two answers. */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{eraseLine}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="secondary" onClick={onClose}>
          {t('trash.modal.cancel')}
        </Button>
        <Button variant="danger" disabled={confirmDisabled}
          onClick={() => onConfirm(transferTo ? transferTo : null)}>
          {busy && <Spinner size={13} />}
          {t('trash.modal.confirm')}
        </Button>
      </div>
    </FloatingPanel>
  )
}

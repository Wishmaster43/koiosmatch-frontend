/**
 * ActionRuleDialog — modal variant of the shared preflight banner, for regular
 * (non-Koios) pages that want a blocking P-popup before a guarded action (§3A).
 * Deliberately thin: the banner above (ActionRuleBanner) is the actual content;
 * this only adds the modal chrome (overlay, focus trap, Escape-to-close) + the
 * confirm/cancel footer. `block` decisions hide the confirm button — there is
 * nothing to proceed with.
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import ActionRuleBanner from './ActionRuleBanner'
import type { ActionRuleDecision } from './actionRuleTypes'

export interface ActionRuleDialogProps {
  open: boolean
  decision: ActionRuleDecision | null | undefined
  onConfirm: () => void
  onCancel: () => void
}

export default function ActionRuleDialog({ open, decision, onConfirm, onCancel }: ActionRuleDialogProps) {
  const { t } = useTranslation('common')
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus the panel on open (a11y §6) and let Escape close it, mirroring the
  // drawer/modal convention used elsewhere in the app.
  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null
  const canConfirm = decision?.effect !== 'block'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('actionRules.title')} tabIndex={-1}
        style={{ width: 380, maxWidth: '90vw', background: 'var(--surface)', borderRadius: 12,
          border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('actionRules.title')}</span>
          <button onClick={onCancel} aria-label={t('actionRules.cancel')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
            <X size={15} />
          </button>
        </div>

        <ActionRuleBanner decision={decision} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel}
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 7,
              border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            {t('actionRules.cancel')}
          </button>
          {canConfirm && (
            <button onClick={onConfirm}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: 'none',
                background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>
              {t('actionRules.ok')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

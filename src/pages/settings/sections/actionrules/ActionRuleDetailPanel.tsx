/**
 * ActionRuleDetailPanel — the side detail for the currently selected non-allow cell:
 * its popup code + a generic description (docs/AXIS-MATRIX.md §"Popups"), a note that
 * the message text itself is not (yet) tenant-editable (measured: `action_rules` only
 * stores `effect` — no message column), and a per-cell "reset to default" when the
 * cell isn't locked. Rendered as a persistent card above the grids (§ "popover or side
 * detail" — a fixed slot is more robust here than per-cell floating position math).
 */
import { useTranslation } from 'react-i18next'
import { X, RotateCcw, Lock } from 'lucide-react'
import type { Effect } from './types'

interface ActionRuleDetailPanelProps {
  actionLabel: string
  conditionLabel: string
  effect: Effect
  popupCode: string | null
  locked: boolean
  isOverride: boolean
  onReset: () => void
  onClose: () => void
}

export default function ActionRuleDetailPanel({
  actionLabel, conditionLabel, effect, popupCode, locked, isOverride, onReset, onClose,
}: ActionRuleDetailPanelProps) {
  const { t } = useTranslation('settings')

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px',
                   marginBottom: 20, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                         letterSpacing: '0.05em', marginBottom: 4 }}>
            {t('actionRules.detail.title')}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {actionLabel} × {conditionLabel}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            {t('actionRules.effect.' + effect)}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label={t('actionRules.detail.close')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
          <X size={16} />
        </button>
      </div>

      {/* Popup code + its generic (non-tenant-specific) description. A cell that was
          originally 'allow' (no catalog popup_code) but is now staged/overridden to
          warn/block has NO message to show at runtime (ActionRuleGuard only renders a
          message when a popup_code exists) — call that out explicitly instead of the
          misleading "always silently allowed" copy, which only applies to a real allow. */}
      {popupCode ? (
        <>
          <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text)' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--color-primary)' }}>
              {popupCode}
            </span>
            {' — '}
            {t(`actionRules.popups.${popupCode}`)}
          </div>
          {/* Message text is catalog-fixed, never tenant-editable (measured: no message column). */}
          <p style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {t('actionRules.detail.messageNote')}
          </p>
        </>
      ) : effect === 'allow' ? (
        <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {t('actionRules.detail.noPopup')}
        </p>
      ) : (
        <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--color-warning)', fontStyle: 'italic' }}>
          {t('actionRules.detail.noPopupOverrideWarning')}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        {locked ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <Lock size={13} /> {t('actionRules.detail.lockedNote')}
          </span>
        ) : (
          <>
            <span style={{ fontSize: 12, fontWeight: 500,
                            color: isOverride ? 'var(--color-primary)' : 'var(--text-muted)' }}>
              {isOverride ? t('actionRules.detail.isOverride') : t('actionRules.detail.isDefault')}
            </span>
            {isOverride && (
              <button type="button" onClick={onReset}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500,
                         padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)',
                         background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                <RotateCcw size={12} /> {t('actionRules.detail.resetCell')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

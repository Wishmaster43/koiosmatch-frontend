/**
 * ActionRuleCell — one action×condition cell: a compact soft-chip cycle-button
 * (click cycles allow → warn → block, §4 soft-chip convention: tint + icon + text,
 * never colour alone). A locked cell (archived / WhatsApp no-consent, §AXIS-MATRIX
 * hard rules) renders read-only with a lock icon instead. Non-allow, non-locked
 * cells get a small "i" trigger that opens the detail panel (popup code + message).
 */
import { useTranslation } from 'react-i18next'
import { Check, AlertTriangle, Ban, Lock, Info } from 'lucide-react'
import type { Effect } from './types'

// Icon + design-token colour per effect (never colour alone — icon differs too).
const EFFECT_ICON: Record<Effect, typeof Check> = { allow: Check, warn: AlertTriangle, block: Ban }
const EFFECT_COLOR: Record<Effect, string> = {
  allow: 'var(--color-success)', warn: 'var(--color-warning)', block: 'var(--color-danger)',
}

interface ActionRuleCellProps {
  effect: Effect
  locked: boolean
  overridden: boolean
  actionLabel: string
  conditionLabel: string
  selected: boolean
  onCycle: () => void
  onSelectDetail: () => void
}

export default function ActionRuleCell({
  effect, locked, overridden, actionLabel, conditionLabel, selected, onCycle, onSelectDetail,
}: ActionRuleCellProps) {
  const { t } = useTranslation('settings')
  const color = EFFECT_COLOR[effect]
  const Icon = locked ? Lock : EFFECT_ICON[effect]
  const effectLabel = t(`actionRules.effect.${effect}`)
  const cellLabel = t('actionRules.cellAria', { action: actionLabel, condition: conditionLabel, effect: effectLabel })

  // Locked: read-only, disabled button so it stays in the a11y tree with an explanatory title.
  if (locked) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button type="button" disabled aria-label={cellLabel} title={t('actionRules.lockedTitle')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
                   padding: '5px 10px', borderRadius: 6, cursor: 'not-allowed', minWidth: 100, justifyContent: 'center',
                   background: `color-mix(in srgb, ${color} 10%, transparent)`, color,
                   border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`, opacity: 0.75 }}>
          <Icon size={12} />
          {effectLabel}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, position: 'relative' }}>
      {/* The cycle button — a click steps allow → warn → block → allow. */}
      <button type="button" onClick={onCycle} aria-label={cellLabel}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
                 padding: '5px 10px', borderRadius: 6, cursor: 'pointer', minWidth: 100, justifyContent: 'center',
                 background: `color-mix(in srgb, ${color} 14%, transparent)`, color,
                 border: `1px solid color-mix(in srgb, ${color} 40%, transparent)` }}>
        <Icon size={12} />
        {effectLabel}
      </button>

      {/* Subtle dot: this cell's effect deviates from the seed-default (best-effort local
          computation — see catalogMeta.ts's documented gap; the API itself carries no flag). */}
      {overridden && (
        <span aria-hidden title={t('actionRules.cellOverrideTitle')}
          style={{ position: 'absolute', top: -3, right: 14, width: 6, height: 6, borderRadius: '50%',
                   background: 'var(--color-primary)' }} />
      )}

      {/* Non-allow cells carry a popup — the info trigger opens its detail panel. */}
      {effect !== 'allow' && (
        <button type="button" onClick={onSelectDetail}
          aria-label={`${cellLabel} — ${t('actionRules.detail.title')}`}
          aria-pressed={selected}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18,
                   borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                   background: selected ? 'var(--color-primary-bg)' : 'transparent',
                   color: selected ? 'var(--color-primary)' : 'var(--text-muted)' }}>
          <Info size={12} />
        </button>
      )}
    </div>
  )
}

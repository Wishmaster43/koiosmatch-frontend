/**
 * ActionRuleBanner — the one P-code-styled inline banner for an AXIS-MATRIX-2
 * decision (§3A "gedeeld preflight/P-dialoog-component"), used both by the Koios
 * confirmation card (Job 2) and, later, regular pages' action preflights. `allow`
 * renders nothing — only `warn`/`block` carry a banner. Colour is never the only
 * signal (§6): an icon + a fixed i18n title always accompany the tint, and the
 * server's own `message` (tenant-configurable, §3A action-rules matrix) is shown
 * verbatim — never re-translated or paraphrased client-side.
 */
import { AlertTriangle, Ban } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ActionRuleDecision } from './actionRuleTypes'

export default function ActionRuleBanner({ decision }: { decision: ActionRuleDecision | null | undefined }) {
  const { t } = useTranslation('common')
  if (!decision || decision.effect === 'allow') return null

  const isBlock = decision.effect === 'block'
  const color = isBlock ? 'var(--color-danger)' : 'var(--color-warning)'
  const bg = `color-mix(in srgb, ${color} 10%, transparent)`
  const border = `color-mix(in srgb, ${color} 30%, transparent)`
  const Icon = isBlock ? Ban : AlertTriangle
  const titleKey = isBlock ? 'actionRules.blockTitle' : 'actionRules.warnTitle'

  return (
    <div role="alert" data-testid="action-rule-banner" data-effect={decision.effect}
      style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px',
        borderRadius: 8, background: bg, border: `1px solid ${border}` }}>
      <Icon size={15} color={color} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color }}>{t(titleKey)}</div>
        {decision.message && (
          <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 2 }}>{decision.message}</div>
        )}
      </div>
    </div>
  )
}

/**
 * ActionRuleBanner — the one P-code-styled inline banner for an AXIS-MATRIX-2
 * decision (§3A "gedeeld preflight/P-dialoog-component"), used both by the Koios
 * confirmation card (Job 2) and, later, regular pages' action preflights. `allow`
 * renders nothing — only `warn`/`block` carry a banner. Colour is never the only
 * signal (§6): an icon + a fixed i18n title always accompany the tint, and the
 * server's own `message` (tenant-configurable, §3A action-rules matrix) is shown
 * verbatim — never re-translated or paraphrased client-side. ONE presentation
 * exception (DATUM-1, Danny 13-08): embedded ISO dates ("tot 2027-08-08") are
 * rewritten to the house DD-MM-YYYY before display — notation, not wording.
 */
import { AlertTriangle, Ban } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { humanizeIsoDates } from '@/lib/localDate'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import type { ActionRuleDecision } from './actionRuleTypes'

// Renders the warn/block banner for an AXIS-MATRIX-2 decision.
export default function ActionRuleBanner({ decision }: { decision: ActionRuleDecision | null | undefined }) {
  const { t } = useTranslation('common')
  if (!decision || decision.effect === 'allow') return null

  const isBlock = decision.effect === 'block'
  const color = isBlock ? 'var(--color-danger)' : 'var(--color-warning)'
  // Tint via lib/tint (house pair); ink via chipInk — the raw colour on its own
  // tint reads 2.4-3.0:1, AA fail (herhaal-slotaudit r3.5).
  const bg = tintBg(color)
  const border = tintBorder(color)
  const ink = chipInk(color)
  const Icon = isBlock ? Ban : AlertTriangle
  const titleKey = isBlock ? 'actionRules.blockTitle' : 'actionRules.warnTitle'

  return (
    <div role="alert" data-testid="action-rule-banner" data-effect={decision.effect}
      style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px',
        borderRadius: 8, background: bg, border }}>
      <Icon size={15} color={ink} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: ink }}>{t(titleKey)}</div>
        {decision.message && (
          <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 2 }}>{humanizeIsoDates(decision.message)}</div>
        )}
      </div>
    </div>
  )
}

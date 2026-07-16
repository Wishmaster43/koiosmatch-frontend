/**
 * ActionRuleLegend — compact legend explaining the four cell states (allow/warn/block/
 * locked) plus the override dot, and what a popup code (P1..P10) means. Kept calm and
 * collapsed-by-default width-wise: one row of chips + an expandable popup-code list.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, AlertTriangle, Ban, Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { POPUP_CODES } from './catalogMeta'

// Same icon/colour pairing as ActionRuleCell, so the legend visually matches the grid.
const ITEMS = [
  { key: 'allow', Icon: Check, color: 'var(--color-success)' },
  { key: 'warn', Icon: AlertTriangle, color: 'var(--color-warning)' },
  { key: 'block', Icon: Ban, color: 'var(--color-danger)' },
  { key: 'locked', Icon: Lock, color: 'var(--text-muted)' },
] as const

export default function ActionRuleLegend() {
  const { t } = useTranslation('settings')
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        {ITEMS.map(({ key, Icon, color }) => (
          <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)' }}>
            <Icon size={13} color={color} />
            {t(`actionRules.legend.${key}`)}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)' }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' }} />
          {t('actionRules.legend.override')}
        </span>

        <button type="button" onClick={() => setExpanded((v) => !v)}
          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
                   fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
          {t('actionRules.legend.popupsTitle')}
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {expanded && (
        <ul style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)',
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '6px 16px' }}>
          {POPUP_CODES.map((code) => (
            <li key={code} style={{ fontSize: 12, color: 'var(--text-muted)', listStyle: 'none' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text)' }}>
                {code}
              </span>
              {' — '}
              {t(`actionRules.popups.${code}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

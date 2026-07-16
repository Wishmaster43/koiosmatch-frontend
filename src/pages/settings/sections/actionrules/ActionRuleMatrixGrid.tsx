/**
 * ActionRuleMatrixGrid — one axis of the matrix (candidate OR customer): rows = action
 * tokens, columns = condition tokens, cell = ActionRuleCell. A plain HTML table in an
 * `overflow-x: auto` wrapper so a 6-column axis never forces the page itself to scroll.
 */
import { useTranslation } from 'react-i18next'
import type { Effect } from './types'
import { ACTION_I18N_KEY, CONDITION_I18N_KEY, isLockedCell } from './catalogMeta'
import ActionRuleCell from './ActionRuleCell'

export interface SelectedCell { action: string; condition: string }

interface ActionRuleMatrixGridProps {
  title: string
  subtitle: string
  actions: readonly string[]
  conditions: readonly string[]
  getEffect: (action: string, condition: string) => Effect
  isOverridden: (action: string, condition: string) => boolean
  selectedCell: SelectedCell | null
  onCycle: (action: string, condition: string) => void
  onSelectDetail: (action: string, condition: string) => void
}

export default function ActionRuleMatrixGrid({
  title, subtitle, actions, conditions, getEffect, isOverridden, selectedCell, onCycle, onSelectDetail,
}: ActionRuleMatrixGridProps) {
  const { t } = useTranslation('settings')

  return (
    <section style={{ marginBottom: 28 }}>
      {/* Section heading — one grid per axis, per the catalog's own §B/§C split. */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{title}</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{subtitle}</p>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        {/* `separate` border-collapse is required here — `collapse` breaks the sticky
            first column's opaque background in Chromium (the scrolled-under cell content
            bleeds through), a real artifact found while probing the live grid. With
            `separate`, a <tr> can no longer carry its own border, so the row divider
            moves onto each cell's own `borderTop` below. */}
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 640 }}>
          <thead>
            <tr style={{ background: 'var(--border)' }}>
              <th scope="col" style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700,
                                        color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                                        position: 'sticky', left: 0, background: 'var(--border)', minWidth: 200 }}>
                {t('actionRules.actionCol')}
              </th>
              {conditions.map((condition) => (
                <th key={condition} scope="col" style={{ textAlign: 'center', padding: '8px 6px', fontSize: 11,
                                                           fontWeight: 700, color: 'var(--text-muted)', minWidth: 116 }}>
                  {t(`actionRules.conditions.${CONDITION_I18N_KEY[condition]}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {actions.map((action, i) => {
              const rowBorder = i === 0 ? undefined : '1px solid var(--border)'
              return (
                <tr key={action}>
                  <th scope="row" style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12.5, fontWeight: 500,
                                            color: 'var(--text)', position: 'sticky', left: 0, background: 'var(--surface)',
                                            borderTop: rowBorder }}>
                    {t(`actionRules.actions.${ACTION_I18N_KEY[action]}`)}
                  </th>
                  {conditions.map((condition) => (
                    <td key={condition} style={{ padding: '6px 4px', borderTop: rowBorder }}>
                      <ActionRuleCell
                        effect={getEffect(action, condition)}
                        locked={isLockedCell(action, condition)}
                        overridden={isOverridden(action, condition)}
                        actionLabel={t(`actionRules.actions.${ACTION_I18N_KEY[action]}`)}
                        conditionLabel={t(`actionRules.conditions.${CONDITION_I18N_KEY[condition]}`)}
                        selected={selectedCell?.action === action && selectedCell?.condition === condition}
                        onCycle={() => onCycle(action, condition)}
                        onSelectDetail={() => onSelectDetail(action, condition)}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * TenantUsageDetailsTable — per-month breakdown for the active tenant's usage,
 * built from the `history` array the backend already returns alongside the
 * selected-month summary (GET /admin/tenants/{tenant}/usage — AdminUsageController@show).
 * One row per month; expanding a row reveals exactly the fields the server
 * sends for that month (AI cost, workflow per-module runs, per-connector
 * counts, purchase/sale/margin). Never a synthesized or estimated number —
 * a field the backend omits stays a dash, never a guess (§3 no fake affordances).
 */
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import { useNumberFormat } from '@/lib/formatters'
import { th, td, numCell } from './usageCardStyles'

// Connector key -> brand label (proper nouns, not translatable), mirrors TenantUsageSettings.
const CONNECTOR_LABELS = { sm: 'Shiftmanager', hf: 'HelloFlex', intus: 'Intus', elanza: 'Elanza', aelio: 'Aelio' }

// Month value ('YYYY-MM') rendered as a locale month/year label, house convention
// (no raw ISO fragments in the UI — DATUM-1).
function monthLabel(value) {
  if (!value) return '—'
  const [y, m] = value.split('-').map(Number)
  if (!y || !m) return value
  return new Date(y, m - 1, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
}

export default function TenantUsageDetailsTable({ history }) {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()
  const rows = Array.isArray(history) ? history : []

  // Columns show only the always-present monthly summary fields; the rest
  // (per-connector, per-module, purchase/sale/margin) lives in the expanded panel.
  const columns = [
    { key: 'month', header: t('usage.details.colMonth'), render: (r) => <span style={{ textTransform: 'capitalize' }}>{monthLabel(r.month)}</span> },
    { key: 'aiTokens', header: t('usage.details.colAiTokens'), align: 'right', render: (r) => formatNumber(r.ai?.tokens) },
    { key: 'aiCalls', header: t('usage.details.colAiCalls'), align: 'right', render: (r) => formatNumber(r.ai?.requests) },
    { key: 'workflowRuns', header: t('usage.details.colWorkflowRuns'), align: 'right', render: (r) => formatNumber(r.workflow_tokens?.total_module_runs) },
    { key: 'totalAmount', header: t('usage.details.colTotalAmount'), align: 'right', render: (r) => formatCurrency(r.billing?.total_amount) },
  ]

  // Per-month detail panel — every value here is read straight off the row's
  // own server payload, no derivation. An empty sub-section shows an honest
  // "no data" line rather than a zero it did not actually measure.
  function renderExpanded(row) {
    const connectors = Array.isArray(row.connectors) ? row.connectors.filter((c) => c.usage > 0) : []
    const perModule = Object.entries(row.workflow_tokens?.per_module ?? {})
    const hasMargin = row.billing?.ai != null

    return (
      <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* AI cost detail — raw purchase vs. platform sale price vs. margin. */}
        {hasMargin && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {t('usage.details.aiCost')}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={td}>{t('usage.details.purchase')}</td>
                  <td style={numCell}>{formatCurrency(row.billing.ai.purchase)}</td>
                </tr>
                <tr>
                  <td style={td}>{t('usage.details.sale')}</td>
                  <td style={numCell}>{formatCurrency(row.billing.ai.sale)}</td>
                </tr>
                <tr>
                  <td style={{ ...td, borderBottom: 'none' }}>{t('usage.details.margin')}</td>
                  <td style={{ ...numCell, borderBottom: 'none' }}>{formatCurrency(row.billing.ai.margin)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Workflow runs per module. */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {t('usage.details.workflowPerModule')}
          </div>
          {perModule.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t('usage.details.noData')}</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>{t('usage.details.colModule')}</th>
                    <th style={{ ...th, textAlign: 'right' }}>{t('usage.details.colRuns')}</th>
                  </tr>
                </thead>
                <tbody>
                  {perModule.map(([moduleType, runs]) => (
                    <tr key={moduleType}>
                      <td style={{ ...td, fontFamily: 'monospace' }}>{moduleType}</td>
                      <td style={numCell}>{formatNumber(runs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        {/* Connector calls, this month. */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {t('usage.col.connectors')}
          </div>
          {connectors.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{t('usage.details.noData')}</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {connectors.map((c) => (
                    <tr key={c.key}>
                      <td style={{ ...td, borderBottom: 'none' }}>{CONNECTOR_LABELS[c.key] ?? c.key}</td>
                      <td style={{ ...numCell, borderBottom: 'none' }}>{formatNumber(c.usage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    // Honest empty state — never a synthesized history when the backend sent none.
    return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('usage.details.empty')}</p>
  }

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.month}
      renderExpanded={renderExpanded}
      expandLabel={t('usage.details.expandLabel')}
      emptyText={t('usage.details.empty')}
    />
  )
}

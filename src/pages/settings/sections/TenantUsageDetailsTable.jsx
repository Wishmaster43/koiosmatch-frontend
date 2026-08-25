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
import UsageTotalsRow from './UsageTotalsRow'
import DataTable from '@/components/ui/DataTable'
import TableScrollFrame from '@/components/ui/TableScrollFrame'
import { useNumberFormat } from '@/lib/formatters'
import { GroupLabel } from '@/components/ui/typography'
import { th, td, numCell } from './usageCardStyles'
// App-wide active locale (DATUM-1/LANE-B) — feeds the per-month row label.
import { useLocale } from '@/lib/datetime'

// Connector key -> brand label (proper nouns, not translatable), mirrors TenantUsageSettings.
const CONNECTOR_LABELS = { sm: 'Shiftmanager', hf: 'HelloFlex', intus: 'Intus', elanza: 'Elanza', aelio: 'Aelio' }

// Month value ('YYYY-MM') rendered as a locale month/year label, house convention
// (no raw ISO fragments in the UI — DATUM-1). `locale` is required (a pure
// module-scope helper never hardcodes nl-NL).
function monthLabel(value, locale) {
  if (!value) return '—'
  const [y, m] = value.split('-').map(Number)
  if (!y || !m) return value
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}

export default function TenantUsageDetailsTable({ history }) {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()
  const locale = useLocale()
  const rows = Array.isArray(history) ? history : []

  // Totals across every month in the history — sums exactly what the columns
  // above show, so the strip below the table can never disagree with a row.
  const totals = rows.reduce((acc, r) => ({
    aiTokens: acc.aiTokens + (r.ai?.tokens ?? 0),
    aiCalls: acc.aiCalls + (r.ai?.requests ?? 0),
    workflowRuns: acc.workflowRuns + (r.workflow_tokens?.total_module_runs ?? 0),
    totalAmount: acc.totalAmount + (r.billing?.total_amount ?? 0),
  }), { aiTokens: 0, aiCalls: 0, workflowRuns: 0, totalAmount: 0 })

  // Columns show only the always-present monthly summary fields; the rest
  // (per-connector, per-module, purchase/sale/margin) lives in the expanded panel.
  const columns = [
    { key: 'month', header: t('usage.details.colMonth'), render: (r) => <span style={{ textTransform: 'capitalize' }}>{monthLabel(r.month, locale)}</span> },
    { key: 'aiTokens', header: t('usage.details.colAiTokens'), align: 'right', render: (r) => formatNumber(r.ai?.tokens) },
    { key: 'aiCalls', header: t('usage.details.colAiCalls'), align: 'right', render: (r) => formatNumber(r.ai?.requests) },
    { key: 'workflowRuns', header: t('usage.details.colWorkflowRuns'), align: 'right', render: (r) => formatNumber(r.workflow_tokens?.total_module_runs) },
    { key: 'totalAmount', header: t('usage.details.colTotalAmount'), align: 'right', render: (r) => formatCurrency(r.billing?.total_amount) },
  ]

  // Per-month detail panel — every value here is read straight off the row's
  // own server payload, no derivation. An empty sub-section shows an honest
  // "no data" line rather than a zero it did not actually measure.
  // No per-month margin panel here: AdminUsageController builds history[].billing
  // from billingForMonth() only — the ai {purchase,sale,margin} block exists solely
  // on the SELECTED month (rendered by TenantUsageKpiRow). Rendering it per history
  // row was dead against the real server (Opus round, USAGE-GROUPS-1 lesson).
  function renderExpanded(row) {
    const connectors = Array.isArray(row.connectors) ? row.connectors.filter((c) => c.usage > 0) : []
    const perModule = Object.entries(row.workflow_tokens?.per_module ?? {})

    return (
      <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Workflow runs per module. */}
        <div>
          <GroupLabel style={{ marginBottom: 6 }}>{t('usage.details.workflowPerModule')}</GroupLabel>
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
          <GroupLabel style={{ marginBottom: 6 }}>{t('usage.col.connectors')}</GroupLabel>
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

  // Bounded height (Danny 17-08: "hoe lang wordt dit dan wel niet") — the history
  // is a rolling window that grows with the tenant, and an expanded row adds a
  // whole panel on top of that. Nothing is dropped: the footer states the real
  // number of months, and every one of them stays in the scroll area.
  return (
    <>
      <TableScrollFrame
        label={t('usage.details.title')}
        maxHeight={380}
        footer={t('usage.details.footer', { count: rows.length })}
      >
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.month}
          stickyHeader
          renderExpanded={renderExpanded}
          expandLabel={t('usage.details.expandLabel')}
          emptyText={t('usage.details.empty')}
        />
      </TableScrollFrame>
      {/* Totals row across every month in the history — never rescrolled away. */}
      <UsageTotalsRow label={t('usage.details.totalsLabel')} values={[
        formatNumber(totals.aiTokens),
        formatNumber(totals.aiCalls),
        formatNumber(totals.workflowRuns),
        formatCurrency(totals.totalAmount),
      ]} />
    </>
  )
}

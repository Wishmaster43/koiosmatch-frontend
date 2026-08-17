/**
 * TenantUsageBreakdownTable — superadmin-only detail breakdown of a tenant's
 * monthly usage, sliced by activity / model / user / day (CMBE, 14-08).
 * Source: GET /admin/tenants/{tenant}/usage/details?month=YYYY-MM&group_by=<axis>.
 * The rows sum to the /usage total already shown above this table by server
 * contract — this component never re-derives or checks that sum, it only
 * renders what the server sends. The "__system__" sentinel row (work with no
 * user_id, e.g. the AI interview) always renders with its resolved label —
 * hiding it would silently break that invariant for the reader.
 *
 * USAGE-GROUPS-1 (17-08): the payload key is `groups`, not `rows`. Reading the
 * wrong key made this table render "geen verbruik in deze periode" on all four
 * axes regardless of the data — four buttons that could never show anything, a
 * fake affordance the unit test could not catch because it mocked the same wrong
 * key. Measured against the live endpoint before changing it.
 *
 * Length is BOUNDED by the shared TableScrollFrame (Danny 17-08: "hoe lang wordt
 * dit dan wel niet") — the user axis grows with the tenant's user count and the
 * day axis with the month, so the page must not grow with them. Nothing is
 * dropped: every group stays in the scroll area and the footer states the count
 * plus the server's own month totals, so a scrolled view still foots.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import DataTable from '@/components/ui/DataTable'
import TableScrollFrame from '@/components/ui/TableScrollFrame'
import TenantUsageBreakdownChart from './TenantUsageBreakdownChart'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { useNumberFormat } from '@/lib/formatters'
import { useDateFormat } from '@/lib/datetime'
import type {
  AdminUsageDetailsAxis, AdminUsageDetailsRow, AdminUsageDetailsResponse, AdminUsageDetailsTotals,
} from '@/types/billingUsage'

interface Props {
  tenantId: string | number | undefined
  month: string // 'YYYY-MM'
}

const AXES: AdminUsageDetailsAxis[] = ['activity', 'model', 'user', 'day']

export default function TenantUsageBreakdownTable({ tenantId, month }: Props) {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()
  const { formatDate } = useDateFormat()
  const [axis, setAxis] = useState<AdminUsageDetailsAxis>('activity')
  const [rows, setRows] = useState<AdminUsageDetailsRow[]>([])
  const [totals, setTotals] = useState<AdminUsageDetailsTotals | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')

  // Fetch the selected axis/month combination — refetch on tenant, month or axis change.
  useEffect(() => {
    if (!tenantId) { setPhase('error'); return }
    const ctrl = new AbortController()
    setPhase('loading')
    api.get(`/admin/tenants/${tenantId}/usage/details`, { params: { month, group_by: axis }, signal: ctrl.signal })
      .then(res => {
        const body = unwrap<AdminUsageDetailsResponse>(res)
        setRows(body?.groups ?? [])
        setTotals(body?.totals ?? null)
        setPhase('ready')
      })
      .catch(() => setPhase('error'))
    return () => ctrl.abort()
  }, [tenantId, month, axis])

  const columns = useMemo(() => {
    // Resolve a row's display key: user axis (incl. "__system__") shows the resolved
    // label; day axis renders DD-MM-YYYY; the rest shows the raw key as-is.
    const keyLabel = (row: AdminUsageDetailsRow) => {
      if (axis === 'user') return row.label || row.key
      if (axis === 'day') return formatDate(row.key)
      return row.key
    }
    // Purchase falls back to the raw `cost` sum when the server omits the split —
    // an absent amount stays a dash rather than a fabricated zero (STATS-HONEST-1).
    const purchaseOf = (r: AdminUsageDetailsRow) => r.sale?.purchase ?? r.cost
    return [
      { key: 'key', header: t(`usage.breakdown.col.${axis}`), sortable: true,
        sortValue: (r: AdminUsageDetailsRow) => (axis === 'user' ? r.label || r.key : r.key),
        render: keyLabel },
      { key: 'requests', header: t('usage.breakdown.col.requests'), align: 'right' as const, sortable: true,
        sortValue: (r: AdminUsageDetailsRow) => r.requests ?? null,
        render: (r: AdminUsageDetailsRow) => formatNumber(r.requests) },
      { key: 'input_tokens', header: t('usage.breakdown.col.inputTokens'), align: 'right' as const, sortable: true,
        sortValue: (r: AdminUsageDetailsRow) => r.input_tokens ?? null,
        render: (r: AdminUsageDetailsRow) => formatNumber(r.input_tokens) },
      { key: 'output_tokens', header: t('usage.breakdown.col.outputTokens'), align: 'right' as const, sortable: true,
        sortValue: (r: AdminUsageDetailsRow) => r.output_tokens ?? null,
        render: (r: AdminUsageDetailsRow) => formatNumber(r.output_tokens) },
      { key: 'purchase', header: t('usage.breakdown.col.purchase'), align: 'right' as const, sortable: true,
        sortValue: purchaseOf,
        render: (r: AdminUsageDetailsRow) => formatCurrency(purchaseOf(r)) },
      { key: 'sale', header: t('usage.breakdown.col.sale'), align: 'right' as const, sortable: true,
        sortValue: (r: AdminUsageDetailsRow) => r.sale?.sale ?? null,
        render: (r: AdminUsageDetailsRow) => formatCurrency(r.sale?.sale) },
    ]
  }, [axis, t, formatNumber, formatCurrency, formatDate])

  // Footer states the real size plus the server's own month totals, so the
  // reader knows what is in the scroll area without scrolling through it.
  const footer = totals
    ? t('usage.breakdown.footerWithTotals', {
      count: rows.length,
      requests: formatNumber(totals.requests ?? 0),
      tokens: formatNumber(totals.tokens ?? 0),
    })
    : t('usage.breakdown.footer', { count: rows.length })

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <SegmentedControl
          size="compact"
          ariaLabel={t('usage.breakdown.axisLabel')}
          options={AXES.map(a => ({ value: a, label: t(`usage.breakdown.axis.${a}`) }))}
          value={axis}
          onChange={(v) => setAxis(v as AdminUsageDetailsAxis)}
        />
      </div>

      {phase === 'loading' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('common.loadingShort', { defaultValue: 'Laden…' })}</p>}
      {phase === 'error' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('usage.breakdown.loadError')}</p>}
      {phase === 'ready' && (
        // Table left, its own picture right (Danny 17-08). Wraps on a narrow
        // viewport rather than squeezing six numeric columns into half a column.
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 520px', minWidth: 0 }}>
            <TableScrollFrame label={t('usage.breakdown.title')} footer={rows.length ? footer : null}>
              <DataTable
                columns={columns}
                rows={rows}
                getRowId={(r: AdminUsageDetailsRow) => r.key}
                stickyHeader
                // Biggest consumer first — the reason a super-admin opens this at all.
                defaultSort={{ key: 'purchase', dir: 'desc' }}
                emptyText={t('usage.breakdown.empty')}
              />
            </TableScrollFrame>
          </div>
          {rows.length > 0 && (
            <div style={{ flex: '1 1 340px', minWidth: 300, background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
              <TenantUsageBreakdownChart axis={axis} rows={rows} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

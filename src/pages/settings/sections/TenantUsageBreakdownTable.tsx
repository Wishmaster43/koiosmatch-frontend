/**
 * TenantUsageBreakdownTable — superadmin-only detail breakdown of a tenant's
 * monthly usage, sliced by activity / model / user / day (CMBE, 14-08).
 * Source: GET /admin/tenants/{tenant}/usage/details?month=YYYY-MM&group_by=<axis>.
 * The rows sum to the /usage total already shown above this table by server
 * contract — this component never re-derives or checks that sum, it only
 * renders what the server sends. The "__system__" sentinel row (work with no
 * user_id, e.g. the AI interview) always renders with its resolved label —
 * hiding it would silently break that invariant for the reader.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import DataTable from '@/components/ui/DataTable'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { useNumberFormat } from '@/lib/formatters'
import { useDateFormat } from '@/lib/datetime'
import type { AdminUsageDetailsAxis, AdminUsageDetailsRow, AdminUsageDetailsResponse } from '@/types/billingUsage'

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
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')

  // Fetch the selected axis/month combination — refetch on tenant, month or axis change.
  useEffect(() => {
    if (!tenantId) { setPhase('error'); return }
    const ctrl = new AbortController()
    setPhase('loading')
    api.get(`/admin/tenants/${tenantId}/usage/details`, { params: { month, group_by: axis }, signal: ctrl.signal })
      .then(res => { setRows(unwrap<AdminUsageDetailsResponse>(res)?.rows ?? []); setPhase('ready') })
      .catch(() => setPhase('error'))
    return () => ctrl.abort()
  }, [tenantId, month, axis])

  // Resolve a row's display key: user axis (incl. "__system__") shows the resolved
  // label; day axis renders DD-MM-YYYY; the rest shows the raw key as-is.
  function keyLabel(row: AdminUsageDetailsRow) {
    if (axis === 'user') return row.label || row.key
    if (axis === 'day') return formatDate(row.key)
    return row.key
  }

  const columns = [
    { key: 'key', header: t(`usage.breakdown.col.${axis}`), render: keyLabel },
    { key: 'requests', header: t('usage.breakdown.col.requests'), align: 'right' as const, render: (r: AdminUsageDetailsRow) => formatNumber(r.requests) },
    { key: 'input_tokens', header: t('usage.breakdown.col.inputTokens'), align: 'right' as const, render: (r: AdminUsageDetailsRow) => formatNumber(r.input_tokens) },
    { key: 'output_tokens', header: t('usage.breakdown.col.outputTokens'), align: 'right' as const, render: (r: AdminUsageDetailsRow) => formatNumber(r.output_tokens) },
    { key: 'cost', header: t('usage.breakdown.col.cost'), align: 'right' as const, render: (r: AdminUsageDetailsRow) => formatCurrency(r.cost) },
  ]

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
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(r: AdminUsageDetailsRow) => r.key}
          emptyText={t('usage.breakdown.empty')}
        />
      )}
    </div>
  )
}

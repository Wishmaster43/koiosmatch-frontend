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
 * from the same VISIBLE population, so a scrolled or filtered view still foots.
 *
 * TENANT-USAGE-POLISH-1: clicking a chart slice/bar (`onSelectKey`) filters this
 * table to the one matching row — an `ActiveFilterChip` above the table names the
 * filter and clears it. The CHART itself always keeps charting every row (it is
 * the overview); only the table narrows, so switching axis or clearing the chip
 * always gets you back to the full list. A totals row under the table sums the
 * CURRENTLY VISIBLE rows (all of them, or just the filtered one).
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import DataTable from '@/components/ui/DataTable'
import TableScrollFrame from '@/components/ui/TableScrollFrame'
import TenantUsageBreakdownChart from './TenantUsageBreakdownChart'
import SegmentedControl from '@/components/ui/SegmentedControl'
import ActiveFilterChip from '@/components/search/ActiveFilterChip'
import UsageTotalsRow from './UsageTotalsRow'
import { useNumberFormat } from '@/lib/formatters'
import { useDateFormat } from '@/lib/datetime'
import type {
  AdminUsageDetailsAxis, AdminUsageDetailsRow, AdminUsageDetailsResponse,
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
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  // Drill-down: the key of the chart slice/bar the user clicked, or null for the
  // full list. Reset whenever the axis (or the underlying data) changes, so a
  // stale filter never survives onto an axis where that key means something else.
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // Fetch the selected axis/month combination — refetch on tenant, month or axis change.
  useEffect(() => {
    if (!tenantId) { setPhase('error'); return }
    const ctrl = new AbortController()
    setPhase('loading')
    setSelectedKey(null)
    api.get(`/admin/tenants/${tenantId}/usage/details`, { params: { month, group_by: axis }, signal: ctrl.signal })
      .then(res => {
        const body = unwrap<AdminUsageDetailsResponse>(res)
        setRows(body?.groups ?? [])
        setPhase('ready')
      })
      .catch(() => setPhase('error'))
    return () => ctrl.abort()
  }, [tenantId, month, axis])

  // The visible rows: everything, or the one row matching the drill-down click.
  const visibleRows = useMemo(
    () => (selectedKey ? rows.filter(r => r.key === selectedKey) : rows),
    [rows, selectedKey],
  )
  const selectedRow = useMemo(() => rows.find(r => r.key === selectedKey) ?? null, [rows, selectedKey])
  // DATUM-1: the day axis keys are raw ISO (Y-m-d) — the chip must read DD-MM-YYYY.
  const selectedLabel = selectedRow
    ? (axis === 'day' ? formatDate(selectedRow.key) : (axis === 'user' ? (selectedRow.label || selectedRow.key) : selectedRow.key))
    : ''

  // Totals row under the table — sums the CURRENTLY VISIBLE rows (so a filtered
  // single row shows its own totals, matching what the reader sees above it).
  const purchaseOf = (r: AdminUsageDetailsRow) => r.sale?.purchase ?? r.cost ?? 0
  const visibleTotals = useMemo(() => visibleRows.reduce((acc, r) => ({
    requests: acc.requests + (r.requests ?? 0),
    inputTokens: acc.inputTokens + (r.input_tokens ?? 0),
    outputTokens: acc.outputTokens + (r.output_tokens ?? 0),
    purchase: acc.purchase + purchaseOf(r),
    sale: acc.sale + (r.sale?.sale ?? 0),
  }), { requests: 0, inputTokens: 0, outputTokens: 0, purchase: 0, sale: 0 }), [visibleRows])

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

  // Footer describes ONE population: the VISIBLE rows — count, requests and
  // tokens all from the same set, so a drill-down filter never mixes a filtered
  // count with whole-month numbers in one sentence (Opus round; on a billing
  // screen that read as a factual misstatement).
  const footer = t('usage.breakdown.footerWithTotals', {
    count: visibleRows.length,
    requests: formatNumber(visibleTotals.requests),
    tokens: formatNumber(visibleTotals.inputTokens + visibleTotals.outputTokens),
  })

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <SegmentedControl
          size="compact"
          ariaLabel={t('usage.breakdown.axisLabel')}
          options={AXES.map(a => ({ value: a, label: t(`usage.breakdown.axis.${a}`) }))}
          value={axis}
          onChange={(v) => setAxis(v as AdminUsageDetailsAxis)}
        />
        {/* Active drill-down filter — a click on the chart narrowed the table to
            one row; the chip names it and clears it back to the full list. */}
        {selectedRow && (
          <ActiveFilterChip
            label={t('usage.breakdown.filterActive', { value: selectedLabel })}
            ariaLabel={t('usage.breakdown.clearFilter')}
            onRemove={() => setSelectedKey(null)}
          />
        )}
      </div>

      {phase === 'loading' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('common.loadingShort', { defaultValue: 'Laden…' })}</p>}
      {phase === 'error' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('usage.breakdown.loadError')}</p>}
      {phase === 'ready' && (
        // Table left, its own picture right (Danny 17-08).
        // The flex bases are deliberately SMALL. The first attempt used 520/340,
        // which needs ~880px of content width — and the settings pane only has
        // that from a ~1440px window up, so on a normal laptop the chart wrapped
        // back underneath the table, which is exactly what Danny reported. At
        // 300/300 the pair stays side by side down to ~620px of pane; the table
        // simply gets narrower and scrolls inside its own frame, which it already
        // does. Wrapping is kept for genuinely small screens, where two columns
        // of this density are worse than one.
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <TableScrollFrame label={t('usage.breakdown.title')} footer={visibleRows.length ? footer : null}>
              <DataTable
                columns={columns}
                rows={visibleRows}
                getRowId={(r: AdminUsageDetailsRow) => r.key}
                stickyHeader
                // Biggest consumer first — the reason a super-admin opens this at all.
                defaultSort={{ key: 'purchase', dir: 'desc' }}
                emptyText={t('usage.breakdown.empty')}
              />
            </TableScrollFrame>
            {/* Totals row for the currently VISIBLE rows (all of them, or the
                one row a drill-down filtered to) — never the scroll area's own
                text footer, which stays the server's month total. */}
            {visibleRows.length > 0 && (
              <UsageTotalsRow label={t('usage.breakdown.totalsLabel')} values={[
                formatNumber(visibleTotals.requests),
                formatCurrency(visibleTotals.purchase),
                formatCurrency(visibleTotals.sale),
              ]} />
            )}
          </div>
          {rows.length > 0 && (
            <div style={{ flex: '0 0 280px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
              <TenantUsageBreakdownChart axis={axis} rows={rows} onSelectKey={(k) => k && setSelectedKey(k)} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

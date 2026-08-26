/**
 * MessagesTable — searchable, sortable, paginated table of sent/received messages
 * (WhatsApp + email). Shows direction, status, channel and contact; filters come
 * from RightPanelContext. Data is fetched per page from the API. The badges +
 * detail drawer live in `./messages/` (messageParts, MessageDrawer). Chrome
 * (sortable header + toolbar) and paging state come from the shared
 * reportTableChrome/useReportPaging (§3, "36-42 identical lines" consolidation).
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel }      from '@/context/RightPanelContext'
import { useDateFormat }      from '@/lib/datetime'
import PaginationBar          from '../ui/PaginationBar'
import { useReportPaging }    from './useReportPaging'
import { TD, SortableTableHead, ReportTableToolbar } from './reportTableChrome'
import { BodyText, Caption } from '@/components/ui/typography'
import { useReportList }      from './useReportList'
import type { MessageRow, ReportFilterGroup, SortState } from '@/types/reports'
import { ChannelBadge, StatusBadge } from './messages/messageParts'
import MessageDrawer from './messages/MessageDrawer'

const COL_KEYS = [
  { key: 'sent_at',         tKey: 'sent',      sortable: true },
  { key: 'recipient_name',  tKey: 'recipient', sortable: true },
  { key: 'channel',         tKey: 'channel',   sortable: true },
  { key: 'subject',         tKey: 'subject',   sortable: true },
  { key: 'status',          tKey: 'status',    sortable: true },
  { key: 'workflow_name',   tKey: 'workflow',  sortable: true },
]

// Wires local UI state (search, sort, filters, paging) around the API-backed rows fetched by useReportList; see the module doc above for the overall shape.
export default function MessagesTable() {
  const { t } = useTranslation('reports')
  const COLS = COL_KEYS.map(c => ({ ...c, label: t(`messages.cols.${c.tKey}`) }))
  // Data (fetch) lives in the shared hook (§3); this component only derives + renders.
  const { rows, loading } = useReportList<MessageRow>('/messages')
  // App-wide active locale (§5) — never a hardcoded 'nl-NL' toLocale*String call.
  const { formatDate, formatTime } = useDateFormat()
  const [search,  setSearch]  = useState('')
  const [drill,   setDrill]   = useState<MessageRow | null>(null)
  const [sort,    setSort]    = useState<SortState>({ key: 'sent_at', dir: 'desc' })
  const [selectedStatuses,  setSelectedStatuses]  = useState<Array<string | number>>([])
  const [selectedChannels,  setSelectedChannels]  = useState<Array<string | number>>([])
  const [selectedWorkflows, setSelectedWorkflows] = useState<Array<string | number>>([])

  const { registerFilters, unregisterFilters } = useRightPanel()

  // Distinct channel values already loaded client-side seed the right-panel filter — no separate lookup fetch needed.
  const channelOptions  = useMemo(() => [...new Set(rows.map(r => r.channel).filter((x): x is string => Boolean(x)))].sort(), [rows])
  // Same derivation for status: built from the current row set, not a lookup table.
  const statusOptions   = useMemo(() => [...new Set(rows.map(r => r.status).filter((x): x is string => Boolean(x)))].sort(), [rows])
  // Workflow names vary per tenant automation, so the filter list is built from what actually appears in the loaded rows.
  const workflowOptions = useMemo(() => [...new Set(rows.map(r => r.workflow_name).filter((x): x is string => Boolean(x)))].sort(), [rows])

  // Combines the right-panel chip selections with the free-text search across recipient/subject/template/workflow fields.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (selectedStatuses.length  && !selectedStatuses.includes(r.status as string))        return false
      if (selectedChannels.length  && !selectedChannels.includes(r.channel as string))       return false
      if (selectedWorkflows.length && !selectedWorkflows.includes(r.workflow_name as string)) return false
      if (!q) return true
      return (
        (r.recipient_name  ?? '').toLowerCase().includes(q) ||
        (r.recipient_email ?? '').toLowerCase().includes(q) ||
        (r.recipient_phone ?? '').toLowerCase().includes(q) ||
        (r.subject         ?? '').toLowerCase().includes(q) ||
        (r.template_name   ?? '').toLowerCase().includes(q) ||
        (r.workflow_name   ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, selectedStatuses, selectedChannels, selectedWorkflows])

  // Case-insensitive string sort driven by the sortable column headers; runs after filtering so paging reflects the filtered set.
  const sorted = useMemo(() => {
    const { key, dir } = sort
    return [...filtered].sort((a, b) => {
      const av = (a[key] ?? '').toString().toLowerCase()
      const bv = (b[key] ?? '').toString().toLowerCase()
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ?  1 : -1
      return 0
    })
  }, [filtered, sort])

  // Shared paging/sort-toggle state (§3 consolidation) — page resets to 1 on any filter/size change.
  const { page, paged, totalPages, pageSize, handlePageSizeChange, setPage, setSort_ } = useReportPaging(sorted, setSort, 'desc')

  // Assembles the right-panel filter groups only from dimensions that actually have options, each carrying live counts from the current rows.
  const filterGroups = useMemo(() => {
    const groups: ReportFilterGroup[] = []
    if (channelOptions.length) {
      groups.push({
        key: 'channel', label: t('messages.filters.channel'),
        selected: selectedChannels,
        options: channelOptions.map(c => ({
          value: c,
          label: t(`messages.channel.${c?.toLowerCase()}`, { defaultValue: c }),
          count: rows.filter(r => r.channel === c).length,
        })),
        onToggle: v => setSelectedChannels(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      })
    }
    if (statusOptions.length) {
      groups.push({
        key: 'status', label: t('messages.filters.status'),
        selected: selectedStatuses,
        options: statusOptions.map(s => ({
          value: s,
          label: t(`messages.status.${s?.toLowerCase()}`, { defaultValue: s }),
          count: rows.filter(r => r.status === s).length,
        })),
        onToggle: v => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      })
    }
    if (workflowOptions.length) {
      groups.push({
        key: 'workflow', label: t('messages.filters.workflow'), type: 'search-select',
        selected: selectedWorkflows,
        options: workflowOptions.map(w => ({
          value: w, label: w,
          count: rows.filter(r => r.workflow_name === w).length,
        })),
        onToggle: v => setSelectedWorkflows(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      })
    }
    return groups
  }, [t, channelOptions, statusOptions, workflowOptions, selectedChannels, selectedStatuses, selectedWorkflows, rows])

  // Publish the filter groups into the shared right panel on mount/change, and unregister them on unmount so a stale filter UI doesn't linger after leaving this table.
  useEffect(() => {
    registerFilters('messages-table', filterGroups)
    return () => unregisterFilters('messages-table')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div className="flex flex-col h-full">

      <ReportTableToolbar
        title={t('messages.title')}
        summary={loading ? t('common.loadingShort') : t('messages.summary', { shown: filtered.length, total: rows.length })}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('messages.search')}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--surface)] rounded-xl"
        style={{ border: '1px solid var(--border)' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <SortableTableHead columns={COLS} sort={sort} onSort={setSort_} />
            <tbody>
              {loading && (
                <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {t('messages.loading')}
                </td></tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {t('messages.empty')}
                </td></tr>
              )}
              {!loading && paged.map((r, i) => (
                  <tr key={r.id ?? i}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDrill(r)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...TD, fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text)' }}>
                        {formatDate(r.sent_at ?? r.created_at)}
                      </div>
                      <Caption as="div">
                        {formatTime(r.sent_at ?? r.created_at)}
                      </Caption>
                    </td>
                    <td style={TD}>
                      <div style={{ fontWeight: 500, color: 'var(--text)' }}>
                        {r.recipient_name ?? '—'}
                      </div>
                      {(r.recipient_email ?? r.recipient_phone) && (
                        <Caption as="div">
                          {r.recipient_email ?? r.recipient_phone}
                        </Caption>
                      )}
                    </td>
                    <td style={TD}><ChannelBadge channel={r.channel} /></td>
                    <td style={{ ...TD, maxWidth: 220 }}>
                      <BodyText as="div" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.subject ?? r.template_name ?? <span style={{ color: 'var(--border)' }}>—</span>}
                      </BodyText>
                    </td>
                    <td style={TD}><StatusBadge status={r.status} /></td>
                    <td style={{ ...TD, fontSize: 12, color: 'var(--text-muted)' }}>
                      {r.workflow_name ?? <span style={{ color: 'var(--border)' }}>—</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar page={page} totalPages={totalPages} totalRows={sorted.length}
        pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />

      {drill && <MessageDrawer message={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}

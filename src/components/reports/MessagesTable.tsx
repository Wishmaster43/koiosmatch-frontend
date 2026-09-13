/**
 * MessagesTable — searchable, sortable, paginated table of sent/received messages
 * (WhatsApp + email). Shows direction, status, channel and contact; filters come
 * from RightPanelContext. Data is fetched per page from the API. The badges +
 * detail drawer live in `./messages/` (messageParts, MessageDrawer). Chrome
 * (sortable header + toolbar) and paging state come from the shared
 * reportTableChrome/useReportPaging (§3, "36-42 identical lines" consolidation).
 */
import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat }      from '@/lib/datetime'
import PaginationBar          from '../ui/PaginationBar'
import { useReportPaging }    from './useReportPaging'
import { TD, SortableTableHead, ReportTableToolbar, ReportRow } from './reportTableChrome'
import { distinctSortedValues } from './distinctSortedValues'
import { useReportTableFilter } from './useReportTableFilter'
import { BodyText, Caption } from '@/components/ui/typography'
import { useReportList }      from './useReportList'
import { buildStatusGroup, buildWorkflowGroup } from './reportFilterDefs'
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
  const { rows, loading, error } = useReportList<MessageRow>('/messages')
  // App-wide active locale (§5) — never a hardcoded 'nl-NL' toLocale*String call.
  const { formatDate, formatTime } = useDateFormat()
  const [search,  setSearch]  = useState('')
  const [drill,   setDrill]   = useState<MessageRow | null>(null)
  const [sort,    setSort]    = useState<SortState>({ key: 'sent_at', dir: 'desc' })
  const [selectedStatuses,  setSelectedStatuses]  = useState<Array<string | number>>([])
  const [selectedChannels,  setSelectedChannels]  = useState<Array<string | number>>([])
  const [selectedWorkflows, setSelectedWorkflows] = useState<Array<string | number>>([])

  // Distinct channel values already loaded client-side seed the right-panel filter — no separate lookup fetch needed.
  const channelOptions  = useMemo(() => distinctSortedValues(rows, r => r.channel), [rows])
  // Same derivation for status: built from the current row set, not a lookup table.
  const statusOptions   = useMemo(() => distinctSortedValues(rows, r => r.status), [rows])
  // Workflow names vary per tenant automation, so the filter list is built from what actually appears in the loaded rows.
  const workflowOptions = useMemo(() => distinctSortedValues(rows, r => r.workflow_name), [rows])

  // Filter predicate: checks panel's status/channel/workflow selections.
  const filterPredicate = useCallback((r: MessageRow) => {
    if (selectedStatuses.length  && !selectedStatuses.includes(r.status as string))        return false
    if (selectedChannels.length  && !selectedChannels.includes(r.channel as string))       return false
    if (selectedWorkflows.length && !selectedWorkflows.includes(r.workflow_name as string)) return false
    return true
  }, [selectedStatuses, selectedChannels, selectedWorkflows])

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
      groups.push(buildStatusGroup(t, statusOptions, selectedStatuses, rows, 'messages.filters.status',
        v => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
        (s: string) => s.toLowerCase?.() ?? s))
    }
    if (workflowOptions.length) {
      groups.push(buildWorkflowGroup(t, workflowOptions, selectedWorkflows, rows, 'messages.filters.workflow',
        v => setSelectedWorkflows(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])))
    }
    return groups
  }, [t, channelOptions, statusOptions, workflowOptions, selectedChannels, selectedStatuses, selectedWorkflows, rows])

  // Consolidates filtered/sorted memo and registers filter groups with the shared panel.
  const { filtered, sorted } = useReportTableFilter({
    rows,
    search,
    sortState: sort,
    filterPredicate,
    searchFields: ['recipient_name', 'recipient_email', 'recipient_phone', 'subject', 'template_name', 'workflow_name'],
    sortKey: sort.key,
    filterGroupsConfig: filterGroups,
    tableId: 'messages-table',
  })

  // Shared paging/sort-toggle state (§3 consolidation) — page resets to 1 on any filter/size change.
  const { page, paged, totalPages, pageSize, handlePageSizeChange, setPage, setSort_ } = useReportPaging(sorted, setSort, 'desc')

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
              {/* A failed load is an ERROR state, never the empty copy (audit r2-ui-states-2). */}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 40, color: error ? 'var(--color-danger-text)' : 'var(--text-muted)' }}>
                  {error ? t('messages.loadError') : t('messages.empty')}
                </td></tr>
              )}
              {!loading && paged.map((r, i) => (
                  <ReportRow key={r.id ?? i} onClick={() => setDrill(r)}>
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
                  </ReportRow>
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

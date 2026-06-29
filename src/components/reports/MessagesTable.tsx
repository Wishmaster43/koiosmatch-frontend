/**
 * MessagesTable — searchable, sortable, paginated table of sent/received messages
 * (WhatsApp + email). Shows direction, status, channel and contact; filters come
 * from RightPanelContext. Data is fetched per page from the API. The badges +
 * detail drawer live in `./messages/` (messageParts, MessageDrawer).
 */
import { useState, useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { useRightPanel }      from '../../context/RightPanelContext'
import { useAuth }            from '../../context/AuthContext'
import api                    from '../../lib/api'
import PaginationBar          from '../ui/PaginationBar'
import { useDefaultPageSize } from '../../lib/usePageSize'
import type { MessageRow, ReportFilterGroup, SortState } from '../../types/reports'
import { ChannelBadge, StatusBadge, SortIcon } from './messages/messageParts'
import MessageDrawer from './messages/MessageDrawer'

const TH: CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
             color: 'var(--text-muted)', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)',
             whiteSpace: 'nowrap', userSelect: 'none' }
const TD: CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)' }

const COL_KEYS = [
  { key: 'sent_at',         tKey: 'sent',      sortable: true },
  { key: 'recipient_name',  tKey: 'recipient', sortable: true },
  { key: 'channel',         tKey: 'channel',   sortable: true },
  { key: 'subject',         tKey: 'subject',   sortable: true },
  { key: 'status',          tKey: 'status',    sortable: true },
  { key: 'workflow_name',   tKey: 'workflow',  sortable: true },
]

export default function MessagesTable() {
  const { t } = useTranslation('reports')
  const COLS = COL_KEYS.map(c => ({ ...c, label: t(`messages.cols.${c.tKey}`) }))
  const [rows,    setRows]    = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [drill,   setDrill]   = useState<MessageRow | null>(null)
  const [sort,    setSort]    = useState<SortState>({ key: 'sent_at', dir: 'desc' })
  const [selectedStatuses,  setSelectedStatuses]  = useState<Array<string | number>>([])
  const [selectedChannels,  setSelectedChannels]  = useState<Array<string | number>>([])
  const [selectedWorkflows, setSelectedWorkflows] = useState<Array<string | number>>([])

  const { registerFilters, unregisterFilters } = useRightPanel()
  const defaultPageSize = useDefaultPageSize()
  const { refreshUser } = useAuth() ?? {}
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  useEffect(() => {
    api.get('/messages')
      .then(res => setRows(res.data?.data ?? res.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const channelOptions  = useMemo(() => [...new Set(rows.map(r => r.channel).filter((x): x is string => Boolean(x)))].sort(), [rows])
  const statusOptions   = useMemo(() => [...new Set(rows.map(r => r.status).filter((x): x is string => Boolean(x)))].sort(), [rows])
  const workflowOptions = useMemo(() => [...new Set(rows.map(r => r.workflow_name).filter((x): x is string => Boolean(x)))].sort(), [rows])

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

  const setSort_ = (key: string) => setSort(prev =>
    prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })

  useEffect(() => setPage(1), [filtered.length, pageSize])
  const paged      = useMemo(() => sorted.slice((page-1)*pageSize, page*pageSize), [sorted, page, pageSize])
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  const handlePageSizeChange = async (n: number) => {
    setPageSize(n)
    try { await api.put('/auth/me', { default_per_page: n }); await refreshUser?.() } catch { /* noop */ }
  }

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

  useEffect(() => {
    registerFilters('messages-table', filterGroups)
    return () => unregisterFilters('messages-table')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{t('messages.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {loading ? t('common.loadingShort') : t('messages.summary', { shown: filtered.length, total: rows.length })}
          </p>
        </div>
        <div className="relative">
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                                     transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('messages.search')}
            style={{ height: 34, width: 260, paddingLeft: 32, paddingRight: 12, fontSize: 13,
                     border: '1px solid var(--border)', borderRadius: 8, outline: 'none', color: 'var(--text)' }} />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--surface)] rounded-xl"
        style={{ border: '1px solid var(--border)' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {COLS.map(col => (
                  <th key={col.key} style={TH} onClick={() => col.sortable && setSort_(col.key)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4,
                                  cursor: col.sortable ? 'pointer' : 'default' }}>
                      {col.label}
                      {col.sortable && <SortIcon active={sort.key === col.key} dir={sort.dir} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
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
                        {(r.sent_at ?? r.created_at)
                          ? new Date((r.sent_at ?? r.created_at) as string).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {(r.sent_at ?? r.created_at)
                          ? new Date((r.sent_at ?? r.created_at) as string).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </div>
                    </td>
                    <td style={TD}>
                      <div style={{ fontWeight: 500, color: 'var(--text)' }}>
                        {r.recipient_name ?? '—'}
                      </div>
                      {(r.recipient_email ?? r.recipient_phone) && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {r.recipient_email ?? r.recipient_phone}
                        </div>
                      )}
                    </td>
                    <td style={TD}><ChannelBadge channel={r.channel} /></td>
                    <td style={{ ...TD, maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    fontSize: 13, color: 'var(--text)' }}>
                        {r.subject ?? r.template_name ?? <span style={{ color: 'var(--border)' }}>—</span>}
                      </div>
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

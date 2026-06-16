/**
 * MessagesTable — searchable, sortable, paginated table of sent/received messages
 * (WhatsApp + email). Shows direction, status, channel and contact; filters come
 * from RightPanelContext. Data is fetched per page from the API.
 */
import { useState, useEffect, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, X,
         MessageCircle, Mail, CheckCheck, Clock, XCircle,
         AlertTriangle, User, Phone } from 'lucide-react'
import { useRightPanel }      from '../../context/RightPanelContext'
import { useAuth }            from '../../context/AuthContext'
import api                    from '../../lib/api'
import PaginationBar          from '../ui/PaginationBar'
import { useDefaultPageSize } from '../../lib/usePageSize'

const PAD = n => String(n).padStart(2, '0')

function formatDT(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return `${PAD(d.getDate())}-${PAD(d.getMonth()+1)}-${d.getFullYear()} ${PAD(d.getHours())}:${PAD(d.getMinutes())}`
}

const CHANNEL_META = {
  whatsapp: { label: 'WhatsApp', bg: '#ECFDF5', color: '#059669', Icon: MessageCircle },
  email:    { label: 'E-mail',   bg: '#EFF6FF', color: '#2563EB', Icon: Mail          },
  sms:      { label: 'SMS',      bg: '#F5F3FF', color: '#6D28D9', Icon: Phone         },
}

const STATUS_META = {
  sent:       { label: 'Verstuurd',  bg: '#F0FDF4', color: '#16A34A', Icon: CheckCheck  },
  delivered:  { label: 'Bezorgd',   bg: '#ECFDF5', color: '#059669', Icon: CheckCheck  },
  read:       { label: 'Gelezen',   bg: '#EFF6FF', color: '#2563EB', Icon: CheckCheck  },
  failed:     { label: 'Mislukt',   bg: '#FEF2F2', color: '#DC2626', Icon: XCircle     },
  pending:    { label: 'In wachtrij', bg: '#F9FAFB', color: '#6B7280', Icon: Clock     },
  bounced:    { label: 'Bounced',   bg: '#FFF7ED', color: '#C2410C', Icon: AlertTriangle },
}

function ChannelBadge({ channel }) {
  const m = CHANNEL_META[channel?.toLowerCase()] ?? { label: channel ?? '—', bg: '#F9FAFB', color: '#6B7280', Icon: MessageCircle }
  const Icon = m.Icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: m.bg, color: m.color,
                   fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      <Icon size={10} />
      {m.label}
    </span>
  )
}

function StatusBadge({ status }) {
  const m = STATUS_META[status?.toLowerCase()] ?? { label: status ?? '—', bg: '#F9FAFB', color: '#6B7280', Icon: Clock }
  const Icon = m.Icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: m.bg, color: m.color,
                   fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      <Icon size={10} />
      {m.label}
    </span>
  )
}

function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown size={12} style={{ color: '#D1D5DB' }} />
  return dir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--color-primary)' }} />
    : <ChevronDown size={12} style={{ color: 'var(--color-primary)' }} />
}

// ─── Drill-down drawer ────────────────────────────────────────────────────────

function MessageDrawer({ message, onClose }) {
  const channelMeta = CHANNEL_META[message.channel?.toLowerCase()] ?? { Icon: MessageCircle, color: 'var(--color-primary)' }
  const ChannelIcon = channelMeta.Icon

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-white"
        style={{ width: 480, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <ChannelIcon size={15} color={channelMeta.color} />
                <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                  {message.subject ?? message.template_name ?? `Bericht #${message.id}`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <ChannelBadge channel={message.channel} />
                <StatusBadge status={message.status} />
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                       borderRadius: 6, marginLeft: 10, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* Ontvanger */}
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
                        letterSpacing: '0.05em', marginBottom: 8 }}>
            Ontvanger
          </div>
          {[
            { icon: User,  label: 'Naam',     value: message.recipient_name },
            { icon: Phone, label: 'Mobiel',   value: message.recipient_phone ?? message.to_phone },
            { icon: Mail,  label: 'E-mail',   value: message.recipient_email ?? message.to_email },
          ].filter(r => r.value).map(r => (
            <div key={r.label} style={{ display: 'flex', gap: 8, padding: '7px 0',
                                        borderBottom: '1px solid #F9FAFB' }}>
              <r.icon size={13} color="#D1D5DB" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: '#9CA3AF', width: 120, flexShrink: 0 }}>{r.label}</span>
              <span style={{ fontSize: 12, color: '#374151' }}>{r.value}</span>
            </div>
          ))}

          {/* Tijdlijn */}
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
                        letterSpacing: '0.05em', marginTop: 20, marginBottom: 8 }}>
            Tijdlijn
          </div>
          {[
            { label: 'Verstuurd op',  value: formatDT(message.sent_at     ?? message.created_at) },
            { label: 'Bezorgd op',    value: formatDT(message.delivered_at) },
            { label: 'Gelezen op',    value: formatDT(message.read_at) },
            { label: 'Workflow',      value: message.workflow_name },
            { label: 'Template',      value: message.template_name },
          ].filter(r => r.value && r.value !== '—').map(r => (
            <div key={r.label} style={{ display: 'flex', gap: 8, padding: '7px 0',
                                        borderBottom: '1px solid #F9FAFB' }}>
              <span style={{ fontSize: 12, color: '#9CA3AF', width: 130, flexShrink: 0 }}>{r.label}</span>
              <span style={{ fontSize: 12, color: '#374151' }}>{r.value}</span>
            </div>
          ))}

          {/* Berichtinhoud */}
          {message.body && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
                            letterSpacing: '0.05em', marginBottom: 8 }}>
                Berichtinhoud
              </div>
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 14px',
                            fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {message.body}
              </div>
            </div>
          )}

          {/* Foutmelding */}
          {message.error_message && (
            <div style={{ marginTop: 16, background: '#FEF2F2', border: '1px solid #FCA5A5',
                          borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <AlertTriangle size={13} color="#DC2626" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#DC2626' }}>Foutmelding</span>
              </div>
              <pre style={{ fontSize: 11, color: '#374151', whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all', margin: 0, fontFamily: 'monospace' }}>
                {message.error_message}
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Tabel ────────────────────────────────────────────────────────────────────

const TH = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
             color: '#9CA3AF', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6',
             whiteSpace: 'nowrap', userSelect: 'none' }
const TD = { padding: '10px 12px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F9FAFB' }

const COLS = [
  { key: 'sent_at',        label: 'Verstuurd',   sortable: true  },
  { key: 'recipient_name', label: 'Ontvanger',   sortable: true  },
  { key: 'channel',        label: 'Kanaal',      sortable: true  },
  { key: 'subject',        label: 'Onderwerp',   sortable: true  },
  { key: 'status',         label: 'Status',      sortable: true  },
  { key: 'workflow_name',  label: 'Workflow',    sortable: true  },
]

export default function MessagesTable() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [drill,   setDrill]   = useState(null)
  const [sort,    setSort]    = useState({ key: 'sent_at', dir: 'desc' })
  const [selectedStatuses,  setSelectedStatuses]  = useState([])
  const [selectedChannels,  setSelectedChannels]  = useState([])
  const [selectedWorkflows, setSelectedWorkflows] = useState([])

  const { registerFilters, unregisterFilters } = useRightPanel()
  const defaultPageSize = useDefaultPageSize()
  const { refreshUser } = useAuth()
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  useEffect(() => {
    api.get('/messages')
      .then(res => setRows(res.data?.data ?? res.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const channelOptions  = useMemo(() => [...new Set(rows.map(r => r.channel).filter(Boolean))].sort(), [rows])
  const statusOptions   = useMemo(() => [...new Set(rows.map(r => r.status).filter(Boolean))].sort(), [rows])
  const workflowOptions = useMemo(() => [...new Set(rows.map(r => r.workflow_name).filter(Boolean))].sort(), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (selectedStatuses.length  && !selectedStatuses.includes(r.status))        return false
      if (selectedChannels.length  && !selectedChannels.includes(r.channel))       return false
      if (selectedWorkflows.length && !selectedWorkflows.includes(r.workflow_name)) return false
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

  const setSort_ = key => setSort(prev =>
    prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })

  useEffect(() => setPage(1), [filtered.length, pageSize])
  const paged      = useMemo(() => sorted.slice((page-1)*pageSize, page*pageSize), [sorted, page, pageSize])
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  const handlePageSizeChange = async (n) => {
    setPageSize(n)
    try { await api.put('/auth/me', { default_per_page: n }); await refreshUser() } catch {}
  }

  const filterGroups = useMemo(() => {
    const groups = []
    if (channelOptions.length) {
      groups.push({
        key: 'channel', label: 'Kanaal',
        selected: selectedChannels,
        options: channelOptions.map(c => ({
          value: c,
          label: CHANNEL_META[c?.toLowerCase()]?.label ?? c,
          count: rows.filter(r => r.channel === c).length,
        })),
        onToggle: v => setSelectedChannels(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      })
    }
    if (statusOptions.length) {
      groups.push({
        key: 'status', label: 'Status',
        selected: selectedStatuses,
        options: statusOptions.map(s => ({
          value: s,
          label: STATUS_META[s?.toLowerCase()]?.label ?? s,
          count: rows.filter(r => r.status === s).length,
        })),
        onToggle: v => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      })
    }
    if (workflowOptions.length) {
      groups.push({
        key: 'workflow', label: 'Workflow', type: 'search-select',
        selected: selectedWorkflows,
        options: workflowOptions.map(w => ({
          value: w, label: w,
          count: rows.filter(r => r.workflow_name === w).length,
        })),
        onToggle: v => setSelectedWorkflows(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      })
    }
    return groups
  }, [channelOptions, statusOptions, workflowOptions, selectedChannels, selectedStatuses, selectedWorkflows, rows])

  useEffect(() => {
    registerFilters('messages-table', filterGroups)
    return () => unregisterFilters('messages-table')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>Details — Berichten</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>
            {loading ? 'Laden…' : `${filtered.length} van ${rows.length} berichten`}
          </p>
        </div>
        <div className="relative">
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                                     transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Zoek op naam, onderwerp, workflow…"
            style={{ height: 34, width: 260, paddingLeft: 32, paddingRight: 12, fontSize: 13,
                     border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', color: '#374151' }} />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden bg-white rounded-xl"
        style={{ border: '1px solid #F3F4F6' }}>
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
                <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                  Berichten ophalen…
                </td></tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                  Geen berichten gevonden
                </td></tr>
              )}
              {!loading && paged.map((r, i) => (
                  <tr key={r.id ?? i}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDrill(r)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...TD, fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 500, color: '#111827' }}>
                        {(r.sent_at ?? r.created_at)
                          ? new Date(r.sent_at ?? r.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {(r.sent_at ?? r.created_at)
                          ? new Date(r.sent_at ?? r.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </div>
                    </td>
                    <td style={TD}>
                      <div style={{ fontWeight: 500, color: '#111827' }}>
                        {r.recipient_name ?? '—'}
                      </div>
                      {(r.recipient_email ?? r.recipient_phone) && (
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                          {r.recipient_email ?? r.recipient_phone}
                        </div>
                      )}
                    </td>
                    <td style={TD}><ChannelBadge channel={r.channel} /></td>
                    <td style={{ ...TD, maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    fontSize: 13, color: '#374151' }}>
                        {r.subject ?? r.template_name ?? <span style={{ color: '#D1D5DB' }}>—</span>}
                      </div>
                    </td>
                    <td style={TD}><StatusBadge status={r.status} /></td>
                    <td style={{ ...TD, fontSize: 12, color: '#6B7280' }}>
                      {r.workflow_name ?? <span style={{ color: '#D1D5DB' }}>—</span>}
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

/**
 * EmailLog — Communicatie → E-mail-log: inkomende + uitgaande e-mails, gekoppeld aan
 * kandidaat/klant. Built on the shared LogView. Graceful: leeg tot de backend
 * `/email-log` levert (message-log met richting/van-naar/onderwerp/entiteit/status).
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { X } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import LogView from '@/components/ui/LogView'
import type { LogExportCol } from '@/components/ui/LogView'
import { DirectionPill, StatusPill, isInbound } from '@/components/ui/logChips'
import type { Column } from '@/components/ui/DataTable'

interface EmailLogEntry {
  id?: string | number
  direction?: string
  from?: string
  to?: string
  subject?: string
  entity_type?: string
  entity_label?: string
  status?: string
  created_at?: string
  body?: string
  [k: string]: unknown
}

// Locale-aware short date-time.
const fmt = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const entityText = (e: EmailLogEntry, t: TFunction<'settings'>) =>
  e.entity_label ?? (e.entity_type ? t(`audit.entity.${e.entity_type.split('\\').pop()?.toLowerCase()}`, { defaultValue: e.entity_type }) : '—')

// Detail panel for one logged e-mail.
function EmailLogDrawer({ entry, onClose }: { entry: EmailLogEntry; onClose: () => void }) {
  const { t } = useTranslation('settings')
  const rows: Array<[string, string]> = [
    [t('log.direction'), isInbound(entry.direction) ? t('log.in') : t('log.out')],
    [t('emailLog.from'), entry.from ?? '—'],
    [t('emailLog.to'), entry.to ?? '—'],
    [t('emailLog.subject'), entry.subject ?? '—'],
    [t('audit.colEntity'), entityText(entry, t)],
    [t('log.status'), entry.status ?? '—'],
    [t('log.date'), fmt(entry.created_at)],
  ]
  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.2)' }} onClick={onClose} />
      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col" style={{ width: 460, background: 'var(--surface)', boxShadow: '-4px 0 30px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{entry.subject || t('emailLog.title')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px 16px', marginBottom: 16 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: 'contents' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{value}</span>
              </div>
            ))}
          </div>
          {entry.body && (
            <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', background: 'var(--hover-bg)', borderRadius: 8, padding: '12px 14px' }}>
              {entry.body}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function EmailLog() {
  const { t } = useTranslation('settings')
  const [rows, setRows] = useState<EmailLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedDir, setSelectedDir] = useState<string[]>([])
  const [selected, setSelected] = useState<EmailLogEntry | null>(null)

  // Load the e-mail log; a missing endpoint yields an empty log (graceful).
  useEffect(() => {
    api.get('/email-log')
      .then(r => setRows(unwrapList<EmailLogEntry>(r).rows))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  // Client-side filter (search + direction) until the backend paginates server-side.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(e => {
      if (selectedDir.length) { const d = isInbound(e.direction) ? 'in' : 'out'; if (!selectedDir.includes(d)) return false }
      if (q) return [e.from, e.to, e.subject, e.entity_label].some(v => (v ?? '').toLowerCase().includes(q))
      return true
    })
  }, [rows, search, selectedDir])

  const columns: Column<EmailLogEntry>[] = [
    { key: 'direction', header: t('log.direction'), width: 120, render: r => <DirectionPill direction={r.direction} /> },
    { key: 'party', header: t('emailLog.party'), render: r => (isInbound(r.direction) ? r.from : r.to) ?? '—' },
    { key: 'subject', header: t('emailLog.subject'), render: r => r.subject ?? '—' },
    { key: 'entity', header: t('audit.colEntity'), render: r => entityText(r, t) },
    { key: 'status', header: t('log.status'), width: 120, render: r => <StatusPill status={r.status} /> },
    { key: 'created_at', header: t('log.date'), width: 150, nowrap: true, render: r => fmt(r.created_at) },
  ]

  const filterGroups = useMemo(() => [
    { key: 'search', label: t('emailLog.searchPlaceholder'), type: 'global-search', value: search, onChange: setSearch },
    { key: 'direction', label: t('log.direction'), type: 'search-select', selected: selectedDir,
      options: [
        { value: 'in',  label: t('log.in'),  count: rows.filter(r => isInbound(r.direction)).length },
        { value: 'out', label: t('log.out'), count: rows.filter(r => !isInbound(r.direction)).length },
      ],
      onToggle: (v: string) => setSelectedDir(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
  ], [t, search, selectedDir, rows])

  const exportColumns: LogExportCol<EmailLogEntry>[] = [
    { header: t('log.direction'), value: r => isInbound(r.direction) ? t('log.in') : t('log.out') },
    { header: t('emailLog.party'), value: r => (isInbound(r.direction) ? r.from : r.to) ?? '' },
    { header: t('emailLog.subject'), value: r => r.subject ?? '' },
    { header: t('audit.colEntity'), value: r => entityText(r, t) },
    { header: t('log.status'), value: r => r.status ?? '' },
    { header: t('log.date'), value: r => fmt(r.created_at) },
  ]

  return (
    <>
      <LogView<EmailLogEntry> rows={filtered} columns={columns} loading={loading} filterKey="email-log"
        filterGroups={filterGroups} getRowId={r => r.id ?? ''} onRowClick={setSelected}
        exportName="email-log" exportColumns={exportColumns} totalCount={rows.length} emptyText={t('emailLog.empty')} />
      {selected && <EmailLogDrawer entry={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

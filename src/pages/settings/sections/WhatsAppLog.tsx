/**
 * WhatsAppLog — WhatsApp → Berichtenlog: inkomende + uitgaande WhatsApp-berichten
 * als audit-stijl log (richting/contact/bericht/status/datum). Built on the shared
 * LogView, reusing the existing WhatsApp message data (which already carries
 * `direction`). Graceful: leeg tot er berichten zijn.
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import LogView from '@/components/ui/LogView'
import type { LogExportCol } from '@/components/ui/LogView'
import { DirectionPill, StatusPill, isInbound } from '@/components/ui/logChips'
import { useWhatsAppData } from '@/pages/whatsapp/hooks/useWhatsAppData'
import type { Column } from '@/components/ui/DataTable'
import type { WaMessage } from '@/types/whatsapp'

const fmt = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const contactOf = (m: WaMessage) => [m.candidate?.first_name, m.candidate?.last_name].filter(Boolean).join(' ') || '—'

export default function WhatsAppLog() {
  const { t } = useTranslation('settings')
  const { messages, loading } = useWhatsAppData()
  const [search, setSearch] = useState('')
  const [selectedDir, setSelectedDir] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])

  const statusOptions = useMemo(() => [...new Set(messages.map(m => m.status).filter(Boolean))] as string[], [messages])

  // Client-side filter (search + direction + status).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return messages.filter(m => {
      if (selectedDir.length) { const d = isInbound(m.direction) ? 'in' : 'out'; if (!selectedDir.includes(d)) return false }
      if (selectedStatus.length && !selectedStatus.includes(m.status ?? '')) return false
      if (q) return [contactOf(m), m.body].some(v => (v ?? '').toLowerCase().includes(q))
      return true
    })
  }, [messages, search, selectedDir, selectedStatus])

  const columns: Column<WaMessage>[] = [
    { key: 'direction', header: t('log.direction'), width: 120, render: m => <DirectionPill direction={m.direction} /> },
    { key: 'contact', header: t('waLog.contact'), width: 180, render: m => contactOf(m) },
    { key: 'body', header: t('waLog.message'), render: m => <span style={{ display: 'block', maxWidth: 460, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.body ?? '—'}</span> },
    { key: 'status', header: t('log.status'), width: 120, render: m => <StatusPill status={m.status} /> },
    { key: 'sent_at', header: t('log.date'), width: 150, nowrap: true, render: m => fmt(m.sent_at) },
  ]

  const filterGroups = useMemo(() => [
    { key: 'search', label: t('waLog.searchPlaceholder'), type: 'global-search', value: search, onChange: setSearch },
    { key: 'direction', label: t('log.direction'), type: 'search-select', selected: selectedDir,
      options: [
        { value: 'in',  label: t('log.in'),  count: messages.filter(m => isInbound(m.direction)).length },
        { value: 'out', label: t('log.out'), count: messages.filter(m => !isInbound(m.direction)).length },
      ],
      onToggle: (v: string) => setSelectedDir(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    ...(statusOptions.length ? [{ key: 'status', label: t('log.status'), type: 'search-select', selected: selectedStatus,
      options: statusOptions.map(s => ({ value: s, label: s, count: messages.filter(m => m.status === s).length })),
      onToggle: (v: string) => setSelectedStatus(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) }] : []),
  ], [t, search, selectedDir, selectedStatus, statusOptions, messages])

  const exportColumns: LogExportCol<WaMessage>[] = [
    { header: t('log.direction'), value: m => isInbound(m.direction) ? t('log.in') : t('log.out') },
    { header: t('waLog.contact'), value: m => contactOf(m) },
    { header: t('waLog.message'), value: m => m.body ?? '' },
    { header: t('log.status'), value: m => m.status ?? '' },
    { header: t('log.date'), value: m => fmt(m.sent_at) },
  ]

  return (
    <LogView<WaMessage> rows={filtered} columns={columns} loading={loading.messages} filterKey="whatsapp-log"
      filterGroups={filterGroups} getRowId={m => m.id ?? ''} exportName="whatsapp-log"
      exportColumns={exportColumns} totalCount={messages.length} emptyText={t('waLog.empty')} />
  )
}

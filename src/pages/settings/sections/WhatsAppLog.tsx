/**
 * WhatsAppLog — WhatsApp → Berichtenlog: inkomende + uitgaande WhatsApp-berichten
 * als audit-stijl log (richting/contact/bericht/status/datum). Built on the shared
 * LogView, reusing the existing WhatsApp message data (which already carries
 * `direction`). Graceful: leeg tot er berichten zijn.
 *
 * Also carries the "Koios conversation memory (days)" tenant setting — how many
 * days of WhatsApp conversation history Koios keeps in context when drafting a
 * reply. Persisted through the generic tenant `/settings` key/value store
 * (SettingController::store accepts any string key up to 10000 chars, no
 * whitelist — verified against koiosmatch-api): local state, optimistic save on
 * blur, revert + toast on failure — mirrors the NumberingSettings/
 * CandidateConversionSettings house pattern.
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import LogView from '@/components/ui/LogView'
import type { LogExportCol } from '@/components/ui/LogView'
import { isInbound } from '@/components/ui/logChips'
import { useWhatsAppData, useMessageColumns } from '@/pages/whatsapp/shared'
import type { WaMessage } from '@/types/whatsapp'
import { useAllSettings, saveSettingsKeys, invalidateAllSettingsCache, getNumberSetting } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'
// WA-LOG-LEESBAAR-1: row click opens the candidate's whole thread, readable.
import WaConversationPanel from './whatsapp/WaConversationPanel'
import { SectionTitle, Caption, GroupLabel } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

// Tenant-setting key — the generic /settings key/value store (no dedicated column).
export const KOIOS_MEMORY_DAYS_KEY = 'koios_conversation_memory_days'
const MEMORY_DAYS_DEFAULT = 90
const MEMORY_DAYS_MIN = 1
const MEMORY_DAYS_MAX = 365

// How many days of WhatsApp history Koios keeps in conversation memory. Commits
// on blur (not per keystroke), optimistic with revert-on-failure.
function ConversationMemoryField() {
  const { t } = useTranslation('settings')
  const settings = useAllSettings()
  const saved = getNumberSetting(settings, KOIOS_MEMORY_DAYS_KEY, MEMORY_DAYS_DEFAULT)
  const [value, setValue] = useState(saved)

  // Persist one clamped value — optimistic, revert + toast on failure (house pattern).
  const commit = async (raw: number) => {
    const clamped = Math.min(MEMORY_DAYS_MAX, Math.max(MEMORY_DAYS_MIN, Number(raw) || MEMORY_DAYS_DEFAULT))
    if (clamped === saved) { setValue(clamped); return }
    setValue(clamped)
    try {
      await saveSettingsKeys({ [KOIOS_MEMORY_DAYS_KEY]: clamped })
      invalidateAllSettingsCache()
    } catch {
      setValue(saved)
      notifyError(t('waLog.memoryDaysSaveFailed'))
    }
  }

  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <SectionTitle as="div" style={{ marginBottom: 4 }}>{t('waLog.memoryDaysTitle')}</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, maxWidth: 460 }}>{t('waLog.memoryDaysHint')}</div>
      <GroupLabel as="label" htmlFor="koios-conversation-memory-days" style={{ display: 'block', marginBottom: 4 }}>
        {t('waLog.memoryDaysLabel')}
      </GroupLabel>
      <input id="koios-conversation-memory-days" type="number" min={MEMORY_DAYS_MIN} max={MEMORY_DAYS_MAX}
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        onBlur={e => commit(Number(e.target.value))}
        style={{ width: 100, height: 32, padding: '0 8px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }} />
    </div>
  )
}

const contactOf = (m: WaMessage) => [m.candidate?.first_name, m.candidate?.last_name].filter(Boolean).join(' ') || '—'

export default function WhatsAppLog() {
  const { t } = useTranslation('settings')
  // K-176 — retention is unlimited; the first page is only the 90-day window,
  // loadMoreMessages pages older ones in on cursor `before=<oldest sent_at>`.
  const { messages, loading, loadMoreMessages, loadingMoreMessages, messagesExhausted } = useWhatsAppData()
  // App-wide active locale (§5) — formatDateTime replaces the old hardcoded 'nl-NL' fmt().
  const { formatDateTime } = useDateFormat()
  const [search, setSearch] = useState('')
  const [selectedDir, setSelectedDir] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  // WA-LOG-LEESBAAR-1: the clicked row whose conversation is open (null = closed).
  const [openThread, setOpenThread] = useState<WaMessage | null>(null)

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

  // WA-MSG-TABLE-1: the shared message column set (date/recipient/direction/
  // status/body/conversation) — the same config the WhatsAppPage Messages tab
  // uses, so the two surfaces never drift. The row click below still opens the
  // full-thread WaConversationPanel; the recipient/conversation cells are the
  // canon CEL-DOORKLIK-CANON gateways straight to the candidate drilldown.
  const columns = useMessageColumns({ clampBody: true })

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

  // One source per label (§5): the CSV header text for direction/status/body/
  // date reuses the SAME shared column headers (`whatsapp` namespace) the table
  // itself renders, instead of a second, independently-translated `settings`
  // copy that could drift from it. Only the direction VALUE labels (in/out)
  // stay on the settings namespace — no shared column exists for them.
  const headerOf = (key: string) => columns.find(c => c.key === key)?.header ?? key
  const exportColumns: LogExportCol<WaMessage>[] = [
    { header: String(headerOf('direction')), value: m => isInbound(m.direction) ? t('log.in') : t('log.out') },
    { header: String(headerOf('recipient')), value: m => contactOf(m) },
    { header: String(headerOf('body')), value: m => m.body ?? '' },
    { header: String(headerOf('status')), value: m => m.status ?? '' },
    { header: String(headerOf('sent_at')), value: m => formatDateTime(m.sent_at) },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ConversationMemoryField />
      <div style={{ flex: 1, minHeight: 0 }}>
        <LogView<WaMessage> rows={filtered} columns={columns} loading={loading.messages} filterKey="whatsapp-log"
          filterGroups={filterGroups} getRowId={m => m.id ?? ''} exportName="whatsapp-log"
          onRowClick={setOpenThread}
          exportColumns={exportColumns} totalCount={messages.length} emptyText={t('waLog.empty')} />
      </div>
      {/* K-176 — honest retention copy: the first 90 days load immediately,
          everything older is still there and loads on demand, never "gone". */}
      {!loading.messages && messages.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 0', flexShrink: 0 }}>
          {messagesExhausted ? (
            <Caption>{t('waLog.loadMoreExhausted')}</Caption>
          ) : (
            <Button variant="secondary" size="sm" onClick={loadMoreMessages} disabled={loadingMoreMessages}>
              {loadingMoreMessages ? <><Spinner size={13} /> {t('waLog.loadingMore')}</> : t('waLog.loadMore')}
            </Button>
          )}
          <Caption>{t('waLog.retentionHint')}</Caption>
        </div>
      )}
      {/* WA-LOG-LEESBAAR-1: the clicked row's whole conversation, full-size. */}
      {openThread && <WaConversationPanel message={openThread} messages={messages} onClose={() => setOpenThread(null)} />}
    </div>
  )
}

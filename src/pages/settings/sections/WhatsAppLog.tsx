/**
 * WhatsAppLog — WhatsApp → Berichtenlog ("Message log"): inkomende + uitgaande
 * WhatsApp-berichten
 * als audit-stijl log (richting/contact/bericht/status/datum) — "incoming +
 * outgoing WhatsApp messages as an audit-style log (direction/contact/
 * message/status/date)". Built on the shared
 * LogView, reusing the existing WhatsApp message data (which already carries
 * `direction`). Graceful: leeg tot er berichten zijn — "empty until there are
 * messages".
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
import { useWhatsAppData, useMessageColumns, WA_STATUS_VALUES } from '@/pages/whatsapp/shared'
import type { WaMessage } from '@/types/whatsapp'
import NumberSettingField from '../components/NumberSettingField'
// WA-LOG-LEESBAAR-1: row click opens the candidate's whole thread, readable.
import WaConversationPanel from './whatsapp/WaConversationPanel'
import { Caption } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

// Tenant-setting key — the generic /settings key/value store (no dedicated column).
export const KOIOS_MEMORY_DAYS_KEY = 'koios_conversation_memory_days'
const MEMORY_DAYS_DEFAULT = 90
const MEMORY_DAYS_MIN = 1
const MEMORY_DAYS_MAX = 365

// A row's recipient name, whichever owner it carries (candidate or customer
// contact) — WA-MSG-TABLE-2 added the contact-owned shape, so this can no
// longer read the candidate side only (search/CSV export both use this).
// Server-validated status vocabulary (mirrors WhatsAppPage.tsx's own const) —
// the SOURCE for the filter values, never derived from loaded rows.

const contactOf = (m: WaMessage) =>
  [m.candidate?.first_name, m.candidate?.last_name].filter(Boolean).join(' ')
  || [m.customer_contact?.first_name, m.customer_contact?.last_name].filter(Boolean).join(' ')
  || '—'

// Bureau-wide WhatsApp message log: server-filtered direction/status plus a client-side search over the loaded page.
export default function WhatsAppLog() {
  const { t } = useTranslation('settings')
  const [search, setSearch] = useState('')
  const [selectedDir, setSelectedDir] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  // WA-LOG-LEESBAAR-1: the clicked row whose conversation is open (null = closed).
  const [openThread, setOpenThread] = useState<WaMessage | null>(null)

  // K-176 — retention is unlimited; the first page is only the 90-day window,
  // loadMoreMessages pages older ones in on cursor `before=<oldest sent_at>` and
  // carries the same params. WA-MSG-TABLE-1 stage B: direction/status now reach
  // the request as real server params instead of a client-side sieve; only the
  // search box stays client-side over the already-loaded page (no server search
  // param exists on GET /whatsapp/messages).
  const { messages, loading, loadMoreMessages, loadingMoreMessages, messagesExhausted } = useWhatsAppData({
    direction: selectedDir.length ? [selectedDir[0] === 'in' ? 'inbound' : 'outbound'] : undefined,
    status: selectedStatus,
  })
  // App-wide active locale (§5) — formatDateTime replaces the old hardcoded 'nl-NL' fmt().
  const { formatDateTime } = useDateFormat()

  // WA_STATUS_VALUES mirrors the server's own `in:` validation vocabulary
  // (WhatsappDashboardController) — a FIXED list, not derived from the current
  // (already status-filtered) page, so a selected status never hides its own
  // sibling options from the panel.
  const statusOptions = WA_STATUS_VALUES

  // Client-side search only — direction/status are already applied server-side.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return messages
    return messages.filter(m => [contactOf(m), m.body].some(v => (v ?? '').toLowerCase().includes(q)))
  }, [messages, search])

  // WA-MSG-TABLE-1: the shared message column set (date/recipient/direction/
  // status/body/conversation) — the same config the WhatsAppPage Messages tab
  // uses, so the two surfaces never drift. The row click below still opens the
  // full-thread WaConversationPanel; the recipient/conversation cells are the
  // canon CEL-DOORKLIK-CANON gateways straight to the candidate drilldown.
  const columns = useMessageColumns({ clampBody: true })

  // Assemble the right-hand filter panel groups for this log (search + direction + status).
  const filterGroups = useMemo(() => [
    { key: 'search', label: t('waLog.searchPlaceholder'), type: 'global-search', value: search, onChange: setSearch },
    // WA-MSG-TABLE-1 stage B: direction/status are now server params (the
    // endpoint validates both as SCALARS, `in:...`) — single-select toggle
    // (pick replaces, re-pick clears), no per-option counts: the currently
    // loaded page is already filtered server-side, so a client-side count
    // over it would misrepresent the OTHER option's real total.
    { key: 'direction', label: t('log.direction'), type: 'search-select', selected: selectedDir,
      options: [{ value: 'in', label: t('log.in') }, { value: 'out', label: t('log.out') }],
      onToggle: (v: string) => setSelectedDir(p => p[0] === v ? [] : [v]) },
    { key: 'status', label: t('log.status'), type: 'search-select', selected: selectedStatus,
      // Same translated label as the status column itself (§5) — never the raw enum slug.
      options: statusOptions.map(s => ({ value: s, label: t(`whatsapp:msgStatus.${s}`, { defaultValue: s }) })),
      onToggle: (v: string) => setSelectedStatus(p => p[0] === v ? [] : [v]) },
  ], [t, search, selectedDir, selectedStatus, statusOptions])

  // One source per label (§5): the CSV header text for every column reuses the
  // SAME shared column headers (`whatsapp` namespace) the table itself renders,
  // instead of a second, independently-translated `settings` copy that could
  // drift from it. Only the direction VALUE labels (in/out) stay on the
  // settings namespace — no shared column exists for them.
  const headerOf = (key: string) => columns.find(c => c.key === key)?.header ?? key
  // Every value goes through the SAME translation the table cell renders — a
  // server enum/slug (status/purpose) is never exported raw (§5 canon).
  const exportColumns: LogExportCol<WaMessage>[] = [
    { header: String(headerOf('direction')), value: m => isInbound(m.direction) ? t('log.in') : t('log.out') },
    { header: String(headerOf('recipient')), value: m => contactOf(m) },
    { header: String(headerOf('channel')), value: m => m.channel_label ?? m.channel ?? '' },
    { header: String(headerOf('type')), value: m => m.message_type?.label ?? '' },
    { header: String(headerOf('purpose')), value: m => m.purpose ? t(`candidates:conversations.purpose.${m.purpose}`, { defaultValue: m.purpose }) : '' },
    { header: String(headerOf('template')), value: m => m.template_name ?? '' },
    { header: String(headerOf('body')), value: m => m.body ?? '' },
    { header: String(headerOf('status')), value: m => t(`whatsapp:msgStatus.${m.status}`, { defaultValue: m.status ?? '' }) },
    { header: String(headerOf('sentBy')), value: m => m.sent_by_user?.name ?? t('whatsapp:messages.automatic') },
    { header: String(headerOf('sent_at')), value: m => formatDateTime(m.sent_at) },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <NumberSettingField id="koios-conversation-memory-days" settingsKey={KOIOS_MEMORY_DAYS_KEY}
        title={t('waLog.memoryDaysTitle')} hint={t('waLog.memoryDaysHint')}
        label={t('waLog.memoryDaysLabel')} saveFailedMessage={t('waLog.memoryDaysSaveFailed')}
        defaultValue={MEMORY_DAYS_DEFAULT} min={MEMORY_DAYS_MIN} max={MEMORY_DAYS_MAX}
        style={{ flexShrink: 0 }} />
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
      {/* WA-MSG-TABLE-2: the panel now fetches its own thread by conversation_id. */}
      {openThread && <WaConversationPanel message={openThread} onClose={() => setOpenThread(null)} />}
    </div>
  )
}

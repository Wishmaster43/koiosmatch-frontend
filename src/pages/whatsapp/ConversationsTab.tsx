/**
 * ConversationsTab — K-193/K-194: the bureau-wide WhatsApp inbox. A DataTable
 * of threads from GET /conversations (filters live in the right panel, §3A),
 * row click opens a read-only thread drill-down on the shared EntityDrawer
 * shell. The composer itself is NOT lifted here (ConversationsSection's send
 * flow is entangled with its own accordion state) — the drawer instead offers
 * a Button that jumps to the candidate's own Communicatie tab, where the real
 * composer already lives (§0 no fake affordances: a control here would either
 * duplicate that flow or silently do nothing).
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronUp, MessageCircle, X } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useNavigation } from '@/context/NavigationContext'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import ConversationMessage from '@/components/drawer/ConversationMessage'
import SoftChip from '@/components/ui/SoftChip'
import EntityLink from '@/components/ui/EntityLink'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { Caption, BodyText, SectionTitle } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { CHANNEL_COLORS } from '@/components/drawer/channelColors'
import api, { unwrap } from '@/lib/api'
import { useConversations } from './hooks/useConversations'
import type { WaConversationRow } from './hooks/useConversations'
import { useConversationThread } from './hooks/useConversationThread'
import { buildConversationFilterGroups } from './data/conversationFilterGroups'

// The name/label the row is known by: candidate first, contact second, raw number last.
const counterpartName = (row: WaConversationRow) =>
  row.candidate?.full_name || row.customer_contact?.full_name || row.owner?.name || row.wa_number || '—'

// Bureau-wide WhatsApp inbox: a thread table plus a read-only thread drill-down; the real composer lives on the candidate/contact record, deep-linked from here.
export default function ConversationsTab({ openConversationId }: { openConversationId?: string | null }) {
  const { t } = useTranslation('whatsapp')
  const { formatDateTime } = useDateFormat()
  const { openEntity } = useNavigation()
  const { registerFilters, unregisterFilters } = useRightPanel()
  const [escalated, setEscalated] = useState(false)
  const [unanswered, setUnanswered] = useState(false)
  const [active, setActive] = useState(false)
  const [search, setSearch] = useState('')
  // Debounce the server-side search (§9): the panel input stays instantly
  // responsive, but the PII-bearing GET /conversations request only fires
  // 300ms after the user stops typing.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // Debounce the search value before it reaches the server-side filter (300ms after typing stops).
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(id)
  }, [search])
  const [selectedId, setSelectedId] = useState<string | null>(openConversationId ?? null)

  const { data: rows = [], isLoading, isError } = useConversations({ escalated, unanswered, active, search: debouncedSearch || undefined })
  const thread = useConversationThread(selectedId)

  // K-193: only this tab's dimensions register while it is active — never a toolbar control (§3A).
  const filterGroups = useMemo(() => buildConversationFilterGroups({
    t, escalated, setEscalated, unanswered, setUnanswered, active, setActive, search, setSearch,
  }), [t, escalated, unanswered, active, search])
  // Register this tab's own filter dimensions with the shared right-hand panel while it is active.
  useEffect(() => {
    registerFilters('whatsapp-conversations', filterGroups)
    return () => unregisterFilters('whatsapp-conversations')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Deep link (dashboard tile, F1A intent contract): opening the tab with a target id.
  useEffect(() => { if (openConversationId) setSelectedId(openConversationId) }, [openConversationId])

  // A deep link may target a thread outside the loaded page: fetch that one row
  // itself so the drawer opens instead of silently doing nothing.
  const [fallbackRow, setFallbackRow] = useState<WaConversationRow | null>(null)
  const inPage = selectedId != null && rows.some(r => r.id === selectedId)
  // A deep-linked thread outside the loaded page: fetch it directly so the drawer still opens instead of doing nothing.
  useEffect(() => {
    if (selectedId == null || inPage) return
    let alive = true
    api.get(`/conversations/${selectedId}`)
      .then(r => { if (alive) setFallbackRow(unwrap(r) as WaConversationRow) })
      .catch(() => { if (alive) setFallbackRow(null) })
    return () => { alive = false }
  }, [selectedId, inPage])
  const selectedRow = rows.find(r => r.id === selectedId) ?? (fallbackRow && fallbackRow.id === selectedId ? fallbackRow : null)

  const columns: Column<WaConversationRow>[] = [
    {
      // CEL-DOORKLIK-CANON (§3A): both counterpart kinds deep-link somewhere —
      // a candidate opens its own page, a customer contact has no page of its
      // own so it opens the owning customer's Contacts tab.
      key: 'counterpart', header: t('conversations.column.counterpart'),
      render: r => {
        if (r.candidate?.id) {
          return <EntityLink page="candidates" id={r.candidate.id} hideIcon>{counterpartName(r)}</EntityLink>
        }
        if (r.customer_contact?.id) {
          return (
            <Button variant="ghost" size="sm" style={{ padding: 0, height: 'auto', fontWeight: 400 }}
              onClick={e => { e.stopPropagation(); openEntity('customers', r.customer_contact!.customer_id, 'contacts') }}>
              {counterpartName(r)}
            </Button>
          )
        }
        return counterpartName(r)
      },
    },
    { key: 'wa_number', header: t('conversations.column.number'), render: r => r.wa_number ?? '—' },
    {
      key: 'channel', header: t('conversations.column.channel'),
      render: r => r.primary_channel && CHANNEL_COLORS[r.primary_channel]
        ? <SoftChip label={t(`candidates:conversations.channel.${r.primary_channel}`, { defaultValue: r.channel_label ?? '' })} color={CHANNEL_COLORS[r.primary_channel]} />
        : '—',
    },
    {
      key: 'last_message', header: t('conversations.column.lastMessage'), sortable: true,
      sortValue: r => r.last_message_at ?? null,
      render: r => r.last_message_at ? formatDateTime(r.last_message_at) : '—',
    },
    {
      key: 'flags', header: t('conversations.column.flags'),
      render: r => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {/* A count/flag badge never renders when false — an inactive chip is simply absent (§SCHERMWAARHEID). */}
          {r.awaiting_reply && <SoftChip label={t('conversations.flagUnanswered')} color="var(--color-warning)" />}
          {r.escalated && <SoftChip label={t('conversations.flagEscalated')} color="var(--color-danger)" />}
        </div>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', gap: 12 }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DataTable columns={columns} rows={rows} loading={isLoading}
          loadingText={t('conversations.loading')}
          emptyText={isError ? t('conversations.error') : t('conversations.empty')}
          selectedId={selectedId} onRowClick={r => setSelectedId(r.id)} />
      </div>

      {selectedRow && (
        <EntityDrawer
          entity={selectedRow}
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12 }}>
              <MessageCircle size={16} style={{ color: 'var(--color-success-text)', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <SectionTitle style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {counterpartName(selectedRow)}
                </SectionTitle>
                <Caption as="div">{selectedRow.wa_number ?? '—'}</Caption>
              </div>
              {selectedRow.primary_channel && CHANNEL_COLORS[selectedRow.primary_channel] && (
                <SoftChip label={t(`candidates:conversations.channel.${selectedRow.primary_channel}`, { defaultValue: selectedRow.channel_label ?? '' })}
                  color={CHANNEL_COLORS[selectedRow.primary_channel]} />
              )}
              {/* data-drawer-close: the shared EntityDrawer/Escape-key contract (§ SWEEP-ESC), mirrors EntityHeader's own close button. */}
              <Button variant="ghost" iconOnly onClick={() => setSelectedId(null)} aria-label={t('common:close')} data-drawer-close>
                <X size={14} />
              </Button>
            </div>
          }
          tabs={[{
            id: 'thread', label: t('conversations.tabThread'),
            render: () => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Read-only drill-down (§0 no fake affordances): the real composer
                    lives on the candidate dossier or the customer's contact record,
                    deep-linked below. */}
                {selectedRow.candidate?.id && (
                  <Button size="sm" variant="secondary"
                    onClick={() => openEntity('candidates', selectedRow.candidate!.id, 'communication')}>
                    {t('conversations.openInDossier')}
                  </Button>
                )}
                {!selectedRow.candidate?.id && selectedRow.customer_contact?.id && (
                  <Button size="sm" variant="secondary"
                    onClick={() => openEntity('customers', selectedRow.customer_contact!.customer_id, 'contacts')}>
                    {t('conversations.openInDossier')}
                  </Button>
                )}
                {thread.hasOlder && (
                  <Button size="sm" variant="ghost" onClick={thread.loadOlder} disabled={thread.loadingOlder}
                    style={{ alignSelf: 'center' }}>
                    {thread.loadingOlder ? <Spinner size={12} /> : <ChevronUp size={12} />} {t('conversations.loadOlder')}
                  </Button>
                )}
                {thread.loading && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner size={16} /></div>
                )}
                {!thread.loading && thread.error && (
                  <BodyText style={{ color: 'var(--color-danger-text)', textAlign: 'center' }}>{t('conversations.threadError')}</BodyText>
                )}
                {!thread.loading && !thread.error && thread.messages.length === 0 && (
                  <BodyText style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{t('conversations.noMessages')}</BodyText>
                )}
                {thread.messages.map(m => (
                  <ConversationMessage key={m.id} message={m} formatDateTime={formatDateTime} />
                ))}
              </div>
            ),
          }]}
        />
      )}
    </div>
  )
}

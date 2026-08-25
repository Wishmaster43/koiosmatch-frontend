/**
 * MessagesTable — the "Messages" tab table (Berichten), built on the shared
 * DataTable + message column config (§3A CEL-DOORKLIK-CANON: every cell that
 * refers to more is a gateway, never a dead end). Replaces the old
 * non-clickable MessageFeed list. "Load more" mirrors the settings log's
 * existing cursor-paging idiom (K-176).
 */
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { Caption } from '@/components/ui/typography'
import { useMessageColumns } from './messageColumns'
import type { MessageFilterPatch } from './messageColumns'
import type { WaMessage } from '@/types/whatsapp'

interface MessagesTableProps {
  messages: WaMessage[]
  loading?: boolean
  onLoadMore?: () => void
  loadingMore?: boolean
  exhausted?: boolean
  // Stage B (WA-MSG-TABLE-1): the type/template chip gateway into the page's
  // own right-panel filter state — omitted, the chips render inert.
  onFilter?: (patch: MessageFilterPatch) => void
}

export default function MessagesTable({ messages, loading, onLoadMore, loadingMore, exhausted, onFilter }: MessagesTableProps) {
  const { t } = useTranslation('whatsapp')
  const columns = useMessageColumns({ onFilter })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <DataTable<WaMessage> columns={columns} rows={messages} getRowId={m => m.id ?? ''}
        loading={loading} emptyText={t('feed.empty')} />
      {/* Load-more (K-176 idiom): only shown once there is something loaded and a
          loader was actually wired in (the KPI drill drawer omits it on purpose). */}
      {!loading && messages.length > 0 && onLoadMore && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {exhausted ? (
            <Caption>{t('messages.loadMoreExhausted')}</Caption>
          ) : (
            <Button variant="secondary" size="sm" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? <><Spinner size={13} /> {t('messages.loadingMore')}</> : t('messages.loadMore')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

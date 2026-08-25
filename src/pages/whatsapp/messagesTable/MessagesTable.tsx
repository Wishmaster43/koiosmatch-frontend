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
import type { WaMessage } from '@/types/whatsapp'

interface MessagesTableProps {
  messages: WaMessage[]
  loading?: boolean
  onLoadMore?: () => void
  loadingMore?: boolean
  exhausted?: boolean
}

export default function MessagesTable({ messages, loading, onLoadMore, loadingMore, exhausted }: MessagesTableProps) {
  const { t } = useTranslation('whatsapp')
  const columns = useMessageColumns()
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

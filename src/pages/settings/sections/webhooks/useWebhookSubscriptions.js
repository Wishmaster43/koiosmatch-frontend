/**
 * useWebhookSubscriptions — loads the outgoing-webhook list and exposes optimistic
 * list mutations, mirroring useApiKeys so the list/detail views stay in sync.
 */
import { useOptimisticList } from '@/hooks/useOptimisticList'
import { listSubscriptions } from './webhooksApi'

// Outgoing-webhook list + optimistic mutations (see file docblock above),
// mirroring useApiKeys so list/detail views stay in sync.
export function useWebhookSubscriptions() {
  const { items: subs, loading, error, reload, add, patch, drop } = useOptimisticList(listSubscriptions)
  return { subs, loading, error, reload, add, patch, drop }
}

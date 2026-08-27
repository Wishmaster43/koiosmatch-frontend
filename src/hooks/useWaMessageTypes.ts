/**
 * useWaMessageTypes — the tenant WhatsApp message-type lookup (GET
 * /whatsapp-message-types, StatusListEditor-backed: id/value/label/color/
 * is_priority). Lives in src/hooks because TWO areas consume it — the WhatsApp
 * page filters and the reports right-panel type[] filter (BARREL-DATETIME rule:
 * shared machinery never rides an entity barrel). Cached via React Query so all
 * consumers share one fetch.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { WaMessageType } from '@/types/whatsapp'

const EMPTY_TYPES: WaMessageType[] = []

// Tenant message-type lookup — the exact shape embedded on a message row's `message_type`.
export function useWaMessageTypes() {
  return useQuery({
    queryKey: ['whatsapp-message-types'],
    queryFn: async ({ signal }) => unwrapList<WaMessageType>(await api.get('/whatsapp-message-types', { signal })).rows,
    placeholderData: EMPTY_TYPES,
  })
}

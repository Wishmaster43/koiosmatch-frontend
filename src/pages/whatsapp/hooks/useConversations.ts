/**
 * useConversations — data layer for the bureau-wide Conversations tab (K-193/
 * K-194): GET /conversations with the server-side filters ConversationController
 * ::index validates (status/escalated/search/unanswered/active). Row shape is
 * measured against ConversationResource (koiosmatch-api) — the owner block is
 * the thread's CANDIDATE/CONTACT identity (`ownerShape`), not a recruiter (the
 * backend explicitly has no thread-owning user, CONTRACT-CHANGELOG 25-08).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'

export interface WaConversationOwner { type: 'candidate' | 'customer_contact'; id: string; name?: string | null }
export interface WaConversationCandidate { id: string; first_name?: string | null; last_name?: string | null; full_name?: string | null; source?: string }
export interface WaConversationContact { id: string; first_name?: string | null; last_name?: string | null; full_name?: string | null; customer_id: string }

export interface WaConversationRow {
  id: string
  candidate_id?: string | null
  customer_contact_id?: string | null
  wa_number?: string | null
  primary_channel?: 'waba' | 'waba_coex' | 'wa_web' | string
  channel_label?: string | null
  last_message_preview?: string | null
  last_message_direction?: 'inbound' | 'outbound' | string | null
  last_message_at?: string | null
  last_inbound_at?: string | null
  window_open?: boolean
  awaiting_reply?: boolean
  escalated?: boolean
  is_active?: boolean
  candidate?: WaConversationCandidate | null
  customer_contact?: WaConversationContact | null
  owner?: WaConversationOwner | null
}

export interface WaConversationFilters {
  status?: string
  escalated?: boolean
  unanswered?: boolean
  active?: boolean
  search?: string
}

export function useConversations(filters: WaConversationFilters) {
  return useQuery({
    queryKey: ['wa-conversations', filters],
    queryFn: async ({ signal }) => {
      const params = {
        per_page: 50,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.escalated ? { escalated: true } : {}),
        ...(filters.unanswered ? { unanswered: true } : {}),
        ...(filters.active ? { active: true } : {}),
        ...(filters.search ? { search: filters.search } : {}),
      }
      const res = await api.get('/conversations', { params, signal })
      return unwrapList<WaConversationRow>(res).rows
    },
  })
}

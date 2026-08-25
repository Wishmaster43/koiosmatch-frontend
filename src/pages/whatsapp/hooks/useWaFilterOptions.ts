/**
 * useWaFilterOptions — the lookup data behind the WhatsApp messages right-panel
 * filters (WA-MSG-TABLE-1 stage B): tenant message types (GET /whatsapp-message-
 * types), the tenant message-purpose lookup (GET /message-purposes, the same
 * endpoint whatsapp_send/email_send workflow modules already read) and active
 * sender numbers (GET /whatsapp-phone-numbers), all cached via React Query
 * (§1 K-33) so the panel and the workflow builder share one fetch. Kept in its
 * own hook (§0.3) so WhatsAppPage.tsx stays a thin wire-up.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { WaMessageType } from '@/types/whatsapp'
import type { WaTemplateOption } from '@/components/layout/workflow/whatsappTemplate'

// GET /whatsapp-phone-numbers option shape (same as useWhatsAppTemplateSend).
export interface WaPhoneNumberOption { value: string; label: string }

// GET /message-purposes tenant-lookup shape (mirrors WaMessageType: a tenant
// can add/relabel/recolour a purpose, so `label` is the tenant's own text).
export interface WaMessagePurposeOption { value: string; label: string; color?: string | null }

const EMPTY_TYPES: WaMessageType[] = []
const EMPTY_NUMBERS: WaPhoneNumberOption[] = []
const EMPTY_PURPOSES: WaMessagePurposeOption[] = []
const EMPTY_TEMPLATES: WaTemplateOption[] = []

// Tenant message-type lookup (StatusListEditor-backed) — id/value/label/color/
// is_priority, the exact shape embedded on a message row's `message_type`.
export function useWaMessageTypes() {
  return useQuery({
    queryKey: ['whatsapp-message-types'],
    queryFn: async ({ signal }) => unwrapList<WaMessageType>(await api.get('/whatsapp-message-types', { signal })).rows,
    placeholderData: EMPTY_TYPES,
  })
}

// Tenant message-purpose lookup — replaces the old fixed 8-slug list so a
// tenant-added or relabelled purpose is filterable and shows its own label.
export function useWaMessagePurposes() {
  return useQuery({
    queryKey: ['message-purposes'],
    queryFn: async ({ signal }) => unwrapList<WaMessagePurposeOption>(await api.get('/message-purposes', { signal })).rows,
    placeholderData: EMPTY_PURPOSES,
  })
}

// Approved template names (GET /whatsapp-templates, same endpoint the send
// composer reads) — the authoritative template vocabulary, so the `template`
// filter never collapses to only the currently-loaded rows' names.
export function useWaTemplates() {
  return useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async ({ signal }) => unwrapList<WaTemplateOption>(await api.get('/whatsapp-templates', { signal })).rows,
    placeholderData: EMPTY_TEMPLATES,
  })
}

// Active WhatsApp sender numbers — the same endpoint the send-step and
// StartConversationModal already read (never a second numbers source).
export function useWaPhoneNumbers() {
  return useQuery({
    queryKey: ['whatsapp-phone-numbers'],
    queryFn: async ({ signal }) => unwrapList<WaPhoneNumberOption>(await api.get('/whatsapp-phone-numbers', { signal })).rows,
    placeholderData: EMPTY_NUMBERS,
  })
}

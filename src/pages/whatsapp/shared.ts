/**
 * whatsapp — PUBLIC surface (§2 barrel decision, Danny 21-08).
 * Everything another entity may import from this folder lives HERE; anything
 * not exported below is internal and off-limits cross-entity (lint-enforced).
 * Whoever changes a module re-exported here knows outsiders ride along —
 * extend this list deliberately, never bypass it with a deep import.
 */
export { useWhatsAppData } from './hooks/useWhatsAppData'
export type { WaMessageFilters } from './hooks/useWhatsAppData'
// The one message-table column config, reused by the settings WhatsApp log
// (WhatsAppLog.tsx) — never re-derived per screen.
export { useMessageColumns } from './messagesTable/messageColumns'

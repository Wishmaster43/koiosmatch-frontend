/**
 * Every notification type the backend catalogue (lang/nl/notifications.php) can send has its
 * title/body in all seven FE locales, so the bell never falls back to a bureau-language literal
 * (ONIX J-007). The key list is a committed snapshot because the FE CI cannot read the api repo.
 */
import { describe, it, expect } from 'vitest'
import snapshot from './notificationsCatalogueKeys.json'

const LANGS = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pt'] as const
const mods = import.meta.glob('./locales/*/notifications.json', { eager: true, import: 'default' }) as Record<string, unknown>

// Known gaps: BE types the FE has not mirrored yet. Shrink this list, never grow it.
const KNOWN_MISSING = new Set([
  'whatsapp_web.repair_required.title', 'whatsapp_web.repair_required.body',
  'match.contract_unconfirmed.title', 'match.contract_unconfirmed.body',
  'invoice.unconfirmed.title', 'invoice.unconfirmed.body',
  'candidate.retention_ask_undelivered.title', 'candidate.retention_ask_undelivered.body',
  'workflow.not_informed.body', 'workflow.not_informed_whatsapp.body',
  'workflow.stale_digest.title', 'workflow.stale_digest.body',
  'retention_entity_erase_blocked.title', 'retention_entity_erase_blocked.body',
  'email.mailbox_needs_reconnect.title', 'email.mailbox_needs_reconnect.body',
])

const has = (root: unknown, key: string): boolean => {
  let cur: unknown = root
  for (const part of key.split('.')) {
    if (!cur || typeof cur !== 'object' || !(part in (cur as object))) return false
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string'
}

describe('notification catalogue parity', () => {
  it.each(LANGS)('%s carries every non-allowlisted backend leaf key', l => {
    const root = mods[`./locales/${l}/notifications.json`]
    const missing = (snapshot as string[]).filter(k => !KNOWN_MISSING.has(k) && !has(root, k))
    expect(missing).toEqual([])
  })
})

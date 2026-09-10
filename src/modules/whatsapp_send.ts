// whatsapp_send module — send a WhatsApp message to a candidate (requires the WhatsApp app).
import { MessageCircle } from 'lucide-react'
// HUISSTIJL-1: the §4 soft-tint formula lives in lib/tint, never a hand-rolled
// color-mix literal per module (herhaal-slotaudit r3).
import { tint } from '@/lib/tint'
import { MESSAGING_LANGUAGES } from './messagingLanguages'

// WA-RECIPIENT-FIELD-1 (CMBE addendum 3, 10-09): the backend answers 422
// recipient_field_not_a_field on a literal number; a value that reads as one
// (digits, +, spaces, dashes, parentheses) is named here before the save.
const looksLikePhoneNumber = (value: unknown): string | null =>
  typeof value === 'string' && /^\s*\+?[0-9][0-9\s().-]{5,}\s*$/.test(value) ? 'Dit lijkt een telefoonnummer. Vul de veldnaam van het bronrecord in, bijv. mobile.' : null

export default {
  type:  'whatsapp_send',
  module: 'whatsapp',
  category: 'Communicatie',
  label: 'WhatsApp Sturen',
  Icon:  MessageCircle,
  color: 'var(--module-green)',
  bg:    tint('var(--module-green)', 12),
  schema: [
    // WF-BUILDER-VELDEN-1: WhatsAppSendModule::configSchema()'s tenant-lookup-driven
    // message purpose (message_purposes, same lookup as email_send's `purpose`) — the
    // badge/filter label on the sent message, never a hardcoded option list.
    { key: 'purpose',              label: 'Berichtdoel',           type: 'lookup_select', endpoint: '/message-purposes', default: 'manual' },
    // WhatsApp send FORMAT; key stays as the BE contract expects.
    // 'session' = free-form text, only delivered inside Meta's 24h customer-service
    // window (the BE gates on the conversation's last inbound message). CMBE K-193
    // fase 2b: WhatsApp Web can only ever send a session message — the builder
    // auto-sets this (never silently) when `channel` becomes 'wa_web' (ConfigPanel).
    { key: 'message_type',        label: 'Formaat',                type: 'select',  options: ['template','flow','session'],
      help: 'Via WhatsApp Web kan alleen een sessiebericht (vrije tekst) worden verstuurd.' },
    // CMBE K-193 fase 0 contract: which WhatsApp channel this step sends over.
    // No `default` on purpose (Danny: no silent fallback to 'waba' in the
    // builder) — the blank placeholder forces an explicit choice, and it
    // filters the sender-number list below when Coexistence is picked.
    { key: 'channel',             label: 'Kanaal',                 type: 'select',  required: true,
      options: ['waba', 'waba_coex', 'wa_web'] },
    // CMBE K-193 fase 2b: which connected WhatsApp Web device sends this step's
    // message — a tenant/user's own device or a branch-shared one. Only shown for
    // the 'wa_web' channel; `phone_number_id` below is ignored server-side then.
    { key: 'whatsapp_number_id',  label: 'Gekoppeld nummer',       type: 'lookup_select', endpoint: '/whatsapp-web-numbers', required: true,
      showIf: { key: 'channel', value: 'wa_web' },
      help: 'Alleen gekoppelde WhatsApp Web-nummers (eigen of vestiging).' },
    // Live options from the tenant's WABA connection (Make parity): active sender
    // numbers + approved templates (the endpoint also returns each template's
    // components for the future per-{{n}} mapping UI). Filtered to Coexistence
    // numbers when `channel` is 'waba_coex'; hidden entirely for 'wa_web', where
    // the whatsapp_number_id field above is authoritative and this key is ignored.
    // `undefined` is included alongside the two enum values: the `channel` field
    // deliberately carries no builder default (no silent 'waba' fallback), but the
    // BACKEND defaults a missing/legacy channel to 'waba' and still requires this
    // field there — an unset channel must not hide an already-stored sender.
    { key: 'phone_number_id',     label: 'Afzender',               type: 'whatsapp_phone_number', endpoint: '/whatsapp-phone-numbers',
      showIf: { key: 'channel', value: ['waba', 'waba_coex', undefined] },
      // WA-SCOPE-2: an empty sender falls back automatically (branch first, then the tenant default).
      help: 'Leeg laten betekent automatisch: eerst de vestiging, anders de standaard.' },
    // Recipient override: empty = each bundle's own mobile; otherwise the NAME of
    // the source record's field that holds the number (mobile, phone, …). The
    // 2026-07-09 "own 06 = test mode" redirect is gone: the backend rejects a
    // literal number (WA-RECIPIENT-FIELD-1) and manual sending is its own route
    // (WA-SEND-1, rows 52/54). The picker inserts a bare field name ('path').
    { key: 'recipient_field',     label: 'Ontvanger',              type: 'text', insertMode: 'path' as const,
      placeholder: 'leeg = mobiel van de kandidaat · anders de veldnaam, bijv. mobile',
      help: 'Een veldnaam van het bronrecord (mobile, phone, …), nooit een telefoonnummer. Handmatig versturen doe je vanaf het record zelf.',
      validate: looksLikePhoneNumber },
    // Template picker + per-{{n}} variable mapping + live preview (WhatsappTemplateField).
    // Persists template_name/header_variables/variables/language in the same shape as the
    // old lookup_select + two textareas (ONE PER LINE → {{1}},{{2}},…); only shown for the
    // 'template' format, mirroring session_text's own showIf below.
    { key: 'template_name',       label: 'Template',               type: 'whatsapp_template',
      showIf: { key: 'message_type', value: 'template' } },
    // WA-SEND-FIELDS-2: WhatsAppSendModule::configSchema's 'flow'-only field — an
    // ORDERED list of {{1}}, {{2}}, … values passed to a WhatsApp Flow message
    // (mirrors the engine's `default: [{ value: '{{firstname}}' }]`).
    { key: 'body_parameters',     label: 'Body parameters',        type: 'ordered_list',
      showIf: { key: 'message_type', value: 'flow' },
      help: 'bijv. {{firstname}} of extra bericht tekst' },
    // Free-form session text — only shown (and sent) for the 'session' format.
    { key: 'session_text',        label: 'Berichttekst (sessie)',  type: 'textarea',
      placeholder: 'Hoi {{firstname}}, …', showIf: { key: 'message_type', value: 'session' } },
    // 02-09 (Danny, verbatim: "vertaling moet wel in de workflow staan"): per-language
    // overrides for the session text, on their own "Vertalingen" tab (MODULE-FACE-BEVRIES —
    // main tab stays untouched). Empty per-field = falls back to session_text (bureau language).
    // Only shown for the free-text session format (Danny 02-09: "Vertaling is
    // alleen als het vrij tekst module is. Bij template kan dit niet.") — a
    // template's variables come from Meta's approved template, not free text.
    { key: 'translations', label: 'Vertalingen', type: 'translations', tab: 'translations',
      fields: ['text'], languages: MESSAGING_LANGUAGES, mainFields: { text: 'session_text' },
      showIf: { key: 'message_type', value: 'session' } },
    // Danny's own message classification (NOT the send format above) — drives queue
    // order in the WABA batch (Wachtrij tab). Tenant lookup, CRUD'd via Settings.
    { key: 'priority_type',       label: 'Berichttype (classificatie)', type: 'lookup_select', endpoint: '/whatsapp-message-types' },
    // WF-BUILDER-VELDEN-1: idempotency window — the same template is not re-sent to the
    // same candidate inside this many hours (0 = always send).
    { key: 'dedup_hours',         label: 'Niet opnieuw sturen binnen (uren)', type: 'number', default: 24,
      help: 'Idempotentie: dezelfde template gaat binnen dit venster niet nogmaals naar dezelfde kandidaat (0 = altijd sturen).' },
    { key: 'throttle_per_minute', label: 'Max. per minuut',        type: 'number',  placeholder: '30' },
  ],
}

// whatsapp_send module — send a WhatsApp message to a candidate (requires the WhatsApp app).
import { MessageCircle } from 'lucide-react'
// HUISSTIJL-1: the §4 soft-tint formula lives in lib/tint, never a hand-rolled
// color-mix literal per module (herhaal-slotaudit r3).
import { tint } from '@/lib/tint'

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
      showIf: { key: 'channel', value: ['waba', 'waba_coex', undefined] } },
    // Recipient override: empty = each bundle's own mobile; a literal 06-number
    // redirects EVERY message there (dry-run testing, Danny 2026-07-09).
    { key: 'recipient_field',     label: 'Ontvanger',              type: 'text',
      placeholder: 'leeg = mobiel van de kandidaat · eigen 06 = testmodus' },
    // Template picker + per-{{n}} variable mapping + live preview (WhatsappTemplateField).
    // Persists template_name/header_variables/variables/language in the same shape as the
    // old lookup_select + two textareas (ONE PER LINE → {{1}},{{2}},…); only shown for the
    // 'template' format, mirroring session_text's own showIf below.
    { key: 'template_name',       label: 'Template',               type: 'whatsapp_template',
      showIf: { key: 'message_type', value: 'template' } },
    { key: 'language',            label: 'Taal',                   type: 'text',    placeholder: 'nl' },
    // Free-form session text — only shown (and sent) for the 'session' format.
    { key: 'session_text',        label: 'Berichttekst (sessie)',  type: 'textarea',
      placeholder: 'Hoi {{firstname}}, …', showIf: { key: 'message_type', value: 'session' } },
    // Danny's own message classification (NOT the send format above) — drives queue
    // order in the WABA batch (Wachtrij tab). Tenant lookup, CRUD'd via Settings.
    { key: 'priority_type',       label: 'Berichttype (classificatie)', type: 'lookup_select', endpoint: '/whatsapp-message-types' },
    // WF-BUILDER-VELDEN-1: a static, closed logging category (WhatsAppSendModule's own
    // fixed option set — never a tenant lookup, unlike `purpose` above).
    { key: 'message_category',    label: 'Categorie (voor logging)', type: 'select', options: ['shift_offer','reminder','no_response','general'], default: 'general' },
    // WF-BUILDER-VELDEN-1: idempotency window — the same template is not re-sent to the
    // same candidate inside this many hours (0 = always send).
    { key: 'dedup_hours',         label: 'Niet opnieuw sturen binnen (uren)', type: 'number', default: 24,
      help: 'Idempotentie: dezelfde template gaat binnen dit venster niet nogmaals naar dezelfde kandidaat (0 = altijd sturen).' },
    { key: 'throttle_per_minute', label: 'Max. per minuut',        type: 'number',  placeholder: '30' },
    // WF-BUILDER-VELDEN-1: P11-FASE4 fail-closed consent gate — sends ONLY when this
    // bundle field is present AND truthy on the candidate row (missing = no send).
    { key: 'require_consent_field', label: 'Vereist toestemmingsveld (fail-closed)', type: 'text',
      help: 'Optioneel. Bijv. whatsapp_consent: verstuur ALLEEN als dit veld op de kandidaatrij aanwezig én waar is (ontbrekend veld = geen verzending).' },
  ],
}

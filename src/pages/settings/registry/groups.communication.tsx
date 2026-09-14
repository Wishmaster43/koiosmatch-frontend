// Settings registry — communication groups: Communication (e-mail), WhatsApp,
// Notifications. Extracted from registry.tsx (REGISTRY-SPLIT-1) in original array
// order; registry.tsx concatenates this with the other registry/groups.* modules
// to build NAV_GROUPS.
import { Mail, ClipboardList, Languages, MessageCircle, Bell } from 'lucide-react'
import type { NavGroup } from './types'

import EmailSettings from '../sections/EmailSettings'
import EmailLog from '../sections/EmailLog'
import MessagingLanguageSettings from '../sections/communication/MessagingLanguageSettings'
// CATALOG-EMBED-1 (Danny 13-09): "E-mail" and "Inbox" generic catalogue rows merge
// into one small host screen under Communication, replacing the retired catalog/email nav item.
import EmailGeneralSettings from '../sections/EmailGeneralSettings'
import WhatsAppSettings from '../sections/WhatsAppSettings'
import WhatsAppWebNumbersSettings from '../sections/whatsapp/WhatsAppWebNumbersSettings'
import WhatsAppLog from '../sections/WhatsAppLog'
import { WaMessageTypeSettings } from '../sections/WaMessageTypeSettings'
import NotificationsSettings from '../sections/NotificationsSettings'
import EscalationSettings from '../sections/EscalationSettings'

// Communication, WhatsApp and Notifications groups, in original NAV_GROUPS order.
export const communicationGroups: NavGroup[] = [
  {
    // Communication = e-mail per context (clients / candidates / planning).
    //
    // WITHHELD (offered-iff-read registry rule, mirrors the note_types/document_types
    // comments above): the backend ships full tenant CRUD for message_purposes
    // (MSG-PURPOSE-1 — MessagePurposeController.php, "Settings → Communicatie" in its
    // own doc-block) — a value/label vocabulary for WHY a WhatsApp/e-mail message
    // exists (birthday, evaluation, interview, manual, …), validated on
    // POST /messages `purpose`. There is ZERO frontend consumer today: no manual
    // compose picker, no workflow send-step, no timeline badge reads it. Per §3 (no
    // fake affordances) this does NOT get a settings screen yet — a tenant would be
    // able to curate a vocabulary nothing ever applies. No tenant data is at risk:
    // the endpoint keeps serving message_purposes, and re-adding this item becomes a
    // one-line change the day a real `purpose` picker/reader lands on the message
    // compose or workflow send-step surface.
    key: 'communication', icon: Mail,
    items: [
      // Wire contract: EmailSettings keys its stored settings as email_<context>_* — the
      // context prop stays the legacy Dutch wire value while the registry id is English.
      { id: 'email_customers', icon: Mail, render: () => <EmailSettings context="klanten" /> },
      { id: 'email_candidates', icon: Mail, render: () => <EmailSettings context="kandidaten" /> },
      { id: 'email_planning', icon: Mail, render: () => <EmailSettings context="planning" /> },
      { id: 'email_log', icon: ClipboardList, component: EmailLog },
      // AVG-RET-2-TAAL-1: agency-wide candidate/contact messaging-language default.
      { id: 'messaging_language', icon: Languages, component: MessagingLanguageSettings },
      // CATALOG-EMBED-1 (Danny 13-09: "Inbox mail hoort bij email instellingen"):
      // merges the catalogue's "email"/mail group and "messaging"/inbox group —
      // both replace the retired catalog/email and catalog/messaging nav items.
      { id: 'email_general', icon: Mail, render: () => <EmailGeneralSettings /> },
    ],
  },
  {
    // WhatsApp — connection + messaging (WhatsApp Business).
    key: 'whatsapp', icon: MessageCircle,
    items: [
      { id: 'whatsapp', icon: MessageCircle, component: WhatsAppSettings, requiresPage: 'whatsapp' },
      // K-195 (VESTIGING-DEVICE-1, CMBE d88ad05e): branch-level WhatsApp Web
      // devices, module-gated only — no top-level nav page for whatsapp_web
      // exists, so requiresModuleOrApp (not requiresPage) is the right gate.
      { id: 'whatsapp_web', icon: MessageCircle, component: WhatsAppWebNumbersSettings,
        requiresModuleOrApp: { module: 'whatsapp_web' }, requiresPermission: 'settings.view' },
      { id: 'whatsapp_log', icon: ClipboardList, component: WhatsAppLog },
      // Message-type classification (priority_type on whatsapp_send; queue ordering).
      { id: 'wa_message_types', icon: MessageCircle, component: WaMessageTypeSettings, logName: 'whatsapp_message_types' },
    ],
  },
  {
    // Notifications — its own menu (per context). NOTIF-KANDIDAAT-1 (api Notifier.php,
    // 2026-08-05): candidate.x / match.x / task.x now resolve through the same
    // TYPE_CONTEXT_MAP gate as application/vacancy/invoice, so they get the same rows.
    key: 'notifications', icon: Bell,
    items: [
      // Wire contract: NotificationsSettings stores notif_<context>_in_app/_email — the
      // context prop stays the legacy Dutch wire value while the registry id is English.
      { id: 'notif_applications', icon: Bell, render: () => <NotificationsSettings context="sollicitaties" /> },
      { id: 'notif_vacancies', icon: Bell, render: () => <NotificationsSettings context="vacatures" /> },
      { id: 'notif_candidates', icon: Bell, render: () => <NotificationsSettings context="kandidaten" /> },
      // K22 (13-08): all five customer.* producers now fire as scheduled commands
      // (never draft-only), so 'klanten' gets the same real settings row its
      // siblings have — see NotificationsSettings.jsx's CONTEXTS_WITHOUT_EMITTER
      // docblock for why 'vacatures'/'facturering' stay excluded from that set.
      { id: 'notif_customers', icon: Bell, render: () => <NotificationsSettings context="klanten" /> },
      { id: 'notif_matches', icon: Bell, render: () => <NotificationsSettings context="matches" /> },
      { id: 'notif_tasks', icon: Bell, render: () => <NotificationsSettings context="taken" /> },
      { id: 'notif_billing', icon: Bell, render: () => <NotificationsSettings context="facturering" /> },
      // NOTIF-CONTEXTEN-FE-1 (CMBE 23-08): new English-slug contexts, backend-context
      // keys 'calllists'/'opportunities' match 1:1 — no Dutch-slug migration needed.
      // Icon: Bell, matching every sibling row in this group (SETTINGS-TABS-FIX-1
      // review) — the notifications menu is one list, not a per-context icon set.
      { id: 'notif_calllists', icon: Bell, render: () => <NotificationsSettings context="calllists" /> },
      { id: 'notif_opportunities', icon: Bell, render: () => <NotificationsSettings context="opportunities" /> },
      { id: 'notif_appointments', icon: Bell, render: () => <NotificationsSettings context="appointments" /> },
      // NOTIF-CONVERSATIE-1 (api Notifier.php TYPE_CONTEXT_MAP): unanswered-conversation
      // nudges get their own switchable context, with real conversation.* Notifier::send()
      // call sites backing it (SignalEscalation.php, WaWebReplyAttention.php) — a working
      // toggle like its siblings, not listed in CONTEXTS_WITHOUT_EMITTER.
      { id: 'notif_conversations', icon: Bell, render: () => <NotificationsSettings context="gesprekken" /> },
      // Escalation (item 11, 3b): per stall signal, an optional day-threshold + target (user/role).
      { id: 'notif_escalation', icon: Bell, component: EscalationSettings },
      // The per-CALLER override (G28, MyNotificationsSettings) is a personal preference,
      // not a tenant setting — it lives on the profile since row 32 (Danny 09-09: "Mijn
      // meldingen maar staat bij instellingen en geldt voor iedereen???"). The old
      // #settings/notifications/notif_my deep link redirects there (SettingsPage MOVED_TO_PROFILE).
    ],
  },
]

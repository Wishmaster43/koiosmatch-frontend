// notification_send module — send an internal notification to a person/role (native ATS step).
// Field keys mirror the backend contract exactly (App\Workflow\Modules\NotificationSendModule
// ::configSchema / resolveRecipients / VALID_TYPES): title, body, recipients, role, user_ids,
// type, link_entity (WF-BUILDER-VELDEN-1 added user_ids + link_entity).
import { Bell } from 'lucide-react'
// HUISSTIJL-1: the §4 soft-tint formula lives in lib/tint, never a hand-rolled
// color-mix literal per module (herhaal-slotaudit r3).
import { tintBg } from '@/lib/tint'

export default {
  type:  'notification_send',
  category: 'Communicatie',
  label: 'Melding versturen',
  Icon:  Bell,
  color: 'var(--module-brown)',
  bg:    tintBg('var(--module-brown)'),
  schema: [
    { key: 'title',      label: 'Titel',      type: 'text',     placeholder: 'Nieuwe match' },
    { key: 'body',       label: 'Bericht',    type: 'textarea', placeholder: 'Er is een nieuwe match aangemaakt.' },
    // Who receives the notification: everyone, one tenant role, explicit users, or
    // the owner of the record that triggered the workflow (engine RECIPIENTS const).
    // NO `default` on purpose (Opus, 23-08): a schema default is DISPLAY-ONLY — a
    // fresh node is created with config {} and the engine never merges schema
    // defaults either — so a painted "alle" would persist nothing, the engine would
    // fall back to 'users' with an empty user_ids and silently send ZERO. Without a
    // default the picker shows its placeholder and forces an explicit pick.
    // DEFAULT-PERSIST-1 (golf 2) seeds schema defaults into the config at node
    // creation; until then, no field may rely on `default` for engine behaviour.
    // WF-BUILDER-VELDEN-1: 'users' added — without it the `user_ids` field below has no
    // reachable showIf and would be a fake affordance (§3, no dead-end controls).
    { key: 'recipients', label: 'Ontvangers', type: 'select',   options: ['all', 'role', 'users', 'candidate_owner', 'customer_owner', 'vacancy_owner'] },
    // Only relevant when recipients === 'role'. Roles are tenant-real, resolved by the
    // backend via `roles.name` (resolveRecipients: whereHas('roles', name = config.role)),
    // so this is NOT a static list — it is a live GET /roles lookup, same dynamic-options
    // mechanism status_set.ts uses for the candidate statuses (`lookup_select` + `endpoint`,
    // rendered by the shared LookupSelectField in fieldControls/). GET /roles already
    // excludes the platform-only super_admin role server-side (RoleController::index).
    { key: 'role',       label: 'Rol',        type: 'lookup_select', endpoint: '/roles', valueKey: 'name',
      showIf: { key: 'recipients', value: 'role' } },
    // WF-BUILDER-VELDEN-1: explicit user picks — only reachable when recipients==='users'
    // (resolveRecipients' default branch). Live GET /users, same lookup as the app's own
    // owner pickers (lib/queries.ts useUsers) — never a hardcoded id list.
    { key: 'user_ids',   label: 'Gebruikers', type: 'multiselect', endpoint: '/users',
      showIf: { key: 'recipients', value: 'users' } },
    // NOTIF-TYPE-WHITELIST-1/NOTIF-TYPES-FE-1: closed vocabulary, now mirroring
    // NotificationSendModule::VALID_TYPES exactly (measured 27-08, 37 values) —
    // never free text (an unknown value there silently degrades to
    // 'workflow.custom'). Values are technical event tags kept identical across
    // locales; LABELS translate via fieldOptions.* (see workflows.json).
    { key: 'type', label: 'Type (event)', type: 'select', options: [
      'application.created', 'application.stage_changed', 'application.matched', 'application.rejected',
      'vacancy.created', 'vacancy.updated', 'vacancy.published', 'vacancy.closing_soon',
      'candidate.created', 'candidate.status_changed', 'candidate.no_contact', 'candidate.document_expiring',
      'candidate.missing_cv', 'candidate.status_stale', 'candidate.phase_stale',
      'match.created', 'match.expiring', 'match.approval_pending',
      'task.created', 'task.due', 'task.assigned',
      'appointment.today',
      'candidate.retention_due', 'candidate.archived',
      'whatsapp.outage', 'whatsapp.restored',
      'conversation.unanswered',
      'candidate.availability_upcoming', 'candidate.availability_overdue',
      'candidate.leave_ending_soon', 'candidate.leave_overdue',
      'candidate.unavailable_ending_soon', 'candidate.unavailable_overdue',
      'calllist.target_assigned',
      'opportunity.won', 'opportunity.lost',
      'workflow.custom',
    ] },
    // BEL-DOORKLIK: which bundle "<entity>_id" field the in-app bell deep-links to
    // (e.g. "conversation" resolves against input.conversation_id). Free text in the
    // engine (BaseModule reads whatever slug is here against the run's own bundle
    // fields) — not a closed vocabulary, so a plain text field mirrors it exactly.
    { key: 'link_entity', label: 'Hyperlink-entiteit', type: 'text', placeholder: 'conversation',
      help: 'Optioneel. Bijvoorbeeld "conversation": de melding linkt dan naar het bijbehorende "conversation_id"-veld uit de trigger, zodat de melding doorklikbaar is.' },
  ],
}

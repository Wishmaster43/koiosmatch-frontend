// notification_send module — send an internal notification to a person/role (native ATS step).
// Field keys mirror the backend contract exactly (App\Workflow\Modules\NotificationSendModule
// ::configSchema / resolveRecipients / VALID_TYPES): title, body, recipients, role, type.
import { Bell } from 'lucide-react'

export default {
  type:  'notification_send',
  category: 'Communicatie',
  label: 'Melding versturen',
  Icon:  Bell,
  color: 'var(--module-brown)',
  bg:    'color-mix(in srgb, var(--module-brown) 10%, transparent)',
  schema: [
    { key: 'title',      label: 'Titel',      type: 'text',     placeholder: 'Nieuwe match' },
    { key: 'body',       label: 'Bericht',    type: 'textarea', placeholder: 'Er is een nieuwe match aangemaakt.' },
    // Who receives the notification: everyone, one tenant role, or the owning
    // recruiter of the record that triggered the workflow (RECIPIENTS const).
    // default 'all' matches the seeded templates (NotificationTemplates.php:44) —
    // without it a fresh node persists NO recipients key, the BE falls back to the
    // 'users' strategy reading user_ids this module never writes, and the step
    // silently sends zero notifications (control-round finding, 13-08).
    { key: 'recipients', label: 'Ontvangers', type: 'select',   options: ['all', 'role', 'candidate_owner'], default: 'all' },
    // Only relevant when recipients === 'role'. Roles are tenant-real, resolved by the
    // backend via `roles.name` (resolveRecipients: whereHas('roles', name = config.role)),
    // so this is NOT a static list — it is a live GET /roles lookup, same dynamic-options
    // mechanism status_set.ts uses for '/candidate-statuses' (`lookup_select` + `endpoint`,
    // rendered by the shared LookupSelectField in fieldControls.tsx). GET /roles already
    // excludes the platform-only super_admin role server-side (RoleController::index).
    { key: 'role',       label: 'Rol',        type: 'lookup_select', endpoint: '/roles', valueKey: 'name',
      showIf: { key: 'recipients', value: 'role' } },
    // NOTIF-TYPE-WHITELIST-1: closed vocabulary, copied verbatim from
    // NotificationSendModule::VALID_TYPES — never free text (an unknown value there
    // silently degrades to 'workflow.custom'). Values are technical event tags kept
    // identical across locales; LABELS translate via fieldOptions.* (see workflows.json).
    { key: 'type', label: 'Type (event)', type: 'select', options: [
      'application.created', 'application.stage_changed', 'application.matched', 'application.rejected',
      'vacancy.created', 'vacancy.updated', 'vacancy.published',
      'candidate.created', 'candidate.status_changed', 'candidate.no_contact',
      'match.created',
      'task.created', 'task.due',
      'workflow.custom',
    ] },
  ],
}

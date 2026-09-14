// Settings registry — shared cross-entity lookup groups: Custom fields, Note types,
// Document types, Appointments. Extracted from registry.tsx (REGISTRY-SPLIT-1) in
// original array order; registry.tsx concatenates this with the other
// registry/groups.* modules to build NAV_GROUPS.
import {
  Users, ClipboardList, Sparkles, Briefcase, ListChecks, Target, Phone, Building2, MapPin,
  MessageSquare, Factory, FileText, CalendarCheck,
} from 'lucide-react'
import type { NavGroup } from './types'

import CustomFieldsSettings from '../sections/CustomFieldsSettings'
import NoteTypesSettings from '../sections/NoteTypesSettings'
import DocumentTypesSettings from '../sections/DocumentTypesSettings'
import { AppointmentTypeSettings } from '../sections/AppointmentTypeSettings'
import { AppointmentLocationSettings } from '../sections/AppointmentLocationSettings'

// Custom fields, Note types, Document types and Appointments groups, in original NAV_GROUPS order.
export const fieldsGroups: NavGroup[] = [
  {
    // Eigen velden (§3B custom-fields wave, 2026-07-14) — ONE shared CRUD editor
    // (CustomFieldsSettings, parameterized by entityType) with a sub-tab per
    // entity, replacing the old per-entity forks (candidate_custom_fields,
    // vacancy_fields). Mirrors every other group here: one `render` per item so
    // the shell's existing sub-tab strip (SettingsTabs) does the rest — no new
    // nested tab bar needed for this to read as "one menu, one sub-tab per entity".
    key: 'custom_fields', icon: ListChecks,
    items: [
      { id: 'cf_candidate', icon: Users, render: () => <CustomFieldsSettings entityType="candidate" /> },
      { id: 'cf_application', icon: ClipboardList, render: () => <CustomFieldsSettings entityType="application" /> },
      { id: 'cf_match', icon: Sparkles, render: () => <CustomFieldsSettings entityType="match" /> },
      { id: 'cf_vacancy', icon: Briefcase, render: () => <CustomFieldsSettings entityType="vacancy" /> },
      { id: 'cf_task', icon: ListChecks, render: () => <CustomFieldsSettings entityType="task" /> },
      { id: 'cf_opportunity', icon: Target, render: () => <CustomFieldsSettings entityType="opportunity" /> },
      { id: 'cf_outreach_campaign', icon: Phone, render: () => <CustomFieldsSettings entityType="outreach_campaign" /> },
      { id: 'cf_customer', icon: Building2, render: () => <CustomFieldsSettings entityType="customer" /> },
      { id: 'cf_customer_location', icon: MapPin, render: () => <CustomFieldsSettings entityType="customer_location" /> },
      { id: 'cf_customer_department', icon: Building2, render: () => <CustomFieldsSettings entityType="customer_department" /> },
      { id: 'cf_customer_contact', icon: Users, render: () => <CustomFieldsSettings entityType="customer_contact" /> },
    ],
  },
  {
    // Notitietypes (NOTE-TYPES-2/3, Danny "ieder zijn eigen" 2026-07-20) — own top-level
    // group, one NoteTypesSettings(entity) sub-tab per entity that actually READS the
    // lookup, mirroring the custom_fields group above: one shared editor parameterized
    // by `entity`, never a per-entity fork. Replaces the old flat cross-entity list that
    // lived under personalisation.
    //
    // ONLY entities with a real reader get a tab (§3 no fake affordances, 2026-07-31).
    // A sub-tab here is offered iff some screen calls useNoteTypes(<entity>). Re-measured
    // 2026-08-04 against Danny's full wish list (customer/location/department/contact
    // person/tasks/vacancies/applications/call lists/matches) — per-entity result:
    //   • candidate, application, customer, opportunity — unchanged, offered since wave 2.
    //   • contact   — NOW offered. CustomerNotesTab already called useNoteTypes('contact')
    //                 (the composer switches scope the moment a note is linked to a
    //                 contactpersoon, CONTACT-NOTITIES-1) — only the settings tab was
    //                 missing; the reader was real all along.
    //   • vacancy   — NOW offered. VacancyNoteController validates `type` against the
    //                 entity-scoped lookup since VACANCY-NOTE-TYPE-1 (2026-08-02), and the
    //                 vacancy drawer's Notes tab (pages/vacancies/drawer/NotesTab.tsx) was
    //                 rewritten onto the shared SharedNotesTab + useNoteTypes('vacancy') —
    //                 same picker/chip treatment as applications/opportunities.
    //   • match     — NOW offered (NT-MATCH-1, 2026-08-04). MatchDrawer grew a Notities
    //                 tab (pages/matches/drawer/NotesTab.tsx on the shared SharedNotesTab +
    //                 useNoteTypes('match')) against MatchNoteController's entity-scoped
    //                 `type` validation — the reader is real, so the editor turns on.
    //   • task      — NOW offered (NT-TASK-1, 2026-08-04). The Reacties tab (removed
    //                 2026-07-14) returned as a Notities tab on the shared SharedNotesTab +
    //                 useNoteTypes('task') against TaskCommentController's entity-scoped
    //                 `type` validation — Danny's note-type coverage list asked for it.
    //   • call_list (bellijsten) — STILL withheld, one step earlier than match/task: no
    //                 'call_list' token in the backend's NoteType::ENTITIES, no notes route
    //                 on outreach-campaigns, and no FE notes surface on OutreachDrawer either.
    //                 This is a backend-first gap (schema + controller + route), not just a
    //                 missing FE tab — see the worklist row.
    //   • location / department — NOW offered (NOTES-LOC-DEPT-1, 2026-09-02). Both
    //                 ScopedNotesTab (location/department drill-down's notes sub-tabs)
    //                 and the backend support per-entity note-type configs for locations
    //                 and departments, just as they do for other entities.
    //                 Each tab below still manages that ONE entity's OWN list — the
    //                 editor never merges. The WIDENING happens only on read, in the
    //                 composer: BUG-NOTE-SCOPE-1 (backend CustomerController::addNote/
    //                 updateNote) accepts a location note's type from {customer,location}
    //                 and a department note's type from {customer,location,department},
    //                 so ScopedNotesTab calls useNoteTypesFor([...]) with that widened
    //                 set instead of useNoteTypes(scope) alone (NOTE-TYPE-WIDEN-1).
    // No tenant data is deleted for a withheld entity: the rows stay in note_types and the
    // endpoint keeps serving them, so re-adding one line here restores the editor the day
    // that entity grows a real FE reader.
    key: 'note_types', icon: MessageSquare,
    items: [
      // General (entity=null) comes first — the global rows every entity tab used to
      // inherit silently via the backend's ?entity= merge (NOTE-TYPES-3).
      { id: 'nt_general', icon: MessageSquare, render: () => <NoteTypesSettings entity={null} />, logName: 'note_types' },
      { id: 'nt_candidate', icon: Users, render: () => <NoteTypesSettings entity="candidate" />, logName: 'note_types' },
      { id: 'nt_application', icon: ClipboardList, render: () => <NoteTypesSettings entity="application" />, logName: 'note_types' },
      { id: 'nt_customer', icon: Building2, render: () => <NoteTypesSettings entity="customer" />, logName: 'note_types' },
      { id: 'nt_location', icon: MapPin, render: () => <NoteTypesSettings entity="location" />, logName: 'note_types' },
      { id: 'nt_department', icon: Factory, render: () => <NoteTypesSettings entity="department" />, logName: 'note_types' },
      { id: 'nt_contact', icon: Users, render: () => <NoteTypesSettings entity="contact" />, logName: 'note_types' },
      { id: 'nt_opportunity', icon: Target, render: () => <NoteTypesSettings entity="opportunity" />, logName: 'note_types' },
      { id: 'nt_vacancy', icon: Briefcase, render: () => <NoteTypesSettings entity="vacancy" />, logName: 'note_types' },
      { id: 'nt_match', icon: Sparkles, render: () => <NoteTypesSettings entity="match" />, logName: 'note_types' },
      { id: 'nt_task', icon: ListChecks, render: () => <NoteTypesSettings entity="task" />, logName: 'note_types' },
    ],
  },
  {
    // Document types (DOCTYPE-ENTITY-1, mirrors the note_types group above) — own
    // top-level group, one DocumentTypesSettings(entity) sub-tab per entity.
    // Replaces the old candidate-only `document_types` entry (a bespoke multi-tab
    // wrapper with its own internal SubTabBar + a "Global row" cross-entity fallback):
    // the backend's `?entity=` scope is now STRICT (mirrors NoteTypeController::
    // scopeIndex() exactly, no orWhereNull fallback), so that protection was guarding
    // a behaviour the backend no longer serves — see DocumentTypesSettings.jsx.
    //
    // ONLY entities with a real reader get a tab (§3 no fake affordances, mirrors
    // the note_types group's "offered-iff-read" rule; guarded by
    // registry.deadScreens.test.jsx). Re-measured 2026-08-05 against the backend's
    // full CandidateDocumentType::ENTITIES list (kandidaat/klant/locatie/afdeling/
    // contactpersoon/kans/taak/bellijst/match/vacature) — per-entity result:
    //   • candidate, customer — real readers since the wave that built this group
    //                 (candidate/customer DocumentsTab.tsx both call useDocumentTypes(entity)).
    //   • customer_location, customer_department — NOW offered (DOCTYPE-SCOPE-1,
    //                 2026-08-05). ScopedDocumentsTab used to hand the customer's
    //                 DocumentsTab no scope at all, so a location/department upload
    //                 silently read the CUSTOMER's document-type lookup — it now
    //                 passes its own docTypeScope ('customer_location'/
    //                 'customer_department') through to useDocumentTypes(), a real,
    //                 distinct reader per level.
    //   • vacancy   — NOW offered (DOCTYPE-VACANCY-1, 2026-08-05). The vacancy
    //                 drawer's DocumentsTab.tsx used to upload with a hardcoded
    //                 empty `type` — it now reads useDocumentTypes('vacancy') for a
    //                 real type picker + row chip, same treatment as candidate/customer.
    //   • contact   — STILL withheld. `customer_documents` has no
    //                 `customer_contact_id` column at all (measured:
    //                 EntityDocumentController::store/update only validate
    //                 customer_location_id/customer_department_id) — there is no
    //                 contact-level document concept to scope a lookup to yet.
    //   • opportunity, task, call_list, match — STILL withheld. No entity-scoped
    //                 documents route exists for any of them (no
    //                 /opportunities/{id}/documents, /tasks/{id}/documents,
    //                 /outreach-campaigns/{id}/documents or /matches/{id}/documents),
    //                 so no FE tab reads a document-type lookup scoped to them —
    //                 a backend-first gap, not just a missing FE tab.
    // No tenant data is deleted for a withheld entity: the rows stay in
    // document_types and the endpoint keeps serving them, so re-adding one line here
    // restores the editor the day that entity grows a real FE reader.
    key: 'document_types', icon: FileText,
    items: [
      { id: 'dt_candidate', icon: Users, render: () => <DocumentTypesSettings entity="candidate" />, logName: 'candidate_document_types' },
      { id: 'dt_customer', icon: Building2, render: () => <DocumentTypesSettings entity="customer" />, logName: 'candidate_document_types' },
      { id: 'dt_customer_location', icon: MapPin, render: () => <DocumentTypesSettings entity="customer_location" />, logName: 'candidate_document_types' },
      { id: 'dt_customer_department', icon: Building2, render: () => <DocumentTypesSettings entity="customer_department" />, logName: 'candidate_document_types' },
      { id: 'dt_vacancy', icon: Briefcase, render: () => <DocumentTypesSettings entity="vacancy" />, logName: 'candidate_document_types' },
    ],
  },
  {
    // Appointments — own top-level group (Danny 2026-08-04): appointment types and
    // locations moved out of `matches` because appointments span every entity
    // (candidate intakes, customer visits, …), not just the Matches feature —
    // mirrors the note_types/document_types "spans every entity" moves above.
    key: 'appointments', icon: CalendarCheck,
    items: [
      { id: 'appointment_types', icon: CalendarCheck, component: AppointmentTypeSettings, logName: 'appointment_types' },
      { id: 'appointment_locations', icon: MapPin, component: AppointmentLocationSettings, logName: 'appointment_locations' },
    ],
  },
]

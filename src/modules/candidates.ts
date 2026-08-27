// candidates module — the per-entity Kandidaten module (the blueprint for every
// entity tab). Fetch + filter happen inside it; it also absorbs the old
// "Status zetten" (status_set) and "Werkervaring toevoegen" (experience_add) as
// actions, replacing the separate Ophalen/Filter/Acties modules.
import { Users } from 'lucide-react'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'candidates',
  label:    'Kandidaten',
  category: 'Kandidaten',
  Icon:     Users,
  color:    'var(--color-secondary)',
  bg:       'var(--color-secondary-bg)',
  actions:  ['Ophalen', 'Aanmaken', 'Bijwerken', 'Werkervaring toevoegen'],
  // Filterable candidate fields (names = data model; values typed → lookups later).
  filterFields: [
    { value: 'status',          label: 'Status' },
    { value: 'candidate_types', label: 'Contractvorm' },
    { value: 'pool',            label: 'Pool' },
    { value: 'function',        label: 'Functie' },
    { value: 'availability',    label: 'Beschikbaarheid' },
    { value: 'owner',           label: 'Eigenaar / recruiter' },
    { value: 'last_contact_at', label: 'Laatste contact' },
    // AUTOMATIONS-MIGRATIE-1: the seeded reactivation templates target on
    // consent — boolean, filtered as = true/false (backend casts).
    { value: 'whatsapp_consent', label: 'WhatsApp-consent' },
    { value: 'city',            label: 'Plaats' },
  ],
  sortOptions: [
    { value: 'name',            label: 'Naam' },
    { value: 'created_at',      label: 'Inschrijfdatum' },
    { value: 'last_shift',      label: 'Laatste dienst' },
    { value: 'last_contact_at', label: 'Laatste contact' },
  ],
  schemaExtra: [
    // SEGMENT-via-workflow (Danny 27-08: "kandidaten ouder dan 3 maanden …"):
    // the fetch narrows on last contact age — BE CandidatesFetchModule reads
    // last_contact_before_months (older than N months OR never contacted).
    { key: 'last_contact_before_months', label: 'Laatste contact ouder dan (maanden)', type: 'number', showIf: { key: 'action', value: 'Ophalen' } },
    // Bijwerken — dated + reasoned status change (was status_set).
    { key: 'reason',         label: 'Reden',        type: 'text', showIf: { key: 'action', value: 'Bijwerken' } },
    { key: 'effective_from', label: 'Ingangsdatum', type: 'date', showIf: { key: 'action', value: 'Bijwerken' } },
    // Werkervaring toevoegen (was experience_add).
    // KANDIDATEN 9 (21-08): the old experience_position (top/bottom) option is
    // GONE — the backend deliberately ignores it (auto rows always append, §3B
    // ordering law), so it was a dead setting promising an effect it never had.
    { key: 'experience_source',   label: 'Bron',      type: 'select', options: ['match'],          showIf: { key: 'action', value: 'Werkervaring toevoegen' } },
  ],
})

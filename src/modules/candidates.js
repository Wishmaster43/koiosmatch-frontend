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
    { value: 'city',            label: 'Plaats' },
  ],
  sortOptions: [
    { value: 'name',            label: 'Naam' },
    { value: 'created_at',      label: 'Inschrijfdatum' },
    { value: 'last_shift',      label: 'Laatste dienst' },
    { value: 'last_contact_at', label: 'Laatste contact' },
  ],
  schemaExtra: [
    // Bijwerken — dated + reasoned status change (was status_set).
    { key: 'reason',         label: 'Reden',        type: 'text', showIf: { key: 'action', value: 'Bijwerken' } },
    { key: 'effective_from', label: 'Ingangsdatum', type: 'date', showIf: { key: 'action', value: 'Bijwerken' } },
    // Werkervaring toevoegen (was experience_add).
    { key: 'experience_source',   label: 'Bron',      type: 'select', options: ['match'],          showIf: { key: 'action', value: 'Werkervaring toevoegen' } },
    { key: 'experience_position', label: 'Plaatsing', type: 'select', options: ['top', 'bottom'],  showIf: { key: 'action', value: 'Werkervaring toevoegen' } },
  ],
})

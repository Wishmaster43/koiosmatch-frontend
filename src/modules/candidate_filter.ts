// candidate_filter module — fetch/narrow the candidate list from the planning
// connection (the first step of the Offering Shifts chains). Field keys mirror
// App\Workflow\Modules\CandidateFilterModule::configSchema() exactly (WF-BUILDER-VELDEN-1).
import ShiftManagerMark from '../components/ui/ShiftManagerMark'
// HUISSTIJL-1: the §4 soft-tint formula lives in lib/tint, never a hand-rolled
// color-mix literal per module (herhaal-slotaudit r3).
import { tint } from '@/lib/tint'

export default {
  type:  'candidate_filter',
  app:   'shiftmanager',
  category: 'Shiftmanager',
  label: 'Kandidaten ophalen',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  bg:    tint('var(--module-shiftmanager)', 8),
  schema: [
    // default false = the engine's own reading of an ABSENT key (`! empty(...)`): a
    // fresh node persists no config, so the toggle must paint what the engine does.
    { key: 'ai_enabled', label: 'Alleen AI-enabled kandidaten', type: 'boolean', default: false },
    // WF-BUILDER-VELDEN-1: `pools`/`positions` filter the SHIFTMANAGER mirror table
    // (SmCandidate.pools is a raw JSON array, SmCandidate.position a plain string column) —
    // there is NO tenant-CRUD lookup behind either one (unlike the native candidate's own
    // /pools Talent-pools or /functions Functions lookups, a different table entirely), so
    // a `source`/`endpoint` here would validate against the wrong vocabulary. Free-entry
    // multiselect (no source, no options) is MultiSelectField's own documented fallback
    // for exactly this case — type a value, press Enter to add it as a chip.
    { key: 'pools',     label: 'Pools',    type: 'multiselect',
      help: 'Laat leeg voor alle pools' },
    { key: 'positions', label: 'Functies', type: 'multiselect',
      help: 'Laat leeg voor alle functies' },
    // No display default: the engine applies NO status filter when the key is
    // absent (`! empty(...)`), so a painted 'actief' would lie (see DEFAULT-PERSIST-1).
    { key: 'status', label: 'Status', type: 'select', options: ['actief', 'nietactief'] },
    { key: 'last_contact_days', label: 'Niet gecontacteerd in (dagen)', type: 'number' },
    { key: 'last_worked_days',  label: 'Laatste dienst minstens X dagen geleden', type: 'number', placeholder: '30' },
    { key: 'no_show_max',       label: 'Maximaal aantal no-shows', type: 'number', placeholder: '3' },
  ],
}

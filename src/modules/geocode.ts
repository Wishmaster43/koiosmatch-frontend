// geocode module — turn an address into coordinates via OpenCage (all countries).
// (GEO-GEOCODE-WORKFLOW-1). Used by eight seeded scenarios (Kandidaten/Klanten/
// Locaties/Vacatures × single/bulk): the single-record one (drill-down "Bijwerken"
// button / address-change event, record via {{trigger.<entity>_id}}) and bulk one
// (a fetch step supplies the set; "only_missing" guards OpenCage).
// Icon: an own-design vector mark (OpenCageMark, mirrors ShiftManagerMark) — neutral
// Compass icon, no branded logo (Danny 07-09); the name stays on the drill-down
// Koppelingen card.
import OpenCageMark from '../components/ui/OpenCageMark'
// HUISSTIJL-1: the §4 soft-tint formula lives in lib/tint, never a hand-rolled
// color-mix literal per module (herhaal-slotaudit r3).
import { tint } from '@/lib/tint'

export default {
  type:     'geocode',
  label:    'Geocode address (OpenCage)',
  category: 'candidates',
  Icon:     OpenCageMark,
  color:    'var(--module-geocode)',
  bg:       tint('var(--module-geocode)', 8),
  schema: [
    // GEO-GEOCODE-ENTITY-1: which master-data record this step geocodes.
    // Defaults to 'candidate' so existing single-candidate scenarios (no `entity` key)
    // behave exactly as before.
    { key: 'entity', label: 'Record type', type: 'select', options: ['candidate', 'customer', 'customer_location', 'vacancy'], default: 'candidate',
      help: 'candidate = candidate, customer = customer, customer_location = customer location, vacancy = vacancy.' },
    // Single-record path: the trigger supplies the entity; bulk leaves this
    // empty. NO placeholder (Danny 23-07 ×2): grey example text reads as a set
    // value — the empty field is the real "all records from the previous step".
    // D9: label/help are entity-agnostic — this same field carries a candidate,
    // customer, customer_location or vacancy id depending on the 'entity' select above.
    { key: 'candidate_id', label: 'Record ID', type: 'text', help: '{{record.id}} = runs per record (of the chosen type) from the previous step (bulk; empty works too). For a single record: {{trigger.<type>_id}} (drill-down button or address change).' },
    // Bulk safety: skip records that already carry coordinates (protects OpenCage quota).
    { key: 'only_missing', label: 'Only without coordinates', type: 'boolean', help: 'Skip records that already carry coordinates; recommended for bulk runs.' },
    // GEO-GEOCODE-ENTITY-1: the bulk source set for customer/location/vacancy
    // (never candidates — those come from the "Kandidaten ophalen" step instead).
    { key: 'all_records', label: 'All records of this type', type: 'boolean',
      help: 'Selects every customer / customer location / vacancy (max. 10,000, archived excluded). Does not work for candidates: use the "Fetch candidates" step for those.' },
  ],
}

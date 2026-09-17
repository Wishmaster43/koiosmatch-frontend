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
  label:    'Adres geocoderen (OpenCage)',
  category: 'Kandidaten',
  Icon:     OpenCageMark,
  color:    'var(--module-geocode)',
  bg:       tint('var(--module-geocode)', 8),
  schema: [
    // GEO-GEOCODE-ENTITY-1: which master-data record this step geocodes.
    // Defaults to 'candidate' so existing single-candidate scenarios (no `entity` key)
    // behave exactly as before.
    { key: 'entity', label: 'Soort record', type: 'select', options: ['candidate', 'customer', 'customer_location', 'vacancy'], default: 'candidate',
      help: 'candidate = kandidaat, customer = klant, customer_location = klantlocatie, vacancy = vacature.' },
    // Single-record path: the trigger supplies the entity; bulk leaves this
    // empty. NO placeholder (Danny 23-07 ×2): grey example text reads as a set
    // value — the empty field is the real "all records from the previous step".
    // D9: label/help are entity-agnostic — this same field carries a candidate,
    // customer, customer_location or vacancy id depending on the 'entity' select above.
    { key: 'candidate_id', label: 'Record-ID', type: 'text', help: '{{record.id}} = draait per record (van het gekozen soort) uit de vorige stap (bulk; leeg werkt ook). Voor één record: {{trigger.<soort>_id}} (drill-down-knop of adreswijziging).' },
    // Bulk safety: skip records that already carry coordinates (protects OpenCage quota).
    { key: 'only_missing', label: 'Alleen zonder coördinaten', type: 'boolean', help: 'Sla records over die al coördinaten hebben; aan te raden bij bulk.' },
    // GEO-GEOCODE-ENTITY-1: the bulk source set for customer/location/vacancy
    // (never candidates — those come from the "Kandidaten ophalen" step instead).
    { key: 'all_records', label: 'Alle records van dit soort', type: 'boolean',
      help: 'Selecteert alle klanten / klantlocaties / vacatures (max. 10.000, gearchiveerde niet). Werkt niet voor kandidaten: die selecteer je met de stap "Kandidaten ophalen".' },
  ],
}

// pdok_geocode module — turn a candidate's address into coordinates via PDOK
// (CAND-PDOK-WORKFLOW-1). Used by two seeded scenarios in the Kandidaten folder:
// the single-candidate one (the drill-down "Bijwerken" button / address-change
// event, candidate via {{trigger.candidate_id}}) and the bulk one (a
// candidates-fetch step supplies the set; "alleen zonder coördinaten" guards PDOK).
// Icon: an own-design vector mark (PdokMark, mirrors ShiftManagerMark) — the raster
// PDOK logo pixelates at node size (Danny 22-07); the real logo stays on the
// drill-down Koppelingen card.
import PdokMark from '../components/ui/PdokMark'
// HUISSTIJL-1: the §4 soft-tint formula lives in lib/tint, never a hand-rolled
// color-mix literal per module (herhaal-slotaudit r3).
import { tint } from '@/lib/tint'

export default {
  type:     'pdok_geocode',
  label:    'Adres geocoderen (PDOK)',
  category: 'Kandidaten',
  Icon:     PdokMark,
  color:    'var(--module-geo)',
  bg:       tint('var(--module-geo)', 8),
  schema: [
    // WF-BUILDER-VELDEN-1 (PDOK-ENTITY-1): which master-data record this step geocodes.
    // Defaults to 'candidate' so the two live candidate scenarios (no `entity` key)
    // behave exactly as before.
    { key: 'entity', label: 'Soort record', type: 'select', options: ['candidate', 'customer', 'customer_location', 'vacancy'], default: 'candidate',
      help: 'candidate = kandidaat, customer = klant, customer_location = klantlocatie, vacancy = vacature.' },
    // Single-candidate path: the trigger supplies the candidate; bulk leaves this
    // empty. NO placeholder (Danny 23-07 ×2): grey example text reads as a set
    // value — the empty field is the real "all candidates from the previous step".
    { key: 'candidate_id', label: 'Kandidaat', type: 'text', help: '{{kandidaat.id}} = draait per kandidaat uit de vorige stap (bulk; leeg werkt ook). Voor één kandidaat: {{trigger.candidate_id}} (drill-down-knop of adreswijziging).' },
    // Bulk safety: skip candidates that already carry coordinates (protects PDOK).
    { key: 'only_missing', label: 'Alleen zonder coördinaten', type: 'boolean', help: 'Sla kandidaten over die al coördinaten hebben — aan te raden bij bulk.' },
    // WF-BUILDER-VELDEN-1 (PDOK-ENTITY-1): the bulk source set for klant/locatie/vacature
    // (never candidates — those come from the "Kandidaten ophalen" step instead).
    { key: 'all_records', label: 'Alle records van dit soort', type: 'boolean',
      help: 'Selecteert alle klanten / klantlocaties / vacatures (max. 10.000, gearchiveerde niet). Werkt niet voor kandidaten: die selecteer je met de stap "Kandidaten ophalen".' },
  ],
}

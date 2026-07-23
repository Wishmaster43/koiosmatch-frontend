// pdok_geocode module — turn a candidate's address into coordinates via PDOK
// (CAND-PDOK-WORKFLOW-1). Used by two seeded scenarios in the Kandidaten folder:
// the single-candidate one (the drill-down "Bijwerken" button / address-change
// event, candidate via {{trigger.candidate_id}}) and the bulk one (a
// candidates-fetch step supplies the set; "alleen zonder coördinaten" guards PDOK).
// Icon: an own-design vector mark (PdokMark, mirrors ShiftManagerMark) — the raster
// PDOK logo pixelates at node size (Danny 22-07); the real logo stays on the
// drill-down Koppelingen card.
import PdokMark from '../components/ui/PdokMark'

export default {
  type:     'pdok_geocode',
  label:    'Adres geocoderen (PDOK)',
  category: 'Kandidaten',
  Icon:     PdokMark,
  color:    '#1B4C8C',
  bg:       '#E8F0FA',
  schema: [
    // Single-candidate path: the trigger supplies the candidate; bulk leaves this
    // empty. NO placeholder (Danny 23-07 ×2): grey example text reads as a set
    // value — the empty field is the real "all candidates from the previous step".
    { key: 'candidate_id', label: 'Kandidaat', type: 'text', help: 'Leeg of {{id}} = alle kandidaten uit de vorige stap (bulk). Voor één kandidaat: {{trigger.candidate_id}} (drill-down-knop of adreswijziging).' },
    // Bulk safety: skip candidates that already carry coordinates (protects PDOK).
    { key: 'only_missing', label: 'Alleen zonder coördinaten', type: 'boolean', help: 'Sla kandidaten over die al coördinaten hebben — aan te raden bij bulk.' },
  ],
}

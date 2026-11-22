// helloflex_links_check module (BE HF-WORKFLOWS-1 W10, App\Workflow\Modules\HelloFlexLinksCheckModule): the
// passthrough ENRICHER that heads every connector scenario (HF-MATCH-ROUTER-1, Danny 21-11). No config: the
// entity is derived from the bundle segment. Per record it writes `helloflex_links` with, per link key
// (candidate, customer, contact, branch, user, cost_center, customer_location), `{linked, external_id, creatable}` and the flags
// the router edges key on: `required_linked` (bool), `missing_creatable`, `missing_link_only` and
// `missing_required_link_only` (lists). The filter picker reads those as `<segment>.0.helloflex_links.*`
// from the BE module catalogue (GET /workflows/modules output_fields), never from a FE copy.
// Offered on the HelloFlex app OR the hf module (CONNECTOR-VS-REPORTING-1); no egress, never a start node.
import { Link } from 'lucide-react'
import { tint } from '@/lib/tint'

export default {
  type:     'helloflex_links_check',
  module:   'hf',
  app:      'hf',
  category: 'helloflex',
  label:    'Check HelloFlex links',
  Icon:     Link,
  color:    'var(--module-helloflex)',
  bg:       tint('var(--module-helloflex)', 12),
  schema: [
  ],
}

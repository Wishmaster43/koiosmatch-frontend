// helloflex_link_employer module (BE HF-WORKFLOWS-1 §7, App\Workflow\Modules\HelloFlexLinkEmployerModule): LINK-ONLY.
// No config: the bundle segment decides the target (customers → employer, customer_locations → employer site,
// customer_departments → cost center). It searches HelloFlex (name or KvK for employers, code for cost centers),
// writes the mapping row when found and NEVER creates anything (HF-EMPLOYER-WRITES-1); it writes `helloflex_links`
// onto the record like helloflex_links_check so a router can follow it. A connector step: offered on the HelloFlex
// app OR the hf module (CONNECTOR-VS-REPORTING-1); never a start node.
import HelloFlexMark from '@/components/ui/HelloFlexMark'
import { tint } from '@/lib/tint'

export default {
  type:     'helloflex_link_employer',
  module:   'hf',
  app:      'hf',
  category: 'helloflex',
  label:    'Link HelloFlex employer or cost center',
  Icon:     HelloFlexMark,
  color:    'var(--module-helloflex)',
  bg:       tint('var(--module-helloflex)', 12),
  schema: [
  ],
}

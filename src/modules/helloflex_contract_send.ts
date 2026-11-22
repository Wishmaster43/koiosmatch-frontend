// helloflex_contract_send module (BE HF-WORKFLOWS-1 W4, App\Workflow\Modules\HelloFlexContractSendModule): send
// the contract of the match in the bundle to HelloFlex through the ONE ContractSendService (the same path as
// the manual button and the bulk route). No config. A 409 refusal ends the step as `skipped` with its reason
// code in output.reason_code (a business answer, never failed); a transport failure fails the step. A connector
// WRITE step: offered on the HelloFlex app OR the hf module (CONNECTOR-VS-REPORTING-1); blocked in a dry run.
import HelloFlexMark from '@/components/ui/HelloFlexMark'
import { tint } from '@/lib/tint'

export default {
  type:     'helloflex_contract_send',
  module:   'hf',
  app:      'hf',
  category: 'helloflex',
  label:    'Send HelloFlex contract',
  Icon:     HelloFlexMark,
  color:    'var(--module-helloflex)',
  bg:       tint('var(--module-helloflex)', 12),
  schema: [
  ],
}

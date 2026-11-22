// helloflex_contact_update module (BE HF-WORKFLOWS-1 §7, the contact twin of HelloFlexCandidateUpdateModule): send the
// chosen outbound fields of a LINKED customer contact to HelloFlex (an unlinked one is skipped not_linked).
// A connector WRITE step: offered on the HelloFlex app OR the hf module (CONNECTOR-VS-REPORTING-1), the same
// predicate the BE ConnectorRequirements checks; blocked in a dry run. Field keys mirror configSchema() exactly.
import HelloFlexMark from '@/components/ui/HelloFlexMark'
import { tint } from '@/lib/tint'
import { HELLOFLEX_OUTBOUND_CONTACT_COLUMNS } from './_helloflexFields'

export default {
  type:     'helloflex_contact_update',
  module:   'hf',
  app:      'hf',
  category: 'helloflex',
  label:    'Update HelloFlex contact',
  Icon:     HelloFlexMark,
  color:    'var(--module-helloflex)',
  bg:       tint('var(--module-helloflex)', 12),
  schema: [
    // The outbound contact columns of the BE ContactFieldMap. No FE default on purpose: the BE defaults
    // to every column and both sides read an empty list as "all" (same idiom as helloflex_candidate_update).
    { key: 'fields', label: 'Fields to send', type: 'multiselect', options: HELLOFLEX_OUTBOUND_CONTACT_COLUMNS,
      help: 'Empty = every outbound field.' },
  ],
}

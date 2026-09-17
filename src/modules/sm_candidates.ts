// sm_candidates module — fetch candidates from Shiftmanager.
import ShiftManagerMark from '../components/ui/ShiftManagerMark'
import { tintBg } from '@/lib/tint'
import { SM_CONNECTION_FIELD, smLimitField } from './_smFields'

export default {
  type:  'sm_candidates',
  // GET/read side: gated on the reports MODULE 'sm' (Danny 23-07); the connector app only gates the POST/PATCH coupling side.
  module: 'sm',
  category: 'Shiftmanager',
  label: 'Kandidaten',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  // §4 house tint (HUISSTIJL-1): the shared helper, not a hand-rolled color-mix literal.
  bg:    tintBg('var(--module-shiftmanager)'),
  schema: [
    // Which Shiftmanager link to sync from (tenant-scoped options from the API).
    SM_CONNECTION_FIELD,
    { key: 'search',   label: 'Zoeken',           type: 'text',   placeholder: 'naam of e-mail' },
    // Vocabulary measured against the BE sync module (CMBE c90a69ed): the raw SM
    // status column knows actief/nietactief — 'inactief'/'beschikbaar' never matched.
    { key: 'status',   label: 'Status',           type: 'select', options: ['alle', 'actief', 'nietactief'], default: 'alle' },
    smLimitField(500),
    { key: 'order_by', label: 'Sortering',        type: 'select', options: ['naam', 'inschrijfdatum'], default: 'naam' },
  ],
}

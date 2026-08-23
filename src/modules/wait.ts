// wait module — WF-WAIT-NODE-FE-1: the engine's ONE pause primitive. Backend-Claude
// measured that the engine NEVER knew the FE 'delay'/'sleep' types (every saved step
// of either rendered "Onbekende module", 0 stored across all tenants) — both FE
// configs are deleted; every "wait" use folds into this single node. Field keys mirror
// App\Workflow\Modules\WaitModule::configSchema() exactly: an absolute date already on
// the bundle (until_field), or a relative delay (days + hours, additive) that can roll
// a weekend moment to Monday. Category/icon/colour mirror the old delay card.
import { Clock } from 'lucide-react'
import { tintBg } from '@/lib/tint'

export default {
  type:  'wait',
  category: 'Flow beheer',
  label: 'Wachten',
  Icon:  Clock,
  color: 'var(--module-warmgrey)',
  bg:    tintBg('var(--module-warmgrey)'),
  schema: [
    { key: 'until_field',   label: 'Wachten tot veld', type: 'text',    placeholder: 'available_again_date' },
    { key: 'days',          label: 'Of: aantal dagen', type: 'number',  placeholder: '0' },
    // Additive with `days` (1 dag + 3 uur) — the former FE 'delay'/'sleep' nodes'
    // own duration field folds into this one.
    { key: 'hours',         label: 'Plus: aantal uren', type: 'number', placeholder: '0',
      hint: 'Opgeteld bij de dagen (bv. 1 dag + 3 uur).' },
    // Only applies to the relative delay above, never to an explicit until_field date.
    { key: 'skip_weekends', label: 'Weekend overslaan', type: 'boolean', default: false,
      hint: 'Valt het moment in het weekend, dan wordt het maandag op dezelfde tijd.' },
  ],
}

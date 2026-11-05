// koios_advice module — the ONE workflow step that asks Koios AI for a cached
// advice verdict on a candidate/application/vacancy/customer/match
// (KOIOS-ADVIES-OVERAL-1, K-266/K-267/K-267a). Mirrors App\Workflow\Modules\
// KoiosAdviceModule::configSchema() (measured 04-09, koiosmatch-api): five
// fields, `mode` allows exactly 'subject' (the trigger/manual record) or
// 'list' (every row the previous fetch step emitted — bulk). NOT a start
// module (VERTREKMODULE-1): it always runs after an entity node/fetch step
// that supplies the record(s), never as the workflow's own point of origin.
// Gated on the `koios_ai` billing module (same gate as the backend's
// per-record refresh endpoints, `module:koios_ai`).
//
// Output variables (Make-parity, mirrors KoiosAdviceModule::outputFields() —
// documented here as a comment, not a schema field, same idiom as
// application_lookup.ts): `advice_status` ('completed' | 'partial' | 'skipped'),
// `advice_processed` (records advised), `advice_skipped` (records skipped —
// fresh or not found), `advice_vacancy_pairs` (candidate-advice pairs refreshed,
// vacancy entity only).
import { Sparkles } from 'lucide-react'
import { tint } from '@/lib/tint'

export default {
  type:     'koios_advice',
  category: 'ai',
  label:    'Koios advice',
  Icon:     Sparkles,
  color:    'var(--color-violet)',
  bg:       tint('var(--color-violet)', 6),
  module:   'koios_ai',
  // No `tab:` on any field (unlike ai_agent.ts): ConfigPanel's tabbed layout
  // (general/instructions/advanced) is hardcoded to `type === 'ai_agent'`
  // (MODULE-FACE-BEVRIES) — any OTHER module stays on the generic "Settings"
  // tab, which filters OUT fields carrying a `tab` property. Tagging these
  // fields would silently make them unreachable in the panel.
  schema: [
    { key: 'entity', label: 'Entity', type: 'select', default: 'candidate',
      options: ['candidate', 'application', 'vacancy', 'customer', 'match'] },
    // REPAIR N8: the hint spells out what the DISPLAYED option labels mean
    // ("Eén record" / "Lijst (bulk)" — the fieldOptions translations of
    // 'subject'/'list'), never the raw stored token: a non-NL reader sees
    // "Single record" in the dropdown and must find that exact phrase again
    // in the hint below it, not the untranslated enum value.
    { key: 'mode', label: 'Mode', type: 'select', default: 'subject',
      options: ['subject', 'list'],
      hint: '"Single record" = the trigger/manual record; "List (bulk)" = every row from the previous fetch step.' },
    { key: 'force', label: 'Always refresh', type: 'boolean', default: false,
      hint: 'Always make a new AI call, even if there is recent advice' },
    { key: 'max_age_hours', label: 'Refresh window (hours)', type: 'number', default: 24,
      hint: 'Advice younger than this many hours is skipped unless "Always refresh" is on.' },
    { key: 'max_records', label: 'Maximum records per run', type: 'number', default: 100,
      hint: 'Hard ceiling on the number of records this step advises in one run ("List (bulk)" mode).' },
  ],
}

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
  category: 'AI',
  label:    'Koios-advies',
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
    { key: 'entity', label: 'Entiteit', type: 'select', default: 'candidate',
      options: ['candidate', 'application', 'vacancy', 'customer', 'match'] },
    // REPAIR N8: the hint spells out what the DISPLAYED option labels mean
    // ("Eén record" / "Lijst (bulk)" — the fieldOptions translations of
    // 'subject'/'list'), never the raw stored token: a non-NL reader sees
    // "Single record" in the dropdown and must find that exact phrase again
    // in the hint below it, not the untranslated enum value.
    { key: 'mode', label: 'Modus', type: 'select', default: 'subject',
      options: ['subject', 'list'],
      hint: '"Eén record" = de trigger-/handmatige record; "Lijst (bulk)" = elke rij uit de vorige ophaal-stap.' },
    { key: 'force', label: 'Altijd vernieuwen', type: 'boolean', default: false,
      hint: 'Altijd een nieuwe AI-call, ook als er recent advies is' },
    { key: 'max_age_hours', label: 'Verversingstermijn (uren)', type: 'number', default: 24,
      hint: 'Een advies jonger dan dit aantal uren wordt overgeslagen tenzij "Altijd vernieuwen" aan staat.' },
    { key: 'max_records', label: 'Maximum records per run', type: 'number', default: 100,
      hint: 'Harde bovengrens op het aantal records dat één keer van deze stap advies krijgt (modus "list").' },
  ],
}

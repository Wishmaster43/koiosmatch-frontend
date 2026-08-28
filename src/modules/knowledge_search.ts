// knowledge_search module — search the knowledge base (requires the AI Agent app).
import { BookOpen } from 'lucide-react'

export default {
  type:  'knowledge_search',
  module: 'aiagents',
  category: 'AI',
  label: 'Kennisbank Zoeken',
  Icon:  BookOpen,
  color: 'var(--module-teal-strong)',
  bg:    'color-mix(in srgb, var(--module-teal-strong) 10%, transparent)',
  schema: [
    { key: 'query',       label: 'Zoekopdracht',    type: 'text',   placeholder: '{{vraag van kandidaat}}' },
    { key: 'limit',       label: 'Max. resultaten', type: 'number', placeholder: '50' },
    // 'files' (knowledge scoping) REMOVED (r2): the engine reads AiKnowledge::all()
    // — no id-filter exists server-side (CMBE-measured), so the multiselect was a
    // fake affordance (§3) carrying tenant-branded literals. The real scoping
    // feature is parked as KNOWLEDGE-SCOPE-1 (Danny-GO): BE engine-filter +
    // files-contract, FE lookup-multiselect on GET /ai/knowledge/lookup.
  ],
}

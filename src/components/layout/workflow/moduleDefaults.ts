/**
 * defaultConfigFor — DEFAULT-PERSIST-1: seeds a freshly created node's config with
 * every schema field's `default`, so what the panel SHOWS (FieldInput's own
 * `value ?? field.default` fallback, fields.tsx) is also what gets PERSISTED and
 * what the engine reads — a schema `default` was display-only until now (a new
 * node started at `config: {}`, flowToSteps persisted that verbatim, and the
 * engine never merges schema defaults either). Only fields that declare a
 * `default` are seeded; a showIf-hidden field still gets one, since the engine
 * reads the raw stored config, never the panel's current tab visibility. This
 * only runs at node CREATION (useWorkflowEditor.insertModule) — an existing
 * saved node is never retro-migrated here.
 */
import { MODULE_SCHEMAS } from '@/modules/index'
import type { SchemaField } from '@/modules/types'

export function defaultConfigFor(type: string): Record<string, unknown> {
  const schema = (MODULE_SCHEMAS[type] ?? []) as SchemaField[]
  const config: Record<string, unknown> = {}
  for (const field of schema) {
    if (field.default !== undefined) config[field.key] = field.default
  }
  return config
}

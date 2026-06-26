/**
 * Workflow-module registry types. Each module file default-exports a `ModuleDef`;
 * the schema is a list of config-panel fields. Both are kept deliberately loose
 * (index signatures) because field shapes vary per module type (text/select/
 * filters/keyvalue/…) and per-entity extras are appended verbatim.
 */
import type { ComponentType } from 'react'

// One config-panel field for a module. `type` selects the editor; extra keys
// (options/placeholder/fields/showIf/default/help/…) vary by field type.
export interface SchemaField {
  key: string
  label?: string
  type?: string
  [k: string]: unknown
}

// A workflow building block: display meta + its config schema + gating hints.
export interface ModuleDef {
  type: string
  label: string
  // Mirrors the lucide icon contract (size); the SM/HF marks match it too.
  Icon: ComponentType<{ size?: number }>
  category?: string
  color?: string
  bg?: string
  schema?: SchemaField[]
  app?: string | string[]
  makeType?: string | string[]
  [k: string]: unknown
}

/**
 * catalogToSchema — PURE: converts a catalogue section's rows to a SchemaSection
 * schema. Only rows with ui === 'generic' are included (dedicated rows stay on
 * their own screens).
 */
import { CatalogRow } from './catalogTypes'

export interface SchemaField {
  key: string
  type: 'toggle' | 'number' | 'text' | 'select' | 'secret' | 'json'
  default: unknown
  min?: number
  max?: number | undefined
  step?: number
  options?: Array<{ value: string; label: string }>
  labelKey: string
  helpKey?: string
  format?: string
  // CATALOG-GROUPS-1: the block this field renders in.
  group?: string
}

// One titled block on the screen (CATALOG-GROUPS-1): slug, label key and lucide icon name.
export interface SchemaGroup {
  key: string
  labelKey: string
  icon?: string | null
}

export interface Schema {
  i18nKey: string
  fields: SchemaField[]
  // CATALOG-GROUPS-1: blocks in the section's own order; absent = one headless list.
  groups?: SchemaGroup[]
  // The section's colour (hex from the contract) paints the group icons.
  color?: string | null
}

// The section metadata the mapper needs beside its rows.
export interface SchemaSectionMeta {
  groups?: string[]
  color?: string | null
}

export function catalogToSchema(sectionId: string, rows: CatalogRow[], meta: SchemaSectionMeta = {}): Schema {
  // Generic rows only, and never a pattern row (a key family has no single field to render).
  const genericRows = rows.filter(row => row.ui === 'generic' && !row.pattern)

  const fields: SchemaField[] = genericRows.map(row => {
    let fieldType: SchemaField['type'] = 'text'
    let min: number | undefined
    let max: number | undefined
    let step: number | undefined
    let options: Array<{ value: string; label: string }> | undefined
    let format: string | undefined

    // Map the catalogue type to the schema type and add type-specific properties.
    switch (row.type) {
      case 'boolean':
        fieldType = 'toggle'
        break
      case 'integer':
        fieldType = 'number'
        if (row.constraints?.min !== undefined) min = row.constraints.min
        if (row.constraints?.max !== undefined && row.constraints.max !== null) max = row.constraints.max
        if (row.constraints?.step !== undefined) step = row.constraints.step
        break
      case 'string':
        fieldType = 'text'
        break
      case 'secret':
        fieldType = 'secret'
        break
      case 'enum':
        fieldType = 'select'
        // The contract carries the option label key itself (§1 options[].label_key); a bare
        // string option (measured on string_list rows) reads as its own label.
        options = (row.options ?? []).map(opt => typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.label_key })
        break
      case 'json':
        fieldType = 'json'
        format = row.format
        break
    }

    // The settings bag stores strings: text/secret rows start as '' (never null) and a
    // json row lives in the form as its JSON string (jsonFormat renders/parses it).
    const defaultValue = fieldType === 'json'
      ? (typeof row.default === 'string' ? row.default : JSON.stringify(row.default ?? null))
      : (fieldType === 'text' || fieldType === 'secret') ? String(row.default ?? '') : row.default
    const field: SchemaField = {
      key: row.key,
      type: fieldType,
      default: defaultValue,
      labelKey: row.label_key,
      ...(row.help_key && { helpKey: row.help_key }),
      ...(min !== undefined && { min }),
      ...(max !== undefined && { max }),
      ...(step !== undefined && { step }),
      ...(options && { options }),
      ...(format && { format }),
      ...(row.group && { group: row.group }),
    }

    return field
  })

  // Blocks in the section's declared order; a group a row names but the section does not
  // list still gets a block (appended in first-appearance order), so no row goes missing.
  const groupMeta = new Map<string, SchemaGroup>()
  genericRows.forEach(row => {
    if (row.group && !groupMeta.has(row.group)) {
      groupMeta.set(row.group, { key: row.group, labelKey: row.group_label_key ?? `settings.groups.${row.group}`, icon: row.group_icon ?? null })
    }
  })
  const order = [...(meta.groups ?? []).filter(g => groupMeta.has(g)), ...[...groupMeta.keys()].filter(g => !(meta.groups ?? []).includes(g))]
  const groups = order.map(g => groupMeta.get(g)!)

  return {
    i18nKey: `catalog.sections.${sectionId}`,
    fields,
    ...(groups.length > 0 && { groups }),
    ...(meta.color && { color: meta.color }),
  }
}

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
}

export interface Schema {
  i18nKey: string
  fields: SchemaField[]
}

export function catalogToSchema(sectionId: string, rows: CatalogRow[]): Schema {
  // Filter to generic rows only.
  const genericRows = rows.filter(row => row.ui === 'generic')

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
        // The contract carries the option label key itself (§1 options[].label_key).
        options = (row.options ?? []).map(opt => ({ value: opt.value, label: opt.label_key }))
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
    }

    return field
  })

  return {
    i18nKey: `catalog.sections.${sectionId}`,
    fields,
  }
}

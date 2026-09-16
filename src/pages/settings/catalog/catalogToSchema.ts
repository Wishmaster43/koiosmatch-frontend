/**
 * catalogToSchema — PURE: converts a catalogue section's rows to a SchemaSection
 * schema. Only rows with ui === 'generic' are included (dedicated rows stay on
 * their own screens). CATALOG-EMBED-1: passing `meta.group` narrows the result to
 * that ONE group's rows, rendered as a single block headed by the SECTION's own
 * title/icon (see catalogFixture-shaped callers under CatalogSection.tsx) — the
 * host screen already names the entity, so the group's own label would repeat it.
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
  // O23 UNIT-NAAST-BEDRAG-1: a select that renders inline right of the number field
  // it names, never as its own row — the value is that field's key.
  unitOf?: string
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
  // CATALOG-EMBED-1 (F6): the section id, so a group block's DOM id can be namespaced
  // by section+group — two different sections can legally share a group slug (e.g. a
  // host that later embeds both "windows/candidates" and "retention/candidates"), and
  // a bare group-keyed id would collide between them.
  sectionId?: string
}

// The section metadata the mapper needs beside its rows.
export interface SchemaSectionMeta {
  groups?: string[]
  color?: string | null
  // CATALOG-EMBED-1: render only this one group's rows, as a single block.
  group?: string
  // The section's own lucide icon (contract §2) — the heading icon when `group`
  // narrows to one block AND the heading reads the section title (default).
  sectionIcon?: string | null
  // CATALOG-EMBED-1 (F1): whether the single narrowed block gets a heading at all —
  // page mode already says the section title as its PageTitle, so the block renders
  // HEADLESS there (headed: false); embedded mode has no other label, so it stays
  // headed (default true / undefined).
  headed?: boolean
  // CATALOG-EMBED-1 (F1): which label the block heading reads, when headed. Default
  // 'section' repeats the section's own title (fine when the host names a DIFFERENT
  // concept, e.g. WhatsApp hosting "windows/conversations"); 'group' reads the row's
  // own group label instead — for a host whose page title ALREADY says the section
  // (the candidate retention screen embedding "retention/candidates" would otherwise
  // repeat "Bewaartermijnen" under itself).
  headedBy?: 'section' | 'group'
}

export function catalogToSchema(sectionId: string, rows: CatalogRow[], meta: SchemaSectionMeta = {}): Schema {
  // Generic rows only, never a pattern row, and — when the caller narrows to one
  // group (CATALOG-EMBED-1) — only that group's rows.
  const genericRows = rows.filter(row => row.ui === 'generic' && !row.pattern && (!meta.group || row.group === meta.group))

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

  // CATALOG-EMBED-1: a single requested group renders as ONE block — HEADLESS in
  // page mode (meta.headed === false: the page title already names the section),
  // headed otherwise, by the section's own title/icon (default) or the row's own
  // group label/icon (meta.headedBy === 'group', for a host whose page title
  // already says the section itself). An empty group yields no fields and no
  // block at all (CatalogSection renders nothing/the empty notice, never a raw pane).
  if (meta.group) {
    const firstRow = genericRows[0]
    const byGroup = meta.headedBy === 'group'
    const headingLabelKey = byGroup
      ? (firstRow?.group_label_key ?? `settings.groups.${meta.group}`)
      : `catalog.sections.${sectionId}.title`
    const headingIcon = byGroup ? (firstRow?.group_icon ?? null) : (meta.sectionIcon ?? null)
    const groups: SchemaGroup[] = fields.length > 0 && meta.headed !== false
      ? [{ key: meta.group, labelKey: headingLabelKey, icon: headingIcon }]
      : []
    return {
      i18nKey: `catalog.sections.${sectionId}`,
      fields,
      sectionId,
      ...(groups.length > 0 && { groups }),
      ...(meta.color && { color: meta.color }),
    }
  }

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
    sectionId,
    ...(groups.length > 0 && { groups }),
    ...(meta.color && { color: meta.color }),
  }
}

/**
 * Catalog types from DRAFT-SETTINGS-CATALOG-1 (§1–§8).
 *
 * Note: api-generated.ts has no 2xx response schema yet, so these are hand-written
 * from the contract. When the backend schema is complete, move these to api-generated.ts.
 */

// The catalogue row describing one setting key.
export interface CatalogRow {
  key: string
  section: string
  type: 'boolean' | 'integer' | 'string' | 'enum' | 'json' | 'secret'
  rules: string[]
  default: unknown
  options?: Array<{ value: string; label_key: string } | string>
  aliases: string[]
  label_key: string
  help_key?: string
  format?: 'required_fields_map' | 'string_list' | 'key_value' | 'kpi_order' | 'vacancy_tab_map' | 'proposal_template'
  constraints?: {
    min?: number
    max?: number | null
    step?: number
  }
  ui: 'generic' | 'dedicated'
  fe_screen: string | null
  // SETTINGS-CATALOG-1 (measured 10-09): a PATTERN row (`numbering.<entity>.start`,
  // `email_<context>_<field>`) describes a family of keys, never one field — the generic
  // screen skips it; the dedicated screen of that family owns it.
  pattern?: boolean
  // CATALOG-GROUPS-1 (Danny 10-09 22:50 "zorg dat de goed staan onderverdeeld"): the block a
  // row renders in, its label key (settings.groups.<slug>) and its lucide icon name.
  group?: string | null
  group_label_key?: string | null
  group_icon?: string | null
}

// One catalogue section: a fixed §2 id with its rows.
export interface CatalogSection {
  id: string
  keys: CatalogRow[]
  // SETTINGS-CATALOG-1: a section the BE hides from the generic screens (kpi today).
  hidden?: boolean
  // CATALOG-GROUPS-1: the ordered group slugs this section uses, its lucide icon and colour.
  groups?: string[]
  icon?: string | null
  color?: string | null
}

// NAV-PALETTE (BE e72b19fa): one icon + colour per settings navigation group key.
export interface CatalogNavEntry {
  key: string
  icon?: string | null
  color?: string | null
}

// The API response from GET /settings/catalog.
export interface SettingsCatalogResponse {
  data: {
    sections: CatalogSection[]
    version: string
    // Absent on a BE without the palette; the FE then colours only section-matching groups.
    nav?: CatalogNavEntry[]
  }
}

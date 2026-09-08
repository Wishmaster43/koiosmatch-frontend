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
  options?: Array<{ value: string; label_key: string }>
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
  fe_screen: string
}

// One catalogue section: a fixed §2 id with its rows.
export interface CatalogSection {
  id: string
  keys: CatalogRow[]
}

// The API response from GET /settings/catalog.
export interface SettingsCatalogResponse {
  data: {
    sections: CatalogSection[]
    version: string
  }
}

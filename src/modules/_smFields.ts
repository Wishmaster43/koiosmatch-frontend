// Shared Shiftmanager schema fields — the `connection_id` field (and the
// `limit` field shape) is repeated byte-identical across every sm_*.ts module;
// this is the one place that defines them so the family stays in sync when
// the endpoint, label or default changes (CLONE-BY-CONSTRUCTION-1).
import type { SchemaField } from './types'

// Which Shiftmanager link to sync from (tenant-scoped options from the API).
export const SM_CONNECTION_FIELD: SchemaField = {
  key: 'connection_id',
  label: 'Shiftmanager-account',
  type: 'lookup_select',
  endpoint: '/planning-connections',
}

// The "Max. items" number field — only the default (and optional placeholder) vary per module.
export function smLimitField(defaultValue: number): SchemaField {
  return { key: 'limit', label: 'Max. items', type: 'number', default: defaultValue, placeholder: String(defaultValue) }
}

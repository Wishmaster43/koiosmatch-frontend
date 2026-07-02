// makeEntityModule — builds a per-entity workflow module from a small config.
// One "Actie" selector (Ophalen / Aanmaken / Bijwerken / …) whose sections appear
// via `showIf`, so fetch + filter live inside the module. The standalone Filter
// and Router modules stay between modules (for multi-status branching).
//
// Keep entity files thin: pass the entity's filterable fields + sort keys here.
// Filter VALUES (status, pool, …) are typed for now; wire them to tenant lookups
// (useStatuses/usePools/…) next — never hardcode controlled vocabularies.
import type { ModuleDef, SchemaField } from './types'

interface EntityModuleConfig {
  type: string
  label: string
  category?: string
  Icon: ModuleDef['Icon']
  color?: string
  bg?: string
  actions?: string[]
  filterFields?: unknown[]
  sortOptions?: unknown[]
  schemaExtra?: SchemaField[]
  // Required billing module — forwarded so the picker can hide the node when off.
  module?: string
}

export default function makeEntityModule(cfg: EntityModuleConfig): ModuleDef {
  const {
    type, label, category, Icon, color, bg, module,
    actions      = ['Ophalen', 'Aanmaken', 'Bijwerken'],
    filterFields = [],
    sortOptions  = [],
    schemaExtra  = [],
  } = cfg

  return {
    type, label, category, Icon, color, bg,
    ...(module ? { module } : {}),
    schema: [
      // Action picker — drives which section shows (defaults to the first action).
      { key: 'action', label: 'Actie', type: 'select', default: actions[0], options: actions },

      // Ophalen — what to read: inline filters + sort + limit.
      { key: 'filters', label: 'Filters',         type: 'filters', fields: filterFields, showIf: { key: 'action', value: 'Ophalen' } },
      { key: 'sort',    label: 'Sortering',       type: 'select',  options: sortOptions,  showIf: { key: 'action', value: 'Ophalen' } },
      { key: 'limit',   label: 'Max. resultaten', type: 'number',  placeholder: '100',    showIf: { key: 'action', value: 'Ophalen' } },

      // Bijwerken — which records to update (a filter selects the set).
      { key: 'target',  label: 'Welke records?',  type: 'filters', fields: filterFields, showIf: { key: 'action', value: 'Bijwerken' } },

      // Aanmaken + Bijwerken — the field values to write.
      { key: 'fields',  label: 'Velden',          type: 'keyvalue', showIf: { key: 'action', value: ['Aanmaken', 'Bijwerken'] } },

      // Entity-specific extras (e.g. dated/reasoned status changes).
      ...schemaExtra,
    ],
  }
}

/**
 * useModuleView — resolves the configured, ordered, enabled blocks for a module.
 *
 * Combines the module registry (available blocks) with the saved per-module view
 * config (`view.<module>` = [{ id, enabled }] in display order). When nothing is
 * saved, falls back to the registry default order with every block enabled. New
 * blocks added to the registry later are appended automatically.
 */
import { useAllSettings, getJsonSetting } from './useAllSettings'
import { MODULES } from './moduleRegistry'

export function viewConfigKey(moduleId) {
  return `view.${moduleId}`
}

export function useModuleView(moduleId) {
  const values = useAllSettings()
  const blocks = MODULES[moduleId]?.blocks ?? []
  const saved = getJsonSetting(values, viewConfigKey(moduleId), null) // [{ id, enabled }]

  if (!Array.isArray(saved)) return blocks

  const byId = Object.fromEntries(blocks.map(b => [b.id, b]))
  const ordered = []
  saved.forEach(s => { if (s.enabled !== false && byId[s.id]) ordered.push(byId[s.id]) })
  // Append blocks added to the registry after the config was saved.
  const known = new Set(saved.map(s => s.id))
  blocks.forEach(b => { if (!known.has(b.id)) ordered.push(b) })
  return ordered
}

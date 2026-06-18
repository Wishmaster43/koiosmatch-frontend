/**
 * modules.js — central "does this tenant have module X?" capability check.
 *
 * The backend hard-gates the SM endpoints (/sm/*) on the 'sm' module and returns
 * 403 without it. The UI must mirror that: only show SM nav/pages for tenants
 * that have the module. This file is the single source of truth for that check —
 * import { hasModule } or use the AuthContext helper, never re-derive it ad hoc.
 *
 * Module keys: 'sm' (Shiftmanager) | 'hf' (HelloFlex) | 'ai' (AI & Workflow) |
 *              'ats' (ATS & CRM) | 'plan' (Planning).
 *
 * Source of truth: the tenant's `modules` array when the backend sends one
 * (GET /tenant-modules / /auth/me → tenant.modules), otherwise derived from the
 * tenant's `package` via the same matrix the Modules settings tab shows.
 * UI gating only — the backend still enforces 403 on every gated endpoint.
 */

// package id → module keys it grants. Mirrors PACKAGES in settings/ModulesSettings.
export const PACKAGE_MODULES = {
  reporting_sm:          ['sm'],
  reporting_hf:          ['hf'],
  reporting_sm_hf:       ['sm', 'hf'],
  reporting_sm_ai:       ['sm', 'ai'],
  reporting_hf_ai:       ['hf', 'ai'],
  reporting_sm_hf_ai:    ['sm', 'hf', 'ai'],
  ats_crm:               ['ats'],
  ats_crm_ai:            ['ats', 'ai'],
  ats_crm_planning:      ['ats', 'plan'],
  ats_crm_ai_planning:   ['ats', 'ai', 'plan'],
  // Legacy package IDs — kept for tenants not yet migrated.
  reporting_shiftmanager: ['sm'],
  reporting_helloflex:    ['hf'],
  ats_crm_aiagents:       ['ats', 'ai'],
  ats_crm_workflows:      ['ats', 'ai'],
  connect:                ['sm', 'hf', 'ai', 'ats', 'plan'],
}

const moduleKeyOf = (m) => (typeof m === 'string' ? m : m?.key ?? m?.name ?? null)

/** All module keys a tenant has — explicit `modules` array wins, else from package. */
export function tenantModules(tenant) {
  const explicit = tenant?.modules
  if (Array.isArray(explicit) && explicit.length) {
    return explicit.map(moduleKeyOf).filter(Boolean)
  }
  return PACKAGE_MODULES[tenant?.package] ?? []
}

/**
 * True if the tenant has the given module. Super admins always pass (the UI lets
 * them in; the backend still 403s if the switched-to tenant lacks the module).
 */
export function hasModule(moduleKey, tenant, { isSuperAdmin = false } = {}) {
  if (isSuperAdmin) return true
  if (!moduleKey) return false
  return tenantModules(tenant).includes(moduleKey)
}

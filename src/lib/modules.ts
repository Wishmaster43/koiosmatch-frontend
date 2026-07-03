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

import type { ModuleKey, Tenant } from '../types/api'

// package id → module keys it grants. Mirrors PACKAGES in settings/ModulesSettings.
export const PACKAGE_MODULES: Record<string, ModuleKey[]> = {
  // 3-package model (besloten 2026-06-23): base packages. Add-ons (plan/sm/hf/sm_ai)
  // are layered on top via the tenant.modules array the backend sends (base + add-ons);
  // these entries are only the package fallback when no explicit modules array is present.
  // Granular BE vocabulary (aligned 2026-07-03) — mirrors effectiveModules() so the
  // fallback (no explicit tenant.modules) grants the same pages as the live payload.
  core:                  ['ats'],
  pro:                   ['ats', 'whatsapp', 'aiagents', 'workflows', 'koios_ai'],
  enterprise:            ['ats', 'whatsapp', 'aiagents', 'workflows', 'koios_ai', 'apps', 'api', 'whatsapp_personal', 'insights'],
  // Legacy 10-package model — kept so existing tenants keep working (backward-compat).
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

type ModuleEntry = string | { key?: string; name?: string }

const moduleKeyOf = (m: ModuleEntry): ModuleKey | null =>
  (typeof m === 'string' ? m : m?.key ?? m?.name ?? null) as ModuleKey | null

/** All module keys a tenant has — explicit `modules` array wins, else from package. */
export function tenantModules(tenant?: Tenant | null): ModuleKey[] {
  const explicit = tenant?.modules
  if (Array.isArray(explicit) && explicit.length) {
    return explicit.map(moduleKeyOf).filter((k): k is ModuleKey => Boolean(k))
  }
  return PACKAGE_MODULES[tenant?.package ?? ''] ?? []
}

/**
 * True if the tenant has the given module. Super admins always pass (the UI lets
 * them in; the backend still 403s if the switched-to tenant lacks the module).
 */
export function hasModule(
  moduleKey: ModuleKey | string | null | undefined,
  tenant?: Tenant | null,
  { isSuperAdmin = false }: { isSuperAdmin?: boolean } = {},
): boolean {
  if (isSuperAdmin) return true
  if (!moduleKey) return false
  return tenantModules(tenant).includes(moduleKey as ModuleKey)
}

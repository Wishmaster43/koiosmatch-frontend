/**
 * access.js — two-layer UI gating.
 *
 * Layer 1 — Tenant/package: `accessible_pages` from the backend (login / /auth/me).
 *   Gated pages only appear when the tenant's package includes them.
 *   'apps' = integration connectors (ShiftManager/Intus etc.) — package 3 only.
 *
 * Layer 2 — Role/user: `page.*` permissions on `user.permissions`.
 *   If ANY `page.*` permission exists on the user, they act as a whitelist.
 *   No `page.*` permissions → all pages open (backward compatible for existing users).
 *
 * Everything here is cosmetic. The backend enforces real authorization on every endpoint.
 */

import { hasModule, tenantModules } from './modules'
import type { ModuleKey, Tenant } from '../types/api'

// What access.js reads off the AuthContext value (kept minimal + defensive).
interface UserLike { is_super_admin?: boolean; tenant?: Tenant | null; permissions?: unknown; accessible_pages?: string[] }
interface AuthLike { activeTenant?: Tenant | null; user?: UserLike | null; accessiblePages?: string[] }
type PermLike = string | { name?: string }

// Pages that require a paid add-on module. These are ALSO hard-gated server-side
// (e.g. /sm/* → 403 without the 'sm' module), so this is just UI mirroring.
const PAGE_REQUIRED_MODULE: Record<string, ModuleKey> = {
  shiftmanager: 'sm',
  helloflex:    'hf',
}

const ATS_BASE   = ['dashboard', 'candidates', 'applications', 'vacancies', 'matches', 'opportunities', 'tasks', 'customers', 'locations', 'departments', 'contacts', 'details', 'users']
const AI_PAGES   = ['aiagents', 'whatsapp', 'workflows', 'apps']
const PLANNING   = ['planning']

// Module key → pages it grants. A tenant's accessible pages are the union over its
// effective modules (base package + add-ons).
const MODULE_TO_PAGES: Record<string, string[]> = {
  ats:      ATS_BASE,
  ai:       AI_PAGES,
  plan:     PLANNING,
  sm:       ['shiftmanager'],
  sm_ai:    ['shiftmanager'],   // ShiftManager reporting + AI
  hf:       ['helloflex'],
  api:      [],                 // REST API lives in settings (no top-level nav page)
  insights: [],                 // Insights+ within reporting/settings (no separate gate yet)
}

const PACKAGE_PAGES: Record<string, string[]> = {
  reporting_sm:          ['shiftmanager'],
  reporting_hf:          ['helloflex'],
  reporting_sm_hf:       ['shiftmanager', 'helloflex'],
  reporting_sm_ai:       ['shiftmanager', ...AI_PAGES],
  reporting_hf_ai:       ['helloflex',    ...AI_PAGES],
  reporting_sm_hf_ai:    ['shiftmanager', 'helloflex', ...AI_PAGES],
  ats_crm:               ATS_BASE,
  ats_crm_ai:            [...ATS_BASE, ...AI_PAGES],
  ats_crm_planning:      [...ATS_BASE, ...PLANNING],
  ats_crm_ai_planning:   [...ATS_BASE, ...AI_PAGES, ...PLANNING],
  // Legacy IDs — kept for backwards compatibility during migration
  reporting_shiftmanager: ['shiftmanager'],
  reporting_helloflex:    ['helloflex'],
  ats_crm_aiagents:       [...ATS_BASE, ...AI_PAGES],
  ats_crm_workflows:      [...ATS_BASE, ...AI_PAGES],
  connect:                [...ATS_BASE, ...AI_PAGES, ...PLANNING, 'shiftmanager', 'helloflex'],
}

// First page to land on per package (when dashboard is not available)
export const PACKAGE_DEFAULT_PAGE: Record<string, string> = {
  reporting_sm:           'shiftmanager',
  reporting_hf:           'helloflex',
  reporting_sm_hf:        'shiftmanager',
  reporting_sm_ai:        'shiftmanager',
  reporting_hf_ai:        'helloflex',
  reporting_sm_hf_ai:     'shiftmanager',
  // Legacy
  reporting_shiftmanager: 'shiftmanager',
  reporting_helloflex:    'helloflex',
}

// All pages that require an explicit package grant.
const GATED_PAGES = [
  'dashboard',
  'candidates', 'applications', 'vacancies', 'matches', 'opportunities', 'tasks',
  'customers', 'locations', 'departments', 'contacts',
  'planning', 'details',
  'shiftmanager', 'helloflex',
  'aiagents', 'workflows', 'whatsapp', 'apps',
  'users',
]

// Sub-page gates: the sub-page is only visible when the named top-level page is accessible.
const SUB_PAGE_GATES: Record<string, string> = {
  'details.runs':     'aiagents',
  'details.messages': 'whatsapp',
}

// Pages that can additionally be restricted at the user/role level via page.* permissions.
const PAGE_RESTRICTABLE = [
  'candidates', 'customers', 'locations', 'departments', 'details',
]

// Module pages shown in the "Modules" nav group. Driven by accessible_pages.
export const MODULE_PAGES: { id: string; label: string; soon?: boolean }[] = [
  { id: 'shiftmanager', label: 'Rapportage Shiftmanager' },
  { id: 'helloflex',    label: 'Rapportage HelloFlex', soon: true },
  { id: 'aiagents',     label: 'AI Agents' },
  { id: 'workflows',    label: 'Workflows' },
  { id: 'whatsapp',     label: 'WhatsApp'  },
]

function accessiblePages(auth?: AuthLike | null): string[] | null {
  const tenant = auth?.activeTenant ?? auth?.user?.tenant ?? null
  // Derive from the tenant's effective modules (base package + add-ons); explicit
  // tenant.modules wins, otherwise from the package id. This reproduces the legacy
  // PACKAGE_PAGES exactly and lets add-ons extend access with no separate map.
  const modules = tenantModules(tenant)
  if (modules.length > 0) {
    const pages = new Set<string>()
    modules.forEach(m => (MODULE_TO_PAGES[m] ?? []).forEach(p => pages.add(p)))
    if (pages.size > 0) return [...pages]
  }
  // Legacy fallback: explicit package→pages map, then backend accessible_pages.
  const pkg = tenant?.package ?? null
  if (pkg && PACKAGE_PAGES[pkg]) return PACKAGE_PAGES[pkg]
  const fromBackend = auth?.accessiblePages ?? auth?.user?.accessible_pages ?? []
  if (fromBackend.length > 0) return fromBackend
  // Last resort: no package and no pages → assume full access (legacy/dev).
  return null
}

function hasAccess(pageId: string, auth?: AuthLike | null): boolean {
  const pages = accessiblePages(auth)
  if (pages === null) return true // no restrictions configured
  return pages.includes(pageId)
}

/**
 * Returns true if the user may open the given page.
 * Checks both: (1) tenant package / accessible_pages, (2) user role page.* permissions.
 */
export function canAccessPage(pageId: string, auth?: AuthLike | null): boolean {
  const base = String(pageId ?? '').split('.')[0]

  // Super admins always see everything
  if (auth?.user?.is_super_admin === true) return true

  // Module gate: SM/HF pages require the matching paid add-on module.
  const reqModule = PAGE_REQUIRED_MODULE[base]
  if (reqModule && !hasModule(reqModule, auth?.activeTenant ?? auth?.user?.tenant)) return false

  // Sub-page gates (e.g. details.runs needs aiagents, details.messages needs whatsapp)
  if (SUB_PAGE_GATES[pageId] && !hasAccess(SUB_PAGE_GATES[pageId], auth)) return false

  // Layer 1: tenant-level gating
  if (GATED_PAGES.includes(base) && !hasAccess(base, auth)) return false

  // Layer 2: role-level page whitelist (page.* permissions).
  // Guard with Array.isArray: user.permissions may be absent or non-array on some backends.
  if (PAGE_RESTRICTABLE.includes(base)) {
    const permsRaw = auth?.user?.permissions
    const perms: PermLike[] = Array.isArray(permsRaw) ? permsRaw : []
    const nameOf = (p: PermLike): string => (typeof p === 'string' ? p : (p?.name ?? ''))
    const pagePerms = perms.filter(p => nameOf(p).startsWith('page.'))
    if (pagePerms.length > 0) {
      return pagePerms.some(p => nameOf(p) === `page.${base}`)
    }
  }

  return true
}

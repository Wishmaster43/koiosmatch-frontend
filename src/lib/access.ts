/**
 * access.js — two-layer UI gating.
 *
 * Layer 1 — Tenant/package: `accessible_pages` from the backend (login / /auth/me).
 *   Gated pages only appear when the tenant's package includes them.
 *   'apps' = integration connectors (Shiftmanager/Intus etc.) — package 3 only.
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
// Pages module-gated on a granular BE key (COORDINATION-LOG 2026-07-03). Gate applies to
// EVERYONE incl. super-admins → a package-switch shows/hides these. Also 403'd server-side.
const PAGE_REQUIRED_MODULE: Record<string, ModuleKey> = {
  shiftmanager: 'sm',
  helloflex:    'hf',
  reports:      'reports',
  planning:     'plan',
  aiagents:     'aiagents',
  workflows:    'workflows',
  whatsapp:     'whatsapp',
  apps:         'apps',
}

const ATS_BASE   = ['dashboard', 'candidates', 'applications', 'vacancies', 'matches', 'opportunities', 'tasks', 'outreach', 'customers', 'locations', 'departments', 'contacts', 'details', 'users']
const AI_PAGES   = ['aiagents', 'whatsapp', 'workflows', 'apps']  // kept for the legacy PACKAGE_PAGES map
const PLANNING   = ['planning']

// Module key → pages it grants. Keyed on the granular BE vocabulary that tenant.modules
// emits — one key per page, no synthetic 'ai'/'ats' bundles. A tenant's accessible pages
// are the union over its effective modules (base package + add-ons).
const MODULE_TO_PAGES: Record<string, string[]> = {
  ats:               ATS_BASE,         // CRM/ATS core — every base package carries 'ats'
  aiagents:          ['aiagents'],
  workflows:         ['workflows'],
  whatsapp:          ['whatsapp'],
  apps:              ['apps'],
  koios_ai:          [],               // Koios AI assistant — gated via canUseKoios, no nav page
  plan:              PLANNING,
  sm:                ['shiftmanager'],
  sm_ai:             ['shiftmanager'], // legacy alias → SM reporting
  hf:                ['helloflex'],
  reports:           ['reports'],
  api:               [],               // REST API lives in settings (no top-level nav page)
  insights:          [],               // Insights+ within reporting/settings (no separate gate yet)
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
  'candidates', 'applications', 'vacancies', 'matches', 'opportunities', 'tasks', 'outreach',
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
  // SM standalone AI/WhatsApp pages: Uitvoeringen needs aiagents, the SM messages
  // page (shiftmanager.details, now WhatsApp-only) needs whatsapp.
  'shiftmanager.runs-table': 'aiagents',
  'shiftmanager.details':    'whatsapp',
  // RAPPORTEN-WHATSAPP-FE-1: the whatsapp report route sits behind
  // module:whatsapp server-side; gate the page (and thus the sidebar entry —
  // Sidebar filters children through canAccessPage) the same way.
  'reports.whatsapp': 'whatsapp',
  // Deep-link-only destination behind the coupling_errors KPI (K-173 fase 5) —
  // no sidebar entry, gated the same as its parent list (candidates).
  'coupling-errors': 'candidates',
}

// Pages that can additionally be restricted at the user/role level via page.*
// permissions — this MUST list every page id the backend seeds a page.<id>
// permission for (RoleAndPermissionSeeder), otherwise that toggle looks real in
// the Roles UI but never actually gates navigation: a fake affordance (§3, RECHTEN-
// UI-1 #2 — only 5 of the 15 seeded page.* ids were nav-effective before this fix).
const PAGE_RESTRICTABLE = [
  'settings', 'users', 'candidates', 'vacancies', 'customers', 'locations',
  'departments', 'details', 'opportunities', 'tasks', 'outreach', 'planning',
  'whatsapp', 'aiagents', 'workflows',
]

// Module pages shown in the "Modules" nav group. Driven by accessible_pages.
export const MODULE_PAGES: { id: string; label: string; soon?: boolean }[] = [
  { id: 'shiftmanager', label: 'Rapportage Shiftmanager' },
  { id: 'helloflex',    label: 'Rapportage HelloFlex', soon: true },
  { id: 'aiagents',     label: 'AI Agents' },
  { id: 'workflows',    label: 'Workflows' },
  { id: 'whatsapp',     label: 'WhatsApp'  },
]

// Resolves the tenant's accessible page ids, in priority order: effective modules
// (base package + add-ons), then the legacy package→pages map, then whatever the
// backend already computed; null means "no restrictions configured".
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

// True when the tenant's own page list (above) includes this exact page id, or
// when no restriction list exists at all.
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

  // Module gate applies to EVERYONE — including super admins: an off module isn't provisioned
  // for the tenant, so its pages stay hidden everywhere (Danny 2026-07-02). Server 403s too.
  const reqModule = PAGE_REQUIRED_MODULE[base]
  if (reqModule && !hasModule(reqModule, auth?.activeTenant ?? auth?.user?.tenant)) return false

  // Super admins bypass the role/access-page gates below (but not the module gate above).
  if (auth?.user?.is_super_admin === true) return true

  // Sub-page gates (e.g. details.runs needs aiagents, details.messages needs
  // whatsapp). RECURSIVE on purpose (Opus B2): the child inherits the parent's
  // FULL gate — modules AND the role page.* whitelist — otherwise a role that is
  // nav-blocked from candidates could still open coupling-errors (candidate
  // names, §8). Gate values are top-level pages, so this never cycles.
  if (SUB_PAGE_GATES[pageId] && !canAccessPage(SUB_PAGE_GATES[pageId], auth)) return false

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

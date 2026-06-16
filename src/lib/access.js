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

// Canonical page sets per package ID.
// These IDs must match exactly what the backend stores in tenant.package.
//
// Matrix model:
//   Reporting tier:  SM = Shiftmanager, HF = HelloFlex
//   Add-ons:         _ai = AI & Workflow (enables app connectors)
//   ATS tier:        ats_crm base pages
//   Planning:        add-on on top of ats_crm (never standalone)
//
// Pakket  1  reporting_sm            SM
// Pakket  2  reporting_hf            HF
// Pakket  3  reporting_sm_hf         SM + HF
// Pakket  4  reporting_sm_ai         SM + AI & WF
// Pakket  5  reporting_hf_ai         HF + AI & WF
// Pakket  6  reporting_sm_hf_ai      SM + HF + AI & WF
// Pakket  7  ats_crm                 ATS & CRM
// Pakket  8  ats_crm_ai              ATS & CRM + AI & WF
// Pakket  9  ats_crm_planning        ATS & CRM + Planning
// Pakket 10  ats_crm_ai_planning     ATS & CRM + AI & WF + Planning

const ATS_BASE   = ['dashboard', 'candidates', 'applications', 'vacancies', 'customers', 'locations', 'departments', 'contacts', 'details', 'users']
const AI_PAGES   = ['aiagents', 'whatsapp', 'workflows', 'apps']
const PLANNING   = ['planning']

const PACKAGE_PAGES = {
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
export const PACKAGE_DEFAULT_PAGE = {
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
  'candidates', 'applications', 'vacancies',
  'customers', 'locations', 'departments', 'contacts',
  'planning', 'details',
  'shiftmanager', 'helloflex',
  'aiagents', 'workflows', 'whatsapp', 'apps',
  'users',
]

// Sub-page gates: the sub-page is only visible when the named top-level page is accessible.
const SUB_PAGE_GATES = {
  'details.runs':     'aiagents',
  'details.messages': 'whatsapp',
}

// Pages that can additionally be restricted at the user/role level via page.* permissions.
// Only ATS & CRM pages — module pages (aiagents, whatsapp, workflows, planning, etc.)
// are purely package-gated and must never be blocked by role permissions.
const PAGE_RESTRICTABLE = [
  'candidates', 'customers', 'locations', 'departments', 'details',
]

// Module pages shown in the "Modules" nav group. Driven by accessible_pages.
export const MODULE_PAGES = [
  { id: 'shiftmanager', label: 'Rapportage Shiftmanager' },
  { id: 'helloflex',    label: 'Rapportage HelloFlex', soon: true },
  { id: 'aiagents',     label: 'AI Agents' },
  { id: 'workflows',    label: 'Workflows' },
  { id: 'whatsapp',     label: 'WhatsApp'  },
]

function accessiblePages(auth) {
  // Package is the source of truth — check activeTenant, then user.tenant
  const pkg = auth?.activeTenant?.package ?? auth?.user?.tenant?.package ?? null
  if (pkg && PACKAGE_PAGES[pkg]) return PACKAGE_PAGES[pkg]
  // Fall back to backend accessible_pages
  const fromBackend = auth?.accessiblePages ?? auth?.user?.accessible_pages ?? []
  if (fromBackend.length > 0) return fromBackend
  // Last resort: if no package and no pages, assume full access (legacy/dev)
  return null
}

function hasAccess(pageId, auth) {
  const pages = accessiblePages(auth)
  if (pages === null) return true // no restrictions configured
  return pages.includes(pageId)
}

/**
 * Returns true if the user may open the given page.
 * Checks both: (1) tenant package / accessible_pages, (2) user role page.* permissions.
 */
export function canAccessPage(pageId, auth) {
  const base = String(pageId ?? '').split('.')[0]

  // Super admins always see everything
  if (auth?.user?.is_super_admin === true) return true

  // Sub-page gates (e.g. details.runs needs aiagents, details.messages needs whatsapp)
  if (SUB_PAGE_GATES[pageId] && !hasAccess(SUB_PAGE_GATES[pageId], auth)) return false

  // Layer 1: tenant-level gating
  if (GATED_PAGES.includes(base) && !hasAccess(base, auth)) return false

  // Layer 2: role-level page whitelist (page.* permissions).
  // Guard with Array.isArray: user.permissions may be absent or non-array on some backends.
  if (PAGE_RESTRICTABLE.includes(base)) {
    const perms = Array.isArray(auth?.user?.permissions) ? auth.user.permissions : []
    const pagePerms = perms.filter(p => (typeof p === 'string' ? p : p.name)?.startsWith('page.'))
    if (pagePerms.length > 0) {
      return pagePerms.some(p => (typeof p === 'string' ? p : p.name) === `page.${base}`)
    }
  }

  return true
}

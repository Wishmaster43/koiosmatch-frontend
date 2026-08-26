/**
 * RolesPermissionMatrix — the rights list shown inside a role's detail view.
 * HelloFlex-style EXPANDABLE ROWS (RECHTEN-UI-1, Danny GO 08-08, translated:
 * "every group is a collapsed row with an x/y summary, expanding shows the
 * individual rights" — verbatim: "elke groep is een collapsed rij met een
 * x/y-samenvatting, uitklappen toont de losse rechten"): one row per permission group (candidates, customers, …), collapsed
 * by default and showing only its label + an "x/y allowed" soft chip. Opening a
 * row reveals EVERY permission in that group as its own labelled toggle — CRUD
 * verbs (view/create/update/delete) and non-CRUD actions (archive, manage,
 * assign_roles, page.*, …) alike, no separate matrix/column layout any more.
 * A row hides entirely when its module's page isn't accessible (mirrors the
 * sidebar gate) — same as before the redesign.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { canAccessPage } from '@/lib/access'
import { PermissionToggle } from '../components/SettingsControls'
import SoftChip from '@/components/ui/SoftChip'
import { SectionTitle } from '@/components/ui/typography'

// Hand-written — GET /permissions carries no 2xx schema in api-generated.ts yet
// (§10: only the 401 shape is documented for this route).
export interface Permission { name: string }
export type PermissionGroups = Array<[string, Permission[]]>

// Permission-group -> sidebar page id: hides a row when the tenant/user cannot
// open that module's page (same gate the sidebar uses, §3A blueprint). Groups
// not listed here are core ATS features and always show. RECHTEN-WIRE-1
// (Danny GO 06-08): shifts.* permissions are gone from the backend (zero
// routes ever checked them), so the old `shifts: 'planning'` mapping is dead
// weight and was removed.
const GROUP_MODULE_PAGE: Record<string, string> = {
  planning:  'planning',
  outreach:  'outreach',
  reports:   'reports',
  whatsapp:  'whatsapp',
  workflows: 'aiagents',
}

// The four CRUD verbs get their generic roles.actions.<verb> label; every
// other action (offer, manage, refresh, sync, assign_roles, page.*, …) falls
// through the "other" label chain below.
const CRUD_ACTIONS = ['view', 'create', 'update', 'delete']

// Full-permission-name label overrides — for names the generic "action segment"
// split can't label cleanly: three-segment names (a.b.c, e.g. candidates.documents
// .manage — segment[1] is a sub-resource, not a verb) and verbs with no existing
// roles.actions.* entry yet (archive, the page.details rename). Each carries its
// own defaultValue so the row reads correctly even before the key is seeded
// (i18n is applied centrally — see CLAUDE.md working agreement).
const PERMISSION_LABEL: Record<string, { key: string; defaultValue: string }> = {
  'candidates.archive':          { key: 'roles.actions.archive',                  defaultValue: 'Archiveren' },
  'candidates.documents.manage': { key: 'roles.actions.candidatesDocumentsManage', defaultValue: 'Documenten beheren' },
  'candidates.notes.manage_all': { key: 'roles.actions.candidatesNotesManageAll',  defaultValue: 'Alle notities beheren' },
  // "Details" read as a generic/ambiguous nav label — this page is actually the
  // Shiftmanager/AI reporting-detail landing group.
  'page.details':                { key: 'roles.actions.details',                  defaultValue: 'Rapportdetails (SM/AI)' },
}

// Per-permission tooltip overrides — a hint that explains WHAT gets synced when
// the action name alone doesn't (candidates.sync mirrors Shiftmanager). Every
// other toggle keeps the raw permission name as its title.
const PERMISSION_HINT: Record<string, { key: string; defaultValue: string }> = {
  'candidates.sync': { key: 'roles.hints.candidatesSync', defaultValue: 'SM-spiegel' },
}

// One card per group row, mirroring the settings expand-card convention
// (VacancyContentBlocksSettings): a plain button header (label + chip + chevron)
// that toggles a bordered detail panel below it.
const rowCardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }
const rowHeaderStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px',
  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit',
}
const detailWrapStyle: CSSProperties = { padding: '2px 16px 16px', borderTop: '1px solid var(--border)' }
const detailGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px 20px', paddingTop: 12 }
const detailRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }

interface PermissionMatrixProps {
  groups: PermissionGroups
  hasPermission: (permName: string) => boolean
  onToggle: (permName: string) => void
}

// The expandable permission-group matrix, filtered to modules the viewing admin
// can actually see (canAccessPage), per the comment below.
export function PermissionMatrix({ groups, hasPermission, onToggle }: PermissionMatrixProps) {
  const { t } = useTranslation('settings')
  // Same gate as the sidebar: canAccessPage handles the tenant module flags,
  // package mapping and the super-admin bypass in ONE place — raw accessiblePages
  // wrongly hid open modules for super admins (CMFE review 20-07). Pure UI
  // cleanup: the backend re-checks every permission regardless of this list.
  const auth = useAuth()
  const visibleGroups = groups.filter(([group]) => {
    const requiredPage = GROUP_MODULE_PAGE[group]
    return !requiredPage || canAccessPage(requiredPage, auth)
  })

  // Which group rows currently have their detail panel open — independent per
  // row (not an accordion), mirrors the VacancyContentBlocksSettings expand pattern.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())
  const toggleExpanded = (group: string) => setExpandedGroups(prev => {
    const next = new Set(prev)
    if (next.has(group)) next.delete(group); else next.add(group)
    return next
  })

  // Label helpers — group/action names are tenant-agnostic permission vocabulary,
  // so a missing translation still shows the raw key instead of crashing.
  const groupLabel  = (g: string) => t(`roles.groups.${g}`, { defaultValue: g })
  const actionLabel = (a: string) => t(`roles.actions.${a}`, { defaultValue: a })
  // Non-CRUD action label: a real roles.actions.<x> entry when one exists
  // (offer/manage/assign_roles/…), else the matching group label — most detail
  // entries are page.* toggles whose action segment IS a page/entity name.
  const otherLabel  = (a: string) => t(`roles.actions.${a}`, { defaultValue: groupLabel(a) })

  // One label function for EVERY permission in a group now that the whole row
  // (CRUD + non-CRUD alike) expands into a flat toggle list: CRUD verbs get their
  // generic action label, PERMISSION_LABEL overrides win for names the segment
  // split can't handle, everything else falls back through the other-label chain
  // page.* entries additionally get a "Pagina: …" prefix so a page-access toggle
  // never reads identically to its own CRUD group row (e.g. the "Kandidaten" CRUD
  // row vs. the "page.candidates" nav toggle).
  const permissionLabel = (group: string, perm: Permission): string => {
    const override = PERMISSION_LABEL[perm.name]
    const action = perm.name.split('.')[1] ?? perm.name
    const label = override
      ? t(override.key, { defaultValue: override.defaultValue })
      : CRUD_ACTIONS.includes(action) ? actionLabel(action) : otherLabel(action)
    return group === 'page' ? t('roles.pageAccess', { label, defaultValue: `Pagina: ${label}` }) : label
  }
  // A toggle's tooltip: PERMISSION_HINT override when the raw permission name
  // alone doesn't explain the effect, else the raw name (useful when reporting
  // a bug against a specific permission).
  const permissionTitle = (perm: Permission): string => {
    const hint = PERMISSION_HINT[perm.name]
    return hint ? t(hint.key, { defaultValue: hint.defaultValue }) : perm.name
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visibleGroups.map(([group, perms]) => {
        const activeCount = perms.filter(p => hasPermission(p.name)).length
        const isOpen = expandedGroups.has(group)
        // Soft-tint the summary chip by grant level (§4) — primary once at least
        // one right is on, muted while the group is fully closed off.
        const chipColor = activeCount > 0 ? 'var(--color-primary)' : 'var(--text-muted)'
        // Computed once so the same string drives both the visible chip AND the
        // row button's accessible name (explicit aria-label, not DOM-flattening —
        // deterministic for AT and for tests alike).
        const chipLabel = t('roles.matrixAllowed', { active: activeCount, total: perms.length, defaultValue: `${activeCount}/${perms.length} toegestaan` })
        return (
          <div key={group} style={rowCardStyle}>
            <button type="button" onClick={() => toggleExpanded(group)} aria-expanded={isOpen}
              aria-label={`${groupLabel(group)} — ${chipLabel}`} style={rowHeaderStyle}>
              <SectionTitle as="span" style={{ flex: 1, minWidth: 0 }}>{groupLabel(group)}</SectionTitle>
              <SoftChip round color={chipColor} label={chipLabel} />
              {isOpen
                ? <ChevronUp size={14} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                : <ChevronDown size={14} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
            </button>
            {isOpen && (
              <div style={detailWrapStyle}>
                <div style={detailGridStyle}>
                  {perms.map(perm => {
                    const label = permissionLabel(group, perm)
                    return (
                      <div key={perm.name} style={detailRowStyle}>
                        <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{label}</span>
                        <PermissionToggle checked={hasPermission(perm.name)} onChange={() => onToggle(perm.name)}
                          title={permissionTitle(perm)} aria-label={`${groupLabel(group)} — ${label}`} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

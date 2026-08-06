/**
 * RolesPermissionMatrix — the rights matrix shown inside a role's detail view.
 * Rows = permission groups (candidates, customers, …), columns = the four CRUD
 * verbs (view/create/update/delete) + a fifth "Other" column. Non-CRUD actions
 * (candidates.archive, page.*, users.assign_roles, …) no longer cram into that
 * column inline — each row gets a HelloFlex-style EXPAND (chevron + count) that
 * reveals them as labelled toggles below (RECHTEN-UI-1, Danny GO 06-08: "elke
 * groep krijgt een expand"). A row hides when its module's page isn't accessible
 * (mirrors the sidebar gate).
 */
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { canAccessPage } from '@/lib/access'
import { PermissionToggle } from '../components/SettingsControls'

// Permission-group -> sidebar page id: hides a matrix row when the tenant/user
// cannot open that module's page (same gate the sidebar uses, §3A blueprint).
// Groups not listed here are core ATS features and always show.
// RECHTEN-WIRE-1 (Danny GO 06-08): shifts.* permissions are gone from the backend
// (zero routes ever checked them) — no "shifts" group can be returned any more,
// so the old `shifts: 'planning'` mapping here was dead weight; removed.
const GROUP_MODULE_PAGE = {
  planning:  'planning',
  outreach:  'outreach',
  reports:   'reports',
  whatsapp:  'whatsapp',
  workflows: 'aiagents',
}

// The four CRUD verbs get a dedicated column; every other action (offer, manage,
// refresh, sync, assign_roles, page.*, …) lands in that row's expand instead.
const CRUD_ACTIONS = ['view', 'create', 'update', 'delete']

// Full-permission-name label overrides — for names the generic "action segment"
// split can't label cleanly: three-segment names (a.b.c, e.g. candidates.documents
// .manage — segment[1] is a sub-resource, not a verb) and verbs with no existing
// roles.actions.* entry yet (archive, the new page.details rename). Each carries
// its own defaultValue so the row reads correctly even before the key is seeded
// (i18n is applied centrally — see CLAUDE.md working agreement).
const PERMISSION_LABEL = {
  'candidates.archive':          { key: 'roles.actions.archive',                  defaultValue: 'Archiveren' },
  'candidates.documents.manage': { key: 'roles.actions.candidatesDocumentsManage', defaultValue: 'Documenten beheren' },
  'candidates.notes.manage_all': { key: 'roles.actions.candidatesNotesManageAll',  defaultValue: 'Alle notities beheren' },
  // RECHTEN-UI-1 #2: "Details" read as a generic/ambiguous nav label — this page
  // is actually the Shiftmanager/AI reporting-detail landing group.
  'page.details':                { key: 'roles.actions.details',                  defaultValue: 'Rapportdetails (SM/AI)' },
}

// Per-permission tooltip overrides — a hint that explains WHAT gets synced when
// the action name alone doesn't (candidates.sync mirrors Shiftmanager, RECHTEN-
// UI-1 #1). Every other toggle keeps the raw permission name as its title.
const PERMISSION_HINT = {
  'candidates.sync': { key: 'roles.hints.candidatesSync', defaultValue: 'SM-spiegel' },
}

// One shared header/row-label cell style — mirrors the shared DataTable's header look.
const headCell = { padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }

export function PermissionMatrix({ groups, hasPermission, onToggle }) {
  const { t } = useTranslation('settings')
  // Same gate as the sidebar: canAccessPage handles the tenant module flags,
  // package mapping and the super-admin bypass in ONE place — raw accessiblePages
  // wrongly hid open modules for super admins (CMFE review 20-07). Pure UI
  // cleanup: the backend re-checks every permission regardless of this matrix.
  const auth = useAuth()
  const visibleGroups = groups.filter(([group]) => {
    const requiredPage = GROUP_MODULE_PAGE[group]
    return !requiredPage || canAccessPage(requiredPage, auth)
  })

  // Which group rows currently have their detail expand open — independent per
  // row (not an accordion), mirrors the VacancyContentBlocksSettings expand pattern.
  const [expandedGroups, setExpandedGroups] = useState(() => new Set())
  const toggleExpanded = (group) => setExpandedGroups(prev => {
    const next = new Set(prev)
    if (next.has(group)) next.delete(group); else next.add(group)
    return next
  })

  // Label helpers — group/action names are tenant-agnostic permission vocabulary,
  // so a missing translation still shows the raw key instead of crashing.
  const groupLabel  = (g) => t(`roles.groups.${g}`, { defaultValue: g })
  const actionLabel = (a) => t(`roles.actions.${a}`, { defaultValue: a })
  // Non-CRUD action label: a real roles.actions.<x> entry when one exists
  // (offer/manage/assign_roles/…), else the matching group label — most detail
  // entries are page.* toggles whose action segment IS a page/entity name.
  const otherLabel  = (a) => t(`roles.actions.${a}`, { defaultValue: groupLabel(a) })

  // A detail toggle's visible label: PERMISSION_LABEL override when the action
  // segment alone can't be labelled, else the generic otherLabel chain. page.*
  // entries additionally get a "Pagina: …" prefix (RECHTEN-UI-1 #4) so a page-
  // access toggle never reads identically to its own CRUD group row (e.g. the
  // "Kandidaten" CRUD row vs. the "page.candidates" nav toggle).
  const detailLabel = (group, perm) => {
    const override = PERMISSION_LABEL[perm.name]
    const action = perm.name.split('.')[1] ?? perm.name
    const label = override ? t(override.key, { defaultValue: override.defaultValue }) : otherLabel(action)
    return group === 'page' ? t('roles.pageAccess', { label, defaultValue: `Pagina: ${label}` }) : label
  }
  // A detail toggle's tooltip: PERMISSION_HINT override when the raw permission
  // name alone doesn't explain the effect, else the raw name (kept for every
  // other toggle — useful when reporting a bug against a specific permission).
  const detailTitle = (perm) => {
    const hint = PERMISSION_HINT[perm.name]
    return hint ? t(hint.key, { defaultValue: hint.defaultValue }) : perm.name
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            <th scope="col" style={{ ...headCell, textAlign: 'left' }}>{t('roles.matrixGroup')}</th>
            {CRUD_ACTIONS.map(action => (
              <th key={action} scope="col" style={{ ...headCell, textAlign: 'center' }}>{actionLabel(action)}</th>
            ))}
            <th scope="col" style={{ ...headCell, textAlign: 'left' }}>{t('roles.matrixOther')}</th>
          </tr>
        </thead>
        <tbody>
          {visibleGroups.map(([group, perms]) => {
            // Index this group's permissions by action segment (candidates.view -> "view").
            const byAction    = Object.fromEntries(perms.map(p => [p.name.split('.')[1] ?? p.name, p]))
            const otherPerms  = perms.filter(p => !CRUD_ACTIONS.includes(p.name.split('.')[1]))
            const activeCount = perms.filter(p => hasPermission(p.name)).length
            const isOpen      = expandedGroups.has(group)
            return (
              <Fragment key={group}>
                <tr style={{ borderTop: '1px solid var(--border)' }}>
                  <th scope="row" style={{ ...headCell, textAlign: 'left', background: 'var(--hover-bg)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{groupLabel(group)}</span>
                    <span style={{ marginLeft: 8, fontWeight: 400 }}>{activeCount}/{perms.length}</span>
                  </th>
                  {CRUD_ACTIONS.map(action => {
                    const perm = byAction[action]
                    return (
                      <td key={action} style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {perm ? (
                          <div style={{ display: 'inline-flex' }}>
                            <PermissionToggle checked={hasPermission(perm.name)} onChange={() => onToggle(perm.name)}
                              title={perm.name} aria-label={`${groupLabel(group)} — ${actionLabel(action)}`} />
                          </div>
                        ) : <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                    )
                  })}
                  <td style={{ padding: '8px 10px' }}>
                    {otherPerms.length === 0 ? (
                      <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>—</span>
                    ) : (
                      <button type="button" onClick={() => toggleExpanded(group)} aria-expanded={isOpen}
                        aria-label={`${otherPerms.length} ${t('roles.matrixOther')} — ${groupLabel(group)}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 9px',
                          fontSize: 11, fontWeight: isOpen ? 600 : 500, borderRadius: 999, cursor: 'pointer',
                          border: `1px solid color-mix(in srgb, var(--color-primary) ${isOpen ? 45 : 28}%, transparent)`,
                          background: `color-mix(in srgb, var(--color-primary) ${isOpen ? 16 : 8}%, transparent)`,
                          color: 'var(--color-primary)' }}>
                        {otherPerms.length}
                        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </td>
                </tr>
                {isOpen && otherPerms.length > 0 && (
                  <tr style={{ borderTop: '1px solid var(--border)' }}>
                    <td colSpan={CRUD_ACTIONS.length + 2} style={{ padding: '10px 14px 14px 34px', background: 'var(--hover-bg)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                        {otherPerms.map(perm => {
                          const label = detailLabel(group, perm)
                          return (
                            <div key={perm.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 12, color: 'var(--text)' }}>{label}</span>
                              <PermissionToggle checked={hasPermission(perm.name)} onChange={() => onToggle(perm.name)}
                                title={detailTitle(perm)} aria-label={`${groupLabel(group)} — ${label}`} />
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

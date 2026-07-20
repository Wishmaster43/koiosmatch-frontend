/**
 * RolesPermissionMatrix — the rights matrix shown inside a role's detail view.
 * Rows = permission groups (candidates, customers, …), columns = the four CRUD
 * verbs (view/create/update/delete) + a fifth "Other" column for non-CRUD actions
 * (shifts.offer, sync.refresh, users.assign_roles, …). Replaces the old stacked
 * collapsible-per-group list (Danny 2026-07-20 — "the list is too long now").
 * A row hides when its module's page isn't accessible (mirrors the sidebar gate).
 */
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { canAccessPage } from '@/lib/access'
import { PermissionToggle } from '../components/SettingsControls'

// Permission-group -> sidebar page id: hides a matrix row when the tenant/user
// cannot open that module's page (same gate the sidebar uses, §3A blueprint).
// Groups not listed here are core ATS features and always show.
const GROUP_MODULE_PAGE = {
  planning:  'planning',
  shifts:    'planning',
  outreach:  'outreach',
  reports:   'reports',
  whatsapp:  'whatsapp',
  workflows: 'aiagents',
  sync:      'shiftmanager',
}

// The four CRUD verbs get a dedicated column; every other action (offer, manage,
// refresh, sync, assign_roles, …) lands in the "Other" column instead.
const CRUD_ACTIONS = ['view', 'create', 'update', 'delete']

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

  // Label helpers — group/action names are tenant-agnostic permission vocabulary,
  // so a missing translation still shows the raw key instead of crashing.
  const groupLabel  = (g) => t(`roles.groups.${g}`, { defaultValue: g })
  const actionLabel = (a) => t(`roles.actions.${a}`, { defaultValue: a })
  // Non-CRUD action label: a real roles.actions.<x> entry when one exists
  // (offer/manage/assign_roles/…), else the matching group label — most "Other"
  // entries are page.* toggles whose action segment IS a page/entity name.
  const otherLabel  = (a) => t(`roles.actions.${a}`, { defaultValue: groupLabel(a) })

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
            return (
              <tr key={group} style={{ borderTop: '1px solid var(--border)' }}>
                <th scope="row" style={{ ...headCell, textAlign: 'left', background: 'var(--hover-bg)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{groupLabel(group)}</span>
                  <span style={{ marginLeft: 8, fontWeight: 400 }}>{activeCount}/{perms.length}</span>
                </th>
                {CRUD_ACTIONS.map(action => {
                  const perm = byAction[action]
                  return (
                    <td key={action} style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {perm ? (
                        <div role="group" title={perm.name} aria-label={`${groupLabel(group)} — ${actionLabel(action)}`}
                          style={{ display: 'inline-flex' }}>
                          <PermissionToggle checked={hasPermission(perm.name)} onChange={() => onToggle(perm.name)} />
                        </div>
                      ) : <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                  )
                })}
                <td style={{ padding: '8px 10px' }}>
                  {otherPerms.length === 0 ? (
                    <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>—</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {otherPerms.map(perm => {
                        const action = perm.name.split('.')[1] ?? perm.name
                        return (
                          <div key={perm.name} role="group" title={perm.name}
                            aria-label={`${groupLabel(group)} — ${otherLabel(action)}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{otherLabel(action)}</span>
                            <PermissionToggle checked={hasPermission(perm.name)} onChange={() => onToggle(perm.name)} />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

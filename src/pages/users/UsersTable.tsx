/**
 * UsersTable — the users list itself: column declarations handed to the shared
 * DataTable (which owns sorting, hover, and the loading/empty states). Purely
 * presentational — every mutation arrives as a prop, so the page stays thin (§3).
 *
 * Capability flags come from the caller and only shape what is VISIBLE (§7 — the
 * backend re-checks every route); a right the user lacks hides the control
 * instead of dimming it, like the rest of the repo.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, UserCog } from 'lucide-react'
import Button from '@/components/ui/Button'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import SoftChip from '@/components/ui/SoftChip'
import { useDateFormat } from '@/lib/datetime'
import { RoleBadge, EditableAvatar, isSuperAdminUser, SUPER_ADMIN_COLOR } from './usersParts'
import { isArchivedUser, userDisplayName } from './userRow'
import type { UserRow } from './userRow'

interface UsersTableProps {
  rows: UserRow[]
  loading: boolean
  // `id` is a UUID string in practice, but the shared User type still widens it.
  currentUserId?: string | number | null
  canUpdate: boolean
  canDelete: boolean
  canAssignRoles: boolean
  onEdit: (user: UserRow) => void
  onEditRoles: (user: UserRow) => void
  onDelete: (user: UserRow) => void
  onPickColor: (user: UserRow, color: string | null) => void
}

// Presentational users table; edit/roles/delete/colour actions are all permission-gated by the caller, this component only renders them.
export default function UsersTable({
  rows, loading, currentUserId, canUpdate, canDelete, canAssignRoles,
  onEdit, onEditRoles, onDelete, onPickColor,
}: UsersTableProps) {
  const { t } = useTranslation('users')
  const { formatDateTime } = useDateFormat()

  // The last-login column only exists once the API actually carries the field —
  // an always-empty column would suggest data that is not there (backend gap).
  const hasLastLogin = useMemo(() => rows.some(u => Boolean(u.last_login_at)), [rows])

  const columns: Column<UserRow>[] = useMemo(() => {
    const cols: Column<UserRow>[] = [
      // Name — colour-pick avatar, name, edit pencil, plus you/system markers.
      { key: 'name', header: t('cols.name'), width: 220, sortable: true, sortValue: userDisplayName, render: u => {
        const isMe = u.id != null && u.id === currentUserId
        const isSA = isSuperAdminUser(u)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <EditableAvatar user={u} onPick={canUpdate ? color => onPickColor(u, color) : undefined} />
            <div style={{ fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {userDisplayName(u)}
              {/* System accounts are never edited from the tenant surface. */}
              {/* pencil=secondary per the row icon-action idiom; Button's sm (28px) is
                  visibly larger than the old 20px inline icon — kept, gap unchanged. */}
              {canUpdate && !isSA && (
                <Button variant="secondary" iconOnly onClick={() => onEdit(u)} title={t('editUser')} aria-label={t('editUser')}>
                  <Pencil size={10} aria-hidden="true" />
                </Button>
              )}
              {isMe && (
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-primary-text)',
                               background: 'var(--color-primary-bg)', borderRadius: 999, padding: '1px 7px' }}>
                  {t('you')}
                </span>
              )}
              {isSA && (
                <span style={{ fontSize: 10, fontWeight: 600, color: SUPER_ADMIN_COLOR,
                               background: `color-mix(in srgb, ${SUPER_ADMIN_COLOR} 10%, transparent)`,
                               borderRadius: 999, padding: '1px 7px' }}>
                  {t('system')}
                </span>
              )}
            </div>
          </div>
        )
      } },
      // Contact details — muted secondary text, nothing beyond what the list needs (§8).
      { key: 'email', header: t('cols.email'), width: 200, sortable: true,
        cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, render: u => u.email ?? '—' },
      { key: 'phone', header: t('cols.phone'), width: 140,
        cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, render: u => u.phone ?? '—' },
      // Roles — soft chips plus the assign button (PUT /users/{id}/roles).
      { key: 'roles', header: t('cols.role'), render: u => {
        const isSA = isSuperAdminUser(u)
        const list = (u.roles ?? []).filter(r => r != null)
        return (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            {list.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
            {list.map((r, i) => <RoleBadge key={i} role={r} />)}
            {canAssignRoles && !isSA && (
              <Button variant="secondary" iconOnly onClick={() => onEditRoles(u)} title={t('changeRole')} aria-label={t('changeRole')}>
                <UserCog size={11} aria-hidden="true" />
              </Button>
            )}
          </div>
        )
      } },
      // Branches — read-only soft chips (the coupling is edited in the user dialog).
      { key: 'branches', header: t('cols.branches'), render: u => {
        const branches = u.branches ?? []
        if (!branches.length) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {branches.map(b => (
              <span key={b.location_id} style={{ fontSize: 11, fontWeight: 500, padding: '1px 8px', borderRadius: 99,
                whiteSpace: 'nowrap', color: 'var(--color-primary-text)',
                background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>
                {b.name ?? '—'}
              </span>
            ))}
          </div>
        )
      } },
      // Status — active vs archived (soft-delete stamp), colour never the only signal.
      { key: 'status', header: t('cols.status'), width: 120, sortable: true,
        sortValue: u => (isArchivedUser(u) ? 1 : 0), render: u => (
          <SoftChip round label={isArchivedUser(u) ? t('status.archived') : t('status.active')}
            color={isArchivedUser(u) ? 'var(--text-muted)' : 'var(--color-success)'} />
        ) },
    ]

    // Last login — DD-MM-YYYY HH:mm via the house formatter, only when carried.
    if (hasLastLogin) {
      cols.push({ key: 'last_login_at', header: t('cols.lastLogin'), width: 150, sortable: true,
        cellStyle: { color: 'var(--text-muted)', fontSize: 12 },
        sortValue: u => u.last_login_at ?? null,
        render: u => (u.last_login_at ? formatDateTime(u.last_login_at) : '—') })
    }

    // Delete — soft-delete; never offered for a system account or for yourself
    // (the backend refuses self-deletion with a 422 as well).
    if (canDelete) {
      cols.push({ key: 'actions', header: '', width: 60, align: 'right', render: u => {
        if (isSuperAdminUser(u) || (u.id != null && u.id === currentUserId)) return null
        return (
          // bin=dangerSoft per the row icon-action idiom.
          <Button variant="dangerSoft" iconOnly onClick={() => onDelete(u)} title={t('delete.action')} aria-label={t('delete.action')}>
            <Trash2 size={12} aria-hidden="true" />
          </Button>
        )
      } })
    }

    return cols
  }, [t, formatDateTime, hasLastLogin, currentUserId, canUpdate, canDelete, canAssignRoles, onEdit, onEditRoles, onDelete, onPickColor])

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={u => u.id ?? u.email ?? ''}
      loading={loading}
      loadingText={t('loading')}
      emptyText={t('empty')}
    />
  )
}

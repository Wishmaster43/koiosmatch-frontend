/**
 * WhatsAppConnectionsList — the "Connection" tab body (WA-VESTIGING-FE-1): every
 * WhatsApp token the tenant holds, each showing its label, its scope (everyone /
 * one branch / one role, soft chip §4), its default badge, and whether a webhook
 * verify-token is set. Reorder is not in the contract (no drag UI). Secrets never
 * render — the backend hides them and this list never asks for them back.
 *
 * Promoting a row to default RE-FETCHES the whole list (`reload`) instead of hand-
 * reconciling — the server demotes every sibling in one transaction (WA-SCOPE-1),
 * so mirroring that locally would just be a second, driftable copy of the same
 * invariant. `undoable={false}` on the default pill is deliberate: the backend's
 * own comment calls out "precies één per tenant" — a lone default should only ever
 * be REPLACED by promoting a different row, never cleared back to zero.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, RefreshCw, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useDateFormat } from '@/lib/datetime'
import { roleLabel } from '@/pages/users/shared'
import { useConfirm } from '@/hooks/useConfirm'
import { useLocations } from '@/lib/useLocations'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import SoftChip from '@/components/ui/SoftChip'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { DefaultToggle } from '@/pages/settings/components/SettingsControls'
import { PageTitle, SectionTitle, Caption, Mono } from '@/components/ui/typography'
import WhatsAppConnectionForm from './WhatsAppConnectionForm'
import type { UseWhatsAppConnectionsResult } from './useWhatsAppConnections'
import type { WhatsappConnectionRow } from '@/types/whatsapp'

// Connection health dot — mirrors the old single-connection status card's colours.
const STATUS_DOT: Record<string, string> = {
  active: 'var(--color-success)',
  inactive: 'var(--text-muted)',
  expired: 'var(--color-danger)',
}

interface WhatsAppConnectionsListProps extends UseWhatsAppConnectionsResult {
  // Hides every mutation affordance for a viewer without whatsapp.manage (§3:
  // hidden, not disabled — mirrors the old canProvision gate exactly).
  canManage: boolean
}

export default function WhatsAppConnectionsList({
  connections, loading, error, reload, removeLocal, canManage,
}: WhatsAppConnectionsListProps) {
  const { t } = useTranslation('settings')
  // roleLabel resolves roles.<name> in the USERS namespace (usersParts convention).
  const { t: tUsers } = useTranslation('users')
  const { formatDateTime } = useDateFormat()
  const locations = useLocations()
  const { confirm, dialog } = useConfirm()
  // 'create' | a row being edited | null (list view) — one open form at a time.
  const [formTarget, setFormTarget] = useState<'create' | WhatsappConnectionRow | null>(null)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Any save (create or edit) can flip status/last_checked_at via the immediate
  // check-status call inside the form — a full reload keeps that visible, never
  // a stale local merge.
  const handleSaved = () => { setFormTarget(null); reload() }

  // Re-verify one token against Meta; reload either way — success or failure both
  // change status/last_checked_at server-side.
  const checkConnectionStatus = async (row: WhatsappConnectionRow) => {
    setCheckingId(row.id)
    // Feedback both ways (§3, Opus F7): a silent re-verify hid a failed token.
    try { await api.post(`/whatsapp/${row.id}/check-status`); notifySuccess(t('whatsapp.statusChecked')) }
    catch { notifyError(t('whatsapp.statusCheckFailed')) }
    await reload()
    setCheckingId(null)
  }

  // Promote a row to the tenant's single default — the server demotes every
  // sibling in the same transaction, so this always refetches, never merges.
  const promote = async (row: WhatsappConnectionRow) => {
    if (promotingId) return
    setPromotingId(row.id)
    try {
      await api.patch(`/whatsapp/${row.id}`, { is_default: true })
      await reload()
    } catch { notifyError(t('whatsapp.promoteFailed')) }
    setPromotingId(null)
  }

  const remove = (row: WhatsappConnectionRow) => {
    confirm(t('whatsapp.confirmDelete'), async () => {
      setDeletingId(row.id)
      try { await api.delete(`/whatsapp/${row.id}`); removeLocal(row.id) }
      catch { notifyError(t('whatsapp.deleteFailed')) }
      finally { setDeletingId(null) }
    }, { danger: true })
  }

  // Scope → { label, color } for the row's soft chip. role_name/location_id are
  // exclusive by contract, so at most one branch below ever applies.
  const scopeOf = (row: WhatsappConnectionRow) => {
    if (row.role_name) return { label: String(roleLabel(tUsers, row.role_name)), color: 'var(--color-violet)' }
    if (row.location_id) {
      const loc = locations.find(l => String(l.value) === String(row.location_id))
      return { label: loc?.label ?? t('whatsapp.scopeLocationUnknown'), color: 'var(--color-info)' }
    }
    return { label: t('whatsapp.scopeEveryone'), color: null }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <PageTitle>{t('whatsapp.connectionsTitle')}</PageTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('whatsapp.connectionsSubtitle')}</p>
        </div>
        {canManage && !formTarget && (
          <DrawerAddButton onClick={() => setFormTarget('create')} label={t('whatsapp.addConnection')} />
        )}
      </div>

      {/* Four explicit UI states (§3): loading / error / empty / success. */}
      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('whatsapp.loading')}</p>
      ) : error ? (
        <div style={{ padding: '16px 18px', background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)',
                      borderRadius: 12, fontSize: 13, color: 'var(--color-danger-text)' }}>
          {t('whatsapp.loadListFailed')}
        </div>
      ) : connections.length === 0 && formTarget !== 'create' ? (
        <div style={{ padding: '16px 18px', background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <SectionTitle as="div">{t('whatsapp.noConnections')}</SectionTitle>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('whatsapp.noConnectionsDesc')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {connections.map(row => {
            // The row being edited renders the form in place, never beside itself.
            if (formTarget !== 'create' && formTarget?.id === row.id) {
              return <WhatsAppConnectionForm key={row.id} connection={row} onSaved={handleSaved} onCancel={() => setFormTarget(null)} />
            }
            const scope = scopeOf(row)
            return (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                                          padding: '12px 16px', background: 'var(--surface)',
                                          border: '1px solid var(--border)', borderRadius: 12 }}>
                {/* §6: colour never the only signal — the status reads as TEXT beside
                    the dot, with the last check moment when one exists (Opus F4/F7). */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%',
                           background: STATUS_DOT[row.status ?? 'inactive'] ?? STATUS_DOT.inactive }} />
                  <Caption as="span">
                    {t(`whatsapp.status${row.status ? row.status[0].toUpperCase() + row.status.slice(1) : 'Inactive'}`)}
                    {row.last_checked_at ? ` · ${formatDateTime(row.last_checked_at)}` : ''}
                  </Caption>
                </span>
                <div style={{ minWidth: 0, flex: '1 1 160px' }}>
                  <SectionTitle as="div" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.label?.trim() || row.waba_id}
                  </SectionTitle>
                  {row.label?.trim() && (
                    <Caption as="div"><Mono>{row.waba_id}</Mono></Caption>
                  )}
                </div>
                <SoftChip label={scope.label} color={scope.color} />
                {/* WA-SCOPE-2: role-scoped accounts are never auto-picked by
                    workflows (no acting user) — manual sending only. */}
                {row.role_name && <SoftChip label={t('whatsapp.manualOnly')} color={null} />}
                <SoftChip label={row.has_verify_token ? t('whatsapp.verifyTokenSet') : t('whatsapp.verifyTokenUnset')}
                  color={row.has_verify_token ? 'var(--color-success)' : null} />
                {canManage && (
                  <DefaultToggle active={row.is_default} busy={promotingId === row.id} undoable={false} title={undefined}
                    onClick={() => promote(row)} activeLabel={t('common.default')} inactiveLabel={t('common.setDefault')} />
                )}
                {canManage && (
                  <>
                    <Button variant="secondary" iconOnly size="sm" onClick={() => checkConnectionStatus(row)}
                      disabled={checkingId === row.id} title={t('whatsapp.checkStatus')} aria-label={t('whatsapp.checkStatus')}>
                      {checkingId === row.id ? <Spinner size={11} /> : <RefreshCw size={11} />}
                    </Button>
                    <Button variant="secondary" iconOnly size="sm" onClick={() => setFormTarget(row)}
                      title={t('common:edit')} aria-label={t('common:edit')}>
                      <Pencil size={11} />
                    </Button>
                    <Button variant="dangerSoft" iconOnly size="sm" onClick={() => remove(row)}
                      disabled={deletingId === row.id} title={t('common:delete')} aria-label={t('common:delete')}>
                      {deletingId === row.id ? <Spinner size={11} /> : <Trash2 size={11} />}
                    </Button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {formTarget === 'create' && (
        <WhatsAppConnectionForm connection={null} onSaved={handleSaved} onCancel={() => setFormTarget(null)} />
      )}
      {dialog}
    </div>
  )
}

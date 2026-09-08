/**
 * ApiKeyDetail — the per-key detail (replaces the list, like RolesSettings).
 *
 * A header (back, name, status, "Action" menu) over two local tabs: General and
 * Access. It owns the key's live state: general edits, scope changes, status
 * toggle, secret regeneration (one-time banner) and deletion all flow through
 * here and bubble back to the list via onPatch / onDelete.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Key, MoreHorizontal, Power, RefreshCw, Trash2 } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'
import ActionMenu from '@/components/ui/ActionMenu'
import CalloutBox from '@/components/ui/CalloutBox'
import SubTabBar from '@/components/drawer/SubTabBar'
import { useConfirm } from '@/hooks/useConfirm'
import { getApiKey, updateApiKey, deleteApiKey, regenerateApiKey, setApiKeyPrimary } from './apiKeysApi'
import ApiKeyGeneralTab from './ApiKeyGeneralTab'
import ApiKeyAccessTab from './ApiKeyAccessTab'
import SettingsDetailHeader from '@/pages/settings/components/SettingsDetailHeader'
import SecretRevealBox from '@/pages/settings/components/SecretRevealBox'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
// audit r2-ui-states-3: a failed save must tell the admin, not silently revert (the api client's toast is DEV-only).

// Owns one API key's full lifecycle: fetch full detail, edit, status toggle, secret regeneration and deletion, bubbling changes back to the list.
export default function ApiKeyDetail({ keyId, listRow, onBack, onPatch, onDelete }) {
  const { t } = useTranslation('settings')
  const [apiKey, setApiKey]   = useState(listRow ?? null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('general')
  const [secret, setSecret]   = useState(null)   // one-time secret after regenerate
  const { confirm, dialog } = useConfirm()

  // Fetch full detail (scopes/ips/contact); fall back to the list row on failure.
  useEffect(() => {
    let active = true
    getApiKey(keyId)
      .then((full) => { if (active) setApiKey((prev) => ({ ...prev, ...full })) })
      .catch(() => { /* keep listRow */ })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [keyId])

  // Persist a partial change and reflect it locally + in the parent list.
  const applyUpdate = async (patch) => {
    const updated = await updateApiKey(keyId, patch)
    const merged = { ...apiKey, ...patch, ...updated }
    setApiKey(merged)
    onPatch?.(keyId, merged)
    return merged
  }

  const statusMap = {
    active:   { label: t('apiKeys.status.active'),   bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' },
    disabled: { label: t('apiKeys.status.disabled'), bg: 'var(--hover-bg)', color: 'var(--text-muted)' },
  }

  // Header actions.
  const regenerate = async () => {
    try { const res = await regenerateApiKey(keyId); setSecret(res?.secret ?? null) } catch { /* noop */ }
  }
  // Flip active ⇄ disabled and persist it immediately.
  const toggleStatus = () => {
    const next = (apiKey?.status ?? 'active') === 'active' ? 'disabled' : 'active'
    applyUpdate({ status: next }).catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }
  // Confirm, then delete the key for real and let the parent list drop the row.
  const remove = () => {
    confirm(t('apiKeys.deleteConfirm', { name: apiKey?.friendly_name ?? '' }), async () => {
      try { await deleteApiKey(keyId); onDelete?.(keyId) } catch { /* noop */ }
    }, { danger: true })
  }
  // K-282: promote this key to primary after confirmation. The backend
  // auto-demotes the previous primary, so onPatch's reload (useApiKeys) also
  // corrects that sibling row once it resolves.
  const makePrimary = () => {
    confirm(t('apiKeys.makePrimaryConfirm'), async () => {
      try {
        const updated = await setApiKeyPrimary(keyId)
        const merged = { ...apiKey, type: 'primary', ...updated }
        setApiKey(merged)
        onPatch?.(keyId, merged)
        notifySuccess(t('apiKeys.makePrimarySuccess'))
      } catch (err) {
        notifyError(extractApiError(err, t('common:actionFailed')))
      }
    })
  }

  if (!apiKey) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
  }

  const tabs = [
    { id: 'general', label: t('apiKeys.tab.general') },
    { id: 'access', label: t('apiKeys.tab.access') },
  ]

  return (
    <div>
      <SettingsDetailHeader
        onBack={onBack}
        backLabel={t('common.back')}
        icon={Key}
        title={apiKey.friendly_name ?? apiKey.name}
        statusBadge={<StatusBadge status={apiKey.status ?? 'active'} map={statusMap} />}
        actions={
          <ActionMenu
            label={t('apiKeys.action')}
            icon={MoreHorizontal}
            align="right"
            menuWidth={220}
            items={[
              { key: 'regenerate', label: t('apiKeys.regenerate'), icon: RefreshCw, onSelect: regenerate },
              { key: 'toggle', label: (apiKey.status ?? 'active') === 'active' ? t('apiKeys.deactivate') : t('apiKeys.activate'), icon: Power, onSelect: toggleStatus },
              { key: 'delete', label: t('apiKeys.delete'), icon: Trash2, danger: true, onSelect: remove },
            ]}
          />
        }
      />

      {/* One-time secret banner after regenerate */}
      {secret && (
        <div style={{ margin: '14px 0' }}>
          <CalloutBox
            variant="success"
            title={t('apiKeys.secretOnce')}
            onDismiss={() => setSecret(null)}
            dismissLabel={t('apiKeys.dismiss')}
          >
            <SecretRevealBox
              secret={secret}
              copyLabel={t('apiKeys.copySecret')}
              copiedLabel={t('common.copied')}
            />
          </CalloutBox>
        </div>
      )}

      {/* Tab strip — the shared SubTabBar (DRY-1 O5); the wrapper keeps the old outer
          margins and the row keeps the loading spinner inline at the strip's end. */}
      <div style={{ margin: '16px 0 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}><SubTabBar tabs={tabs} active={tab} onChange={setTab} /></div>
        {loading && <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}><Spinner size={13} /></span>}
      </div>

      {/* Active tab */}
      {tab === 'general'
        ? <ApiKeyGeneralTab apiKey={apiKey} onSave={applyUpdate} onMakePrimary={makePrimary} />
        : <ApiKeyAccessTab scopes={apiKey.scopes ?? {}} onSave={(scopes) => applyUpdate({ scopes })} />}
      {dialog}
    </div>
  )
}

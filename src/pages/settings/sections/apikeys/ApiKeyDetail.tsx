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
import { Key } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'
import { CredentialActionMenu } from '@/pages/settings/components/CredentialActionMenu'
import CalloutBox from '@/components/ui/CalloutBox'
import SubTabBar from '@/components/drawer/SubTabBar'
import { useConfirm } from '@/hooks/useConfirm'
import { getApiKey, updateApiKey, deleteApiKey, regenerateApiKey, setApiKeyPrimary } from './apiKeysApi'
import ApiKeyGeneralTab from './ApiKeyGeneralTab'
import ApiKeyAccessTab from './ApiKeyAccessTab'
import type { ScopeMap } from './ScopeEditor'
import SettingsDetailHeader from '@/pages/settings/components/SettingsDetailHeader'
import SecretRevealBox from '@/pages/settings/components/SecretRevealBox'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { ApiKeyRow } from './ApiKeyList'
// audit r2-ui-states-3: a failed save must tell the admin, not silently revert (the api client's toast is DEV-only).

// The full key detail (list row + fields only the detail fetch/edit carries).
// hand-written: the spec carries no 2xx schema for GET/PUT /api-keys/{id}
export interface ApiKey extends ApiKeyRow {
  scopes?: ScopeMap
  allowed_ips?: string[]
  contact_name?: string
  contact_email?: string
  description?: string
}
// A partial patch of the fields above, as sent to updateApiKey/onPatch.
export type ApiKeyPatch = Partial<ApiKey>

interface ApiKeyDetailProps {
  keyId: string // the key being viewed/edited
  listRow?: ApiKeyRow // the row already known from the list, shown while the full fetch resolves
  onBack: () => void // return to the list
  onPatch: (id: string, merged: ApiKey) => void // bubble a persisted change up to the list
  onDelete: (id: string) => void // bubble a deletion up to the list
}

// Owns one API key's full lifecycle: fetch full detail, edit, status toggle, secret regeneration and deletion, bubbling changes back to the list.
export default function ApiKeyDetail({ keyId, listRow, onBack, onPatch, onDelete }: ApiKeyDetailProps) {
  const { t } = useTranslation('settings')
  const [apiKey, setApiKey]   = useState<ApiKey | null>(listRow ?? null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('general')
  const [secret, setSecret]   = useState<string | null>(null)   // one-time secret after regenerate
  const { confirm, dialog } = useConfirm()

  // Fetch full detail (scopes/ips/contact); fall back to the list row on failure.
  useEffect(() => {
    let active = true
    getApiKey(keyId)
      .then((full) => { if (active) setApiKey((prev) => ({ ...prev, ...(full as ApiKey) })) })
      .catch(() => { /* keep listRow */ })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [keyId])

  // Persist a partial change and reflect it locally + in the parent list.
  const applyUpdate = async (patch: ApiKeyPatch): Promise<ApiKey> => {
    const updated = await updateApiKey(keyId, patch) as ApiKey
    const merged = { ...apiKey, ...patch, ...updated } as ApiKey
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
    try { const res = await regenerateApiKey(keyId) as { secret?: string }; setSecret(res?.secret ?? null) } catch { /* noop */ }
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
        const updated = await setApiKeyPrimary(keyId) as ApiKey
        const merged = { ...apiKey, type: 'primary', ...updated } as ApiKey
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
        title={apiKey.friendly_name ?? apiKey.name ?? ''}
        statusBadge={<StatusBadge status={apiKey.status ?? 'active'} map={statusMap} />}
        actions={
          <CredentialActionMenu
            actionLabel={t('apiKeys.action')}
            regenerateLabel={t('apiKeys.regenerate')}
            activateLabel={t('apiKeys.activate')}
            deactivateLabel={t('apiKeys.deactivate')}
            deleteLabel={t('apiKeys.delete')}
            status={apiKey.status}
            onRegenerate={regenerate}
            onToggleStatus={toggleStatus}
            onDelete={remove}
          />
        }
      />

      {/* One-time secret banner after regenerate.
          DRY: the CredentialActionMenu call above and this CalloutBox opening are
          already the shared component's own prop contract, mirrored on the
          WebhookDetail side — the secret's own content below differs per screen. */}
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

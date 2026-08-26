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
import { ArrowLeft, Check, Copy, Key, MoreHorizontal, Power, RefreshCw, Trash2 } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'
import ActionMenu from '@/components/ui/ActionMenu'
import CalloutBox from '@/components/ui/CalloutBox'
import { useConfirm } from '@/hooks/useConfirm'
import { getApiKey, updateApiKey, deleteApiKey, regenerateApiKey } from './apiKeysApi'
import ApiKeyGeneralTab from './ApiKeyGeneralTab'
import ApiKeyAccessTab from './ApiKeyAccessTab'
import { BTN_H } from '@/config/buttonMetrics'
import Button from '@/components/ui/Button'
import { Mono } from '@/components/ui/typography'
import { tintBorder } from '@/lib/tint'

// Owns one API key's full lifecycle: fetch full detail, edit, status toggle, secret regeneration and deletion, bubbling changes back to the list.
export default function ApiKeyDetail({ keyId, listRow, onBack, onPatch, onDelete }) {
  const { t } = useTranslation('settings')
  const [apiKey, setApiKey]   = useState(listRow ?? null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('general')
  const [secret, setSecret]   = useState(null)   // one-time secret after regenerate
  const [copied, setCopied]   = useState(false)
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
    applyUpdate({ status: next }).catch(() => {})
  }
  // Confirm, then delete the key for real and let the parent list drop the row.
  const remove = () => {
    confirm(t('apiKeys.deleteConfirm', { name: apiKey?.friendly_name ?? '' }), async () => {
      try { await deleteApiKey(keyId); onDelete?.(keyId) } catch { /* noop */ }
    }, { danger: true })
  }
  const copySecret = () => { navigator.clipboard.writeText(secret ?? ''); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  if (!apiKey) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
  }

  const tabs = [['general', t('apiKeys.tab.general')], ['access', t('apiKeys.tab.access')]]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 8, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Button variant="secondary" onClick={onBack} aria-label={t('common.back')}>
            <ArrowLeft size={13} /> {t('common.back')}
          </Button>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Key size={16} style={{ color: 'var(--color-primary-text)' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{apiKey.friendly_name ?? apiKey.name}</h2>
          </div>
          <StatusBadge status={apiKey.status ?? 'active'} map={statusMap} />
        </div>
        <ActionMenu label={t('apiKeys.action')} icon={MoreHorizontal} align="right" menuWidth={220}
          items={[
            { key: 'regenerate', label: t('apiKeys.regenerate'), icon: RefreshCw, onSelect: regenerate },
            { key: 'toggle', label: (apiKey.status ?? 'active') === 'active' ? t('apiKeys.deactivate') : t('apiKeys.activate'), icon: Power, onSelect: toggleStatus },
            { key: 'delete', label: t('apiKeys.delete'), icon: Trash2, danger: true, onSelect: remove },
          ]} />
      </div>

      {/* One-time secret banner after regenerate */}
      {secret && (
        <div style={{ margin: '14px 0' }}>
          <CalloutBox variant="success" title={t('apiKeys.secretOnce')}
            onDismiss={() => setSecret(null)} dismissLabel={t('apiKeys.dismiss')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mono as="code" style={{ flex: 1, fontSize: 12, background: 'var(--surface)', border: tintBorder('var(--color-success)'), borderRadius: 6, padding: '8px 10px', color: 'var(--text)', overflowX: 'auto', whiteSpace: 'nowrap' }}>{secret}</Mono>
              {/* HUISSTIJL-1 necessity: success-tinted action, no Button variant covers a success-tinted border/text pairing (only primary/secondary/ghost/soft/danger/dangerSoft exist). */}
              <button onClick={copySecret}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- state-carrying success accent (secret-copy confirmation); Button has no success-tint variant
                style={{ height: BTN_H, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, border: tintBorder('var(--color-success)'), borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--color-success-text)', whiteSpace: 'nowrap' }}>
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t('common.copied') : t('apiKeys.copySecret')}
              </button>
            </div>
          </CalloutBox>
        </div>
      )}

      {/* Tab strip */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', margin: '16px 0 24px' }}>
        {tabs.map(([id, label]) => {
          const active = id === tab
          return (
            <button key={id} role="tab" aria-selected={active} onClick={() => setTab(id)}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- state-carrying tab-strip control: active tab reads a colored underline, not a Button fill; Button has no tab face
              style={{ padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500, color: active ? 'var(--color-primary)' : 'var(--text-muted)', borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`, marginBottom: -1 }}>
              {label}
            </button>
          )
        })}
        {loading && <span style={{ color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 8 }}><Spinner size={13} /></span>}
      </div>

      {/* Active tab */}
      {tab === 'general'
        ? <ApiKeyGeneralTab apiKey={apiKey} onSave={applyUpdate} />
        : <ApiKeyAccessTab scopes={apiKey.scopes ?? {}} onSave={(scopes) => applyUpdate({ scopes })} />}
      {dialog}
    </div>
  )
}

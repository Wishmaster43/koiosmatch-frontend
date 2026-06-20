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
import StatusBadge from '../../../../components/ui/StatusBadge'
import ActionMenu from '../../../../components/ui/ActionMenu'
import { getApiKey, updateApiKey, deleteApiKey, regenerateApiKey } from './apiKeysApi'
import ApiKeyGeneralTab from './ApiKeyGeneralTab'
import ApiKeyAccessTab from './ApiKeyAccessTab'

export default function ApiKeyDetail({ keyId, listRow, onBack, onPatch, onDelete }) {
  const { t } = useTranslation('settings')
  const [apiKey, setApiKey]   = useState(listRow ?? null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('general')
  const [secret, setSecret]   = useState(null)   // one-time secret after regenerate
  const [copied, setCopied]   = useState(false)

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
    active:   { label: t('apiKeys.status.active'),   bg: '#F0FDF4', color: 'var(--color-success)' },
    disabled: { label: t('apiKeys.status.disabled'), bg: 'var(--hover-bg)', color: 'var(--text-muted)' },
  }

  // Header actions.
  const regenerate = async () => {
    try { const res = await regenerateApiKey(keyId); setSecret(res?.secret ?? null) } catch { /* noop */ }
  }
  const toggleStatus = () => {
    const next = (apiKey?.status ?? 'active') === 'active' ? 'disabled' : 'active'
    applyUpdate({ status: next }).catch(() => {})
  }
  const remove = async () => {
    if (!window.confirm(t('apiKeys.deleteConfirm', { name: apiKey?.friendly_name ?? '' }))) return
    try { await deleteApiKey(keyId); onDelete?.(keyId) } catch { /* noop */ }
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
          <button onClick={onBack} aria-label={t('common.back')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--hover-bg)', color: 'var(--text)', cursor: 'pointer' }}>
            <ArrowLeft size={13} /> {t('common.back')}
          </button>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Key size={16} style={{ color: 'var(--color-primary)' }} />
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
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 14, margin: '14px 0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 8 }}>{t('apiKeys.secretOnce')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: 'var(--surface)', border: '1px solid #BBF7D0', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', overflowX: 'auto', whiteSpace: 'nowrap' }}>{secret}</code>
            <button onClick={copySecret} style={{ height: 34, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, border: '1px solid #BBF7D0', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t('common.copied') : t('apiKeys.copySecret')}
            </button>
          </div>
          <button onClick={() => setSecret(null)} style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('apiKeys.dismiss')}</button>
        </div>
      )}

      {/* Tab strip */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', margin: '16px 0 24px' }}>
        {tabs.map(([id, label]) => {
          const active = id === tab
          return (
            <button key={id} role="tab" aria-selected={active} onClick={() => setTab(id)}
              style={{ padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500, color: active ? 'var(--color-primary)' : 'var(--text-muted)', borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`, marginBottom: -1 }}>
              {label}
            </button>
          )
        })}
        {loading && <RefreshCw size={13} className="animate-spin" style={{ color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 8 }} />}
      </div>

      {/* Active tab */}
      {tab === 'general'
        ? <ApiKeyGeneralTab apiKey={apiKey} onSave={applyUpdate} />
        : <ApiKeyAccessTab scopes={apiKey.scopes ?? {}} onSave={(scopes) => applyUpdate({ scopes })} />}
    </div>
  )
}

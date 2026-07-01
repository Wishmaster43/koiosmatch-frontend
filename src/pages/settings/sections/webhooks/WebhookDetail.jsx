/**
 * WebhookDetail — the per-subscription detail (replaces the list). A header
 * (back, name, status, Action menu) over two cards: the editable name + URL, and
 * the event filter. Status toggle, secret regeneration (one-time banner) and
 * deletion live in the Action menu and bubble back to the list via onPatch/onDelete.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, Copy, MoreHorizontal, Pencil, Power, RefreshCw, Save, Trash2, Webhook, X } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import ActionMenu from '@/components/ui/ActionMenu'
import { getSubscription, updateSubscription, deleteSubscription, regenerateSecret } from './webhooksApi'
import EventCatalog from './EventCatalog'

export default function WebhookDetail({ subId, listRow, onBack, onPatch, onDelete }) {
  const { t } = useTranslation('settings')
  const [sub, setSub]         = useState(listRow ?? null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState(listRow ?? { name: '', url: '' })
  const [events, setEvents]   = useState(listRow?.event_types ?? [])
  const [savingEv, setSavingEv] = useState(false)
  const [savedEv, setSavedEv]   = useState(false)
  const [secret, setSecret]   = useState(null)
  const [copied, setCopied]   = useState(false)

  // Fetch full detail; fall back to the list row on failure.
  useEffect(() => {
    let active = true
    getSubscription(subId)
      .then((full) => { if (active) { setSub((p) => ({ ...p, ...full })); setForm((f) => ({ ...f, ...full })); setEvents(full.event_types ?? []) } })
      .catch(() => { /* keep listRow */ })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [subId])

  // Persist a partial change and reflect it locally + in the parent list.
  const applyUpdate = async (patch) => {
    const updated = await updateSubscription(subId, patch)
    const merged = { ...sub, ...patch, ...updated }
    setSub(merged)
    onPatch?.(subId, merged)
    return merged
  }

  const statusMap = {
    active:   { label: t('webhooks.outgoing.status.active'),   bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    disabled: { label: t('webhooks.outgoing.status.disabled'), bg: 'var(--hover-bg)', color: 'var(--text-muted)' },
  }

  // Save name + url (the editable card).
  const saveDetails = async () => {
    try { await applyUpdate({ name: form.name, url: form.url }); setEditing(false) } catch { /* noop */ }
  }
  // Save the event filter.
  const saveEvents = async () => {
    setSavingEv(true)
    try { await applyUpdate({ event_types: events }); setSavedEv(true); setTimeout(() => setSavedEv(false), 1800) } catch { /* noop */ }
    setSavingEv(false)
  }

  // Header actions.
  const regenerate = async () => { try { const res = await regenerateSecret(subId); setSecret(res?.secret ?? null) } catch { /* noop */ } }
  const toggleStatus = () => applyUpdate({ status: (sub?.status ?? 'active') === 'active' ? 'disabled' : 'active' }).catch(() => {})
  const remove = async () => {
    if (!window.confirm(t('webhooks.outgoing.deleteConfirm', { name: sub?.name ?? '' }))) return
    try { await deleteSubscription(subId); onDelete?.(subId) } catch { /* noop */ }
  }
  const copySecret = () => { navigator.clipboard.writeText(secret ?? ''); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  if (!sub) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>

  const eventsDirty = JSON.stringify([...events].sort()) !== JSON.stringify([...(sub.event_types ?? [])].sort())
  const inputStyle = { width: '100%', height: 34, padding: '0 10px', fontSize: 13, color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: 'var(--surface)' }
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }

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
            <Webhook size={16} style={{ color: 'var(--color-primary)' }} />
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.name}</h2>
          <StatusBadge status={sub.status ?? 'active'} map={statusMap} />
          {loading && <RefreshCw size={13} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
        </div>
        <ActionMenu label={t('webhooks.outgoing.action')} icon={MoreHorizontal} align="right" menuWidth={220}
          items={[
            { key: 'regenerate', label: t('webhooks.outgoing.regenerate'), icon: RefreshCw, onSelect: regenerate },
            { key: 'toggle', label: (sub.status ?? 'active') === 'active' ? t('webhooks.outgoing.deactivate') : t('webhooks.outgoing.activate'), icon: Power, onSelect: toggleStatus },
            { key: 'delete', label: t('webhooks.outgoing.delete'), icon: Trash2, danger: true, onSelect: remove },
          ]} />
      </div>

      {/* One-time secret banner after regenerate */}
      {secret && (
        <div style={{ background: 'var(--color-success-bg)', border: '1px solid #BBF7D0', borderRadius: 10, padding: 14, margin: '14px 0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 8 }}>{t('webhooks.outgoing.secretOnce')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: 'var(--surface)', border: '1px solid #BBF7D0', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', overflowX: 'auto', whiteSpace: 'nowrap' }}>{secret}</code>
            <button onClick={copySecret} style={{ height: 34, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, border: '1px solid #BBF7D0', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t('common.copied') : t('webhooks.outgoing.copySecret')}
            </button>
          </div>
          <button onClick={() => setSecret(null)} style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('webhooks.outgoing.dismiss')}</button>
        </div>
      )}

      {/* Details card (name + url) */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, margin: '18px 0', maxWidth: 680 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: editing ? 14 : 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('webhooks.outgoing.detailsTitle')}</span>
          {editing ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setForm(sub); setEditing(false) }} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}><X size={13} /> {t('common.cancel')}</button>
              <button onClick={saveDetails} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 14px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}><Save size={13} /> {t('common.save')}</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', fontSize: 13, fontWeight: 500, border: '1px solid var(--color-primary)', borderRadius: 8, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', cursor: 'pointer' }}><Pencil size={13} /> {t('webhooks.outgoing.edit')}</button>
          )}
        </div>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>{t('webhooks.outgoing.field.name')}</label>
              <input value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t('webhooks.outgoing.field.url')}</label>
              <input value={form.url ?? ''} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }} />
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text)' }}>
            <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{sub.url}</code>
          </div>
        )}
      </div>

      {/* Event filter card */}
      <div style={{ maxWidth: 680 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('webhooks.outgoing.field.events')}</span>
          <button onClick={saveEvents} disabled={!eventsDirty || savingEv}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, cursor: eventsDirty && !savingEv ? 'pointer' : 'default', opacity: eventsDirty || savedEv ? 1 : 0.55, background: savedEv ? 'var(--color-success)' : 'var(--color-primary)', color: 'white' }}>
            {savedEv ? <><Check size={13} /> {t('common.saved')}</> : savingEv ? <><RefreshCw size={13} className="animate-spin" /> {t('common.saving')}</> : <><Save size={13} /> {t('common.save')}</>}
          </button>
        </div>
        <EventCatalog value={events} onChange={setEvents} />
      </div>
    </div>
  )
}

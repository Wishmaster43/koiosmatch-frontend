/**
 * ApiKeyGeneralTab — the "General" tab. Read mode shows every field via the
 * shared DetailTable plus the (masked) secret and IP whitelist; the "Edit"
 * button flips to an inline form. The plaintext secret is never available here —
 * it is shown only once at create/regenerate — so this tab can only mask it.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, RefreshCw, Save, X } from 'lucide-react'
import DetailTable from '../../../../components/ui/DetailTable'
import { useDateFormat } from '../../../../lib/datetime'
import { KEY_TYPES, isValidIpOrCidr } from './constants'

export default function ApiKeyGeneralTab({ apiKey, onSave }) {
  const { t } = useTranslation('settings')
  const { formatDate } = useDateFormat()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState(apiKey)
  const [ipDraft, setIpDraft] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const ips = form.allowed_ips ?? []

  // Add a typed IP/CIDR to the whitelist if it passes the light client check.
  const addIp = () => {
    const v = ipDraft.trim()
    if (!v || !isValidIpOrCidr(v) || ips.includes(v)) return
    setForm((f) => ({ ...f, allowed_ips: [...ips, v] }))
    setIpDraft('')
  }
  const removeIp = (ip) => setForm((f) => ({ ...f, allowed_ips: ips.filter((x) => x !== ip) }))

  // Persist the edited fields, then leave edit mode on success.
  const save = async () => {
    setSaving(true)
    try {
      await onSave({
        friendly_name: form.friendly_name, type: form.type, organisation: form.organisation,
        description: form.description, contact_name: form.contact_name, contact_email: form.contact_email,
        allowed_ips: form.allowed_ips ?? [],
      })
      setEditing(false)
    } catch { /* surfaced by the detail container */ }
    setSaving(false)
  }

  const cancel = () => { setForm(apiKey); setEditing(false) }

  const inputStyle = { width: '100%', height: 32, padding: '0 10px', fontSize: 13, color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 7, outline: 'none', background: 'var(--surface)' }
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }

  // Read-only field rows for DetailTable.
  const rows = [
    [t('apiKeys.field.type'), t(`apiKeys.type.${apiKey.type ?? 'additional'}`, { defaultValue: apiKey.type })],
    [t('apiKeys.field.name'), apiKey.friendly_name ?? apiKey.name],
    [t('apiKeys.field.organisation'), apiKey.organisation],
    [t('apiKeys.field.description'), apiKey.description],
    [t('apiKeys.field.guid'), <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{apiKey.guid ?? '—'}</code>],
    [t('apiKeys.field.secret'), <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)' }}>••••••••••••  <span style={{ fontFamily: 'inherit', fontSize: 11 }}>({t('apiKeys.secretHidden')})</span></span>],
    [t('apiKeys.field.created'), formatDate(apiKey.created_at)],
    [t('apiKeys.field.updated'), formatDate(apiKey.updated_at)],
    [t('apiKeys.field.contactName'), apiKey.contact_name],
    [t('apiKeys.field.contactEmail'), apiKey.contact_email],
  ]

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Toolbar: Edit / Save+Cancel */}
      <div className="flex items-center justify-end" style={{ marginBottom: 14, gap: 8 }}>
        {editing ? (
          <>
            <button onClick={cancel} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
              <X size={13} /> {t('common.cancel')}
            </button>
            <button onClick={save} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />} {t('common.save')}
            </button>
          </>
        ) : (
          <button onClick={() => setEditing(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 13, fontWeight: 500, border: '1px solid var(--color-primary)', borderRadius: 8, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', cursor: 'pointer' }}>
            <Pencil size={13} /> {t('apiKeys.edit')}
          </button>
        )}
      </div>

      {/* Fields */}
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('apiKeys.field.name')}</label>
              <input value={form.friendly_name ?? ''} onChange={set('friendly_name')} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('apiKeys.field.type')}</label>
              <select value={form.type ?? 'additional'} onChange={set('type')} style={{ ...inputStyle, cursor: 'pointer' }}>
                {KEY_TYPES.map((ty) => <option key={ty} value={ty}>{t(`apiKeys.type.${ty}`)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('apiKeys.field.organisation')}</label>
              <input value={form.organisation ?? ''} onChange={set('organisation')} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('apiKeys.field.description')}</label>
              <input value={form.description ?? ''} onChange={set('description')} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('apiKeys.field.contactName')}</label>
              <input value={form.contact_name ?? ''} onChange={set('contact_name')} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('apiKeys.field.contactEmail')}</label>
              <input type="email" value={form.contact_email ?? ''} onChange={set('contact_email')} style={inputStyle} />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <DetailTable rows={rows} labelWidth={150} lastBorder={false} />
        </div>
      )}

      {/* Allowed IPs — optional whitelist (chips) */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('apiKeys.allowedIps')}</div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{t('apiKeys.allowedIpsHint')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: editing ? 10 : 0 }}>
          {ips.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('apiKeys.noIps')}</span>}
          {ips.map((ip) => (
            <span key={ip} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '4px 10px', background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)' }}>
              {ip}
              {editing && (
                <button onClick={() => removeIp(ip)} aria-label={t('common.remove')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
        {editing && (
          <div style={{ display: 'flex', gap: 8, maxWidth: 320 }}>
            <input value={ipDraft} onChange={(e) => setIpDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addIp()}
              placeholder={t('apiKeys.ipPlaceholder')} style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }} />
            <button onClick={addIp} disabled={!isValidIpOrCidr(ipDraft)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: isValidIpOrCidr(ipDraft) ? 'pointer' : 'not-allowed', opacity: isValidIpOrCidr(ipDraft) ? 1 : 0.5, color: 'var(--text)' }}>
              <Plus size={13} /> {t('common.add')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * OutreachCreate — inline "new campaign" view (replaces the list, like the
 * API-key/webhook create views). No modal: name + channel + optional source pool
 * render full-width. Picking a pool seeds the campaign's targets on create.
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, PhoneCall } from 'lucide-react'
import api from '@/lib/api'
import { createCampaign } from './data/outreachApi'
import type { Campaign } from './hooks/useOutreachCampaigns'

// Fixed backend enum (not a tenant lookup) — labels via i18n.
const CHANNELS = ['call', 'email', 'whatsapp'] as const

interface Pool { id: string; name: string; color?: string }

interface Props { onBack: () => void; onCreated: (c: Campaign) => void }

export default function OutreachCreate({ onBack, onCreated }: Props) {
  const { t } = useTranslation('outreach')
  const [name, setName]     = useState('')
  const [channel, setChannel] = useState<string>('call')
  const [poolId, setPoolId] = useState('')
  const [pools, setPools]   = useState<Pool[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(false)
  const firstField          = useRef<HTMLInputElement>(null)

  // Focus the name field on open.
  useEffect(() => { firstField.current?.focus() }, [])

  // Load talent pools for the optional source picker (shared /pools resource).
  useEffect(() => {
    api.get('/pools').then((r) => { const d = r.data; setPools(Array.isArray(d) ? d : (d?.data ?? [])) }).catch(() => {})
  }, [])

  const canSubmit = name.trim().length > 0

  // Create the campaign; from_pool_id (when set) seeds its targets server-side.
  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(false)
    try {
      const created = await createCampaign({ name: name.trim(), channel, ...(poolId ? { from_pool_id: poolId } : {}) })
      onCreated(created)
      onBack()
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', height: 38, padding: '0 11px', fontSize: 13, color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', background: 'var(--surface)' } as const
  const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5, display: 'block' } as const

  return (
    <div>
      {/* Header: back + icon + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <button onClick={onBack} aria-label={t('common:back', { defaultValue: 'Back' })}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--hover-bg)', color: 'var(--text)', cursor: 'pointer' }}>
          <ArrowLeft size={13} /> {t('common:back', { defaultValue: 'Back' })}
        </button>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <PhoneCall size={16} style={{ color: 'var(--color-primary)' }} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t('create.title')}</h2>
      </div>

      {/* Form, capped to a comfortable reading width */}
      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="oc-name">{t('create.name')}</label>
          <input id="oc-name" ref={firstField} value={name} onChange={(e) => setName(e.target.value)}
            placeholder={t('create.namePlaceholder')} style={inputStyle}
            onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>

        <div>
          <label style={labelStyle} htmlFor="oc-channel">{t('create.channel')}</label>
          <select id="oc-channel" value={channel} onChange={(e) => setChannel(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {CHANNELS.map((c) => <option key={c} value={c}>{t(`channel.${c}`)}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle} htmlFor="oc-pool">{t('create.pool')}</label>
          <select id="oc-pool" value={poolId} onChange={(e) => setPoolId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">{t('create.poolNone')}</option>
            {pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>{t('create.poolHint')}</p>
        </div>

        {error && <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t('create.error')}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={submit} disabled={saving || !canSubmit}
            style={{ height: 38, padding: '0 20px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5 }}>
            {saving ? t('create.saving') : t('create.submit')}
          </button>
          <button onClick={onBack}
            style={{ height: 38, padding: '0 16px', fontSize: 13, fontWeight: 500, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
            {t('common:cancel', { defaultValue: 'Cancel' })}
          </button>
        </div>
      </div>
    </div>
  )
}

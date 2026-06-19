/**
 * ProfileWhatsAppWeb — personal (per-user) WhatsApp Web linking via QR scan.
 * Distinct from the tenant-wide WhatsApp Business (WABA) in settings: this links
 * the logged-in user's own WhatsApp so they can scan with their phone.
 *
 * Backend contract (see backend prompt):
 *   GET  /profile/whatsapp-web            -> { status, phone?, qr? }
 *   POST /profile/whatsapp-web/connect     -> { status: 'qr_pending', qr }
 *   POST /profile/whatsapp-web/disconnect  -> { status: 'disconnected' }
 *   status ∈ disconnected | qr_pending | connected
 *
 * While the backend isn't built yet, a 404 degrades to a calm "unavailable"
 * state instead of crashing.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { MessageCircle, RefreshCw } from 'lucide-react'
import api from '../../lib/api'

const POLL_MS = 3000

export default function ProfileWhatsAppWeb() {
  const { t } = useTranslation('auth')
  const [status, setStatus] = useState('loading') // loading|disconnected|qr_pending|connected|unavailable
  const [qr,     setQr]     = useState(null)
  const [phone,  setPhone]  = useState(null)
  const [busy,   setBusy]   = useState(false)
  const pollRef = useRef(null)

  const apply = (data) => {
    setStatus(data?.status ?? 'disconnected')
    setQr(data?.qr ?? null)
    setPhone(data?.phone ?? null)
  }

  const load = async () => {
    try { apply((await api.get('/profile/whatsapp-web')).data) }
    catch (e) {
      if (e?.response?.status === 404) setStatus('unavailable')
      else setStatus('disconnected')
    }
  }

  useEffect(() => {
    load()
    return () => clearInterval(pollRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // While waiting for the scan, poll the status until it flips to connected.
  useEffect(() => {
    clearInterval(pollRef.current)
    if (status !== 'qr_pending') return
    pollRef.current = setInterval(async () => {
      try {
        const data = (await api.get('/profile/whatsapp-web')).data
        if (data?.status && data.status !== 'qr_pending') apply(data)
      } catch { /* keep waiting */ }
    }, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [status])

  const connect = async () => {
    setBusy(true)
    try { apply((await api.post('/profile/whatsapp-web/connect')).data) }
    catch (e) { if (e?.response?.status === 404) setStatus('unavailable') }
    finally { setBusy(false) }
  }

  const disconnect = async () => {
    setBusy(true)
    try { await api.post('/profile/whatsapp-web/disconnect') } catch { /* noop */ }
    setStatus('disconnected'); setQr(null); setPhone(null)
    setBusy(false)
  }

  const dot = (color) => ({ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 })

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -6, marginBottom: 16, lineHeight: 1.6 }}>
        {t('profile.whatsappWeb.desc')}
      </p>

      {status === 'loading' && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('profile.whatsappWeb.loading')}</p>
      )}

      {status === 'unavailable' && (
        <div style={{ padding: '14px 16px', background: 'var(--input-bg)', border: '1px solid var(--border)',
                      borderRadius: 10, fontSize: 13, color: 'var(--text-muted)' }}>
          {t('profile.whatsappWeb.unavailable')}
        </div>
      )}

      {status === 'connected' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                      background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(16,185,129,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MessageCircle size={18} color="var(--color-success)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              <span style={dot('var(--color-success)')} /> {t('profile.whatsappWeb.connected')}
            </div>
            {phone && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{phone}</div>}
          </div>
          <button onClick={disconnect} disabled={busy}
            style={{ height: 32, padding: '0 14px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                     border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
                     cursor: busy ? 'default' : 'pointer', flexShrink: 0 }}>
            {t('profile.whatsappWeb.disconnect')}
          </button>
        </div>
      )}

      {status === 'disconnected' && (
        <button onClick={connect} disabled={busy}
          style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 18px',
                   fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', color: 'white',
                   background: 'var(--color-primary)', cursor: busy ? 'default' : 'pointer' }}>
          {busy ? <RefreshCw size={14} className="animate-spin" /> : <MessageCircle size={14} />}
          {t('profile.whatsappWeb.connect')}
        </button>
      )}

      {status === 'qr_pending' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ padding: 12, background: 'white', borderRadius: 12, border: '1px solid var(--border)', flexShrink: 0 }}>
            {qr
              ? <QRCodeSVG value={qr} size={168} />
              : <div style={{ width: 168, height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={20} className="animate-spin" color="#9CA3AF" />
                </div>}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              <RefreshCw size={13} className="animate-spin" /> {t('profile.whatsappWeb.waiting')}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }}>
              {t('profile.whatsappWeb.scanHint')}
            </p>
            <button onClick={disconnect} disabled={busy}
              style={{ marginTop: 14, height: 30, padding: '0 12px', fontSize: 12, borderRadius: 7,
                       border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)',
                       cursor: 'pointer' }}>
              {t('common.cancel', { defaultValue: 'Annuleren' })}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

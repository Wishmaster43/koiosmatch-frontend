/**
 * WhatsAppSettings — shows the tenant's WhatsApp Business connection, linked
 * phone numbers (with quality rating) and message templates. Numbers/templates
 * can be re-synced from the provider. Labels are translated; the meta maps below
 * only carry the colours per quality/status/category key.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, RefreshCw, Search } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { BTN_H } from '@/config/buttonMetrics'

// Phone-number quality ratings → colour. Label = t('whatsapp.quality<KEY>').
const QUALITY_META = {
  GREEN:  { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  YELLOW: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  RED:    { color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)' },
}

// Template review status → colour. Label = t('whatsapp.status<KEY>').
const TEMPLATE_STATUS_META = {
  APPROVED: { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  PENDING:  { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  REJECTED: { color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)' },
  PAUSED:   { color: 'var(--text-muted)',              bg: 'var(--hover-bg)' },
}

// Connection status → colour. Label = t('whatsapp.status<Active|Inactive|Expired>').
const STATUS_CONN = {
  // eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this connection-status border shade; kept literal to avoid changing the rendered tone
  active:   { dotColor: 'var(--color-success)', border: '#86EFAC', bg: 'var(--color-success-bg)', labelColor: 'var(--color-success)' },
  inactive: { dotColor: 'var(--text-muted)',              border: 'var(--border)', bg: 'var(--hover-bg)', labelColor: 'var(--text-muted)' },
  // eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this connection-status border shade; kept literal to avoid changing the rendered tone
  expired:  { dotColor: 'var(--color-danger)',  border: '#FCA5A5', bg: 'var(--color-danger-bg)', labelColor: 'var(--color-danger)' },
}

export default function WhatsAppSettings() {
  const { t } = useTranslation('settings')
  const [connection, setConnection] = useState(null)
  const [connId,     setConnId]     = useState(null)
  const [phones,     setPhones]     = useState([])
  const [templates,  setTemplates]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [noConn,     setNoConn]     = useState(false)
  const [search,     setSearch]     = useState('')
  const [syncing,    setSyncing]    = useState(null) // 'numbers' | 'templates'
  const [syncMsg,    setSyncMsg]    = useState(null)
  const [tab,        setTab]        = useState('connection') // sub-tab: connection | numbers | templates

  const loadDetail = (id) =>
    api.get(`/whatsapp/${id}`).then(r => {
      const full = unwrap(r)
      setPhones(Array.isArray(full?.phone_numbers) ? full.phone_numbers : [])
      setTemplates(Array.isArray(full?.templates) ? full.templates : [])
    })

  useEffect(() => {
    api.get('/whatsapp')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
        if (list.length === 0) { setNoConn(true); return }
        const conn = list[0]
        setConnection(conn)
        setConnId(conn.id)
        return loadDetail(conn.id)
      })
      .catch(() => setNoConn(true))
      .finally(() => setLoading(false))
  }, [])

  const syncNumbers = async () => {
    setSyncing('numbers'); setSyncMsg(null)
    try {
      await api.post(`/whatsapp/${connId}/sync-numbers`)
      await loadDetail(connId)
      setSyncMsg({ ok: true, text: t('whatsapp.numbersSynced') })
    } catch { setSyncMsg({ ok: false, text: t('whatsapp.syncFailed') }) }
    setSyncing(null)
  }

  const syncTemplates = async () => {
    setSyncing('templates'); setSyncMsg(null)
    try {
      await api.post(`/whatsapp/${connId}/sync-templates`)
      await loadDetail(connId)
      setSyncMsg({ ok: true, text: t('whatsapp.templatesSynced') })
    } catch { setSyncMsg({ ok: false, text: t('whatsapp.syncFailed') }) }
    setSyncing(null)
  }

  const filteredTemplates = templates.filter(tpl => {
    const q = search.trim().toLowerCase()
    return !q || tpl.name?.toLowerCase().includes(q) || tpl.language?.toLowerCase().includes(q)
  })

  const connLabel = (status) => status === 'active' ? t('whatsapp.statusActive')
    : status === 'expired' ? t('whatsapp.statusExpired') : t('whatsapp.statusInactive')
  const cs = connection ? (STATUS_CONN[connection.status] ?? STATUS_CONN.inactive) : null

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('whatsapp.loading')}</p>
    </div>
  )

  // Sub-tabs: Connection · Phone numbers (count) · Templates (count).
  const TABS = [
    { id: 'connection', label: t('whatsapp.connection') },
    { id: 'numbers',    label: t('whatsapp.phoneNumbers'), count: phones.length },
    { id: 'templates',  label: t('whatsapp.templates'),    count: templates.length },
  ]

  return (
    <div style={{ maxWidth: 800 }}>

      {/* ── Sub-tab bar ── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {TABS.map(tb => {
          const active = tab === tb.id
          return (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: 'none',
                       border: 'none', borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
                       marginBottom: -1, cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500,
                       color: active ? 'var(--color-primary)' : 'var(--text-muted)' }}>
              {tb.label}
              {tb.count > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '1px 7px',
                               color: active ? 'var(--color-primary)' : 'var(--text-muted)', background: 'var(--hover-bg)' }}>
                  {tb.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {syncMsg && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 12,
                      background: syncMsg.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                      color: syncMsg.ok ? 'var(--color-success)' : 'var(--color-danger)',
                      // eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for these result-banner border shades; kept literal to avoid changing the rendered tone
                      border: `1px solid ${syncMsg.ok ? '#86EFAC' : '#FCA5A5'}` }}>
          {syncMsg.text}
        </div>
      )}

      {/* ── Connection status ── */}
      {tab === 'connection' && (
      <div>
        {noConn ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px',
                        // eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this danger-banner border shade; kept literal to avoid changing the rendered tone
                        background: 'var(--color-danger-bg)', border: '1px solid #FCA5A5', borderRadius: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-danger)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>{t('whatsapp.notConnected')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('whatsapp.notConnectedDesc')}</div>
            </div>
          </div>
        ) : cs ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px',
                          background: cs.bg, border: `1px solid ${cs.border}`, borderRadius: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: cs.dotColor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: cs.labelColor }}>{connLabel(connection.status)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {connection.provider && (
                    <span style={{ textTransform: 'capitalize', marginRight: 8 }}>{connection.provider}</span>
                  )}
                  {connection.waba_id && (
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                      WABA: {connection.waba_id}
                    </span>
                  )}
                </div>
              </div>
              {connection.last_checked_at && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {t('whatsapp.checked')} {new Date(connection.last_checked_at).toLocaleDateString()}
                </div>
              )}
            </div>
        ) : (
          <div style={{ padding: '16px 18px', background: 'var(--hover-bg)', border: '1px solid var(--border)',
                        borderRadius: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            {t('whatsapp.statusUnavailable')}
          </div>
        )}
      </div>
      )}

      {/* ── Phone numbers ── */}
      {tab === 'numbers' && (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 }}>
          {connId && (
            // BTN_H (§4/§9): one explicit height for every text/action button, everywhere.
            <button onClick={syncNumbers} disabled={syncing === 'numbers'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 12px',
                       fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                       border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              <RefreshCw size={11} style={{ animation: syncing === 'numbers' ? 'spin 1s linear infinite' : 'none' }} />
              {t('whatsapp.sync')}
            </button>
          )}
        </div>
        {phones.length === 0 ? (
          <div style={{ padding: '16px 18px', background: 'var(--hover-bg)', border: '1px solid var(--border)',
                        borderRadius: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            {t('whatsapp.noNumbers')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {phones.map((p, i) => {
              const q = QUALITY_META[p.quality_rating] ?? QUALITY_META.GREEN
              return (
                <div key={p.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 14,
                                               padding: '14px 18px', background: 'var(--surface)',
                                               border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-success-bg)',
                                 display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MessageCircle size={16} color="var(--color-success)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      {p.name ?? p.display_number}
                    </div>
                    {p.display_number && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 1 }}>
                        {p.display_number}
                      </div>
                    )}
                  </div>
                  {p.quality_rating && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: q.color, background: q.bg,
                                   borderRadius: 999, padding: '2px 10px', flexShrink: 0 }}>
                      {t('whatsapp.quality')}: {t(`whatsapp.quality${p.quality_rating}`)}
                    </span>
                  )}
                  {p.code_verification_status && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--hover-bg)',
                                   borderRadius: 999, padding: '2px 10px', flexShrink: 0,
                                   border: '1px solid var(--border)' }}>
                      {p.code_verification_status}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      )}

      {/* ── Templates ── */}
      {tab === 'templates' && (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {connId && (
              // BTN_H (§4/§9): one explicit height for every text/action button, everywhere.
              <button onClick={syncTemplates} disabled={syncing === 'templates'}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 12px',
                         fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                         border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
                <RefreshCw size={11} style={{ animation: syncing === 'templates' ? 'spin 1s linear infinite' : 'none' }} />
                {t('whatsapp.sync')}
              </button>
            )}
            {templates.length > 0 && (
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 8, top: '50%',
                                            transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={t('whatsapp.searchPlaceholder')}
                  style={{ height: 30, paddingLeft: 24, paddingRight: 10, fontSize: 12, width: 180,
                           border: '1px solid var(--border)', borderRadius: 8, outline: 'none', color: 'var(--text)' }} />
              </div>
            )}
          </div>
        </div>

        {templates.length === 0 ? (
          <div style={{ padding: '16px 18px', background: 'var(--hover-bg)', border: '1px solid var(--border)',
                        borderRadius: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            {t('whatsapp.noTemplates')}
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--hover-bg)' }}>
                  {[t('whatsapp.colName'), t('whatsapp.colCategory'), t('whatsapp.colLang'), t('whatsapp.colStatus')].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                                          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
                                          borderBottom: '1px solid var(--border)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '20px 14px', textAlign: 'center',
                                                fontSize: 13, color: 'var(--text-muted)' }}>
                    {t('whatsapp.noResults')}
                  </td></tr>
                )}
                {filteredTemplates.map((tpl, i) => {
                  const s = TEMPLATE_STATUS_META[tpl.status] ?? TEMPLATE_STATUS_META.PENDING
                  const bodyText = Array.isArray(tpl.components)
                    ? tpl.components.find(c => c.type === 'BODY')?.text
                    : null
                  const catKey = tpl.category ? t(`whatsapp.cat${tpl.category}`, { defaultValue: tpl.category }) : '—'
                  const statusLabel = t(`whatsapp.status${tpl.status}`, { defaultValue: tpl.status })
                  return (
                    <tr key={tpl.id ?? i}
                      style={{ borderBottom: '1px solid var(--hover-bg)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'monospace' }}>
                          {tpl.name}
                        </div>
                        {bodyText && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
                                         maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bodyText}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {catKey}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {tpl.language ?? '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg,
                                        borderRadius: 999, padding: '2px 8px' }}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

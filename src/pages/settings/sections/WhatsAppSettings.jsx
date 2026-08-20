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
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import AddWhatsAppConnectionForm from './whatsapp/AddWhatsAppConnectionForm'
import Button from '@/components/ui/Button'
import { Caption } from '@/components/ui/typography'

// Phone-number quality ratings → colour. Label = t('whatsapp.quality<KEY>').
const QUALITY_META = {
  GREEN:  { color: 'var(--color-success-text)', bg: 'var(--color-success-bg)' },
  YELLOW: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  RED:    { color: 'var(--color-danger-text)',  bg: 'var(--color-danger-bg)' },
}

// Template review status → colour. Label = t('whatsapp.status<KEY>').
const TEMPLATE_STATUS_META = {
  APPROVED: { color: 'var(--color-success-text)', bg: 'var(--color-success-bg)' },
  PENDING:  { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  REJECTED: { color: 'var(--color-danger-text)',  bg: 'var(--color-danger-bg)' },
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
  const [syncing,    setSyncing]    = useState(null) // 'status' | 'numbers' | 'templates'
  // PROVISION-GATE-1 (08-08, updated same day): these three actions were briefly
  // super-admin-only server-side, so the buttons were gated on that. Danny then
  // chose SELF-SERVICE, and the backend moved them onto
  // `module:whatsapp` + `permission:whatsapp.manage` (central.php:159, seeded on
  // tenant_admin) — so a bureau admin manages its own WABA. The UI gate now
  // mirrors that exact permission; hasPermission already lets super admins
  // through, so nothing is lost for them. Hidden (not disabled) for anyone
  // without the right — §3: never a button the server will 403.
  const { hasPermission } = useAuth()
  const canProvision = hasPermission?.('whatsapp.manage') === true
  const [syncMsg,    setSyncMsg]    = useState(null)
  const [tab,        setTab]        = useState('connection') // sub-tab: connection | numbers | templates

  // DATUM-1: the "checked at" stamp goes through the house formatter, never raw.
  const { formatDate } = useDateFormat()

  const loadDetail = (id) =>
    api.get(`/whatsapp/${id}`).then(r => {
      const full = unwrap(r)
      setPhones(Array.isArray(full?.phone_numbers) ? full.phone_numbers : [])
      setTemplates(Array.isArray(full?.templates) ? full.templates : [])
    })

  // Named (not inline in the effect) so the WABA form can reload after creating
  // the first connection — the same path the initial mount takes.
  const load = () => {
    setLoading(true)
    return api.get('/whatsapp')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
        if (list.length === 0) { setNoConn(true); return }
        const conn = list[0]
        setNoConn(false)
        setConnection(conn)
        setConnId(conn.id)
        return loadDetail(conn.id)
      })
      .catch(() => setNoConn(true))
      .finally(() => setLoading(false))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only fetch; load is stable in practice
  useEffect(() => { load() }, [])

  const syncNumbers = async () => {
    setSyncing('numbers'); setSyncMsg(null)
    try {
      await api.post(`/whatsapp/${connId}/sync-numbers`)
      await loadDetail(connId)
      setSyncMsg({ ok: true, text: t('whatsapp.numbersSynced') })
    } catch { setSyncMsg({ ok: false, text: t('whatsapp.syncFailed') }) }
    setSyncing(null)
  }

  // CONN-CHECK-1 (Danny live 08-08: "Verbinding toont alleen Inactief, geen
  // actieknop"): POST /whatsapp/{id}/check-status verifies the stored token
  // against Meta and flips the connection active — it existed server-side with
  // no button anywhere, so an inactive tenant had no way forward from this
  // screen. Same handler shape as the two syncs, so all three report through
  // the one syncMsg banner.
  const checkStatus = async () => {
    setSyncing('status'); setSyncMsg(null)
    try {
      await api.post(`/whatsapp/${connId}/check-status`)
      await loadDetail(connId)
      setSyncMsg({ ok: true, text: t('whatsapp.statusChecked') })
    } catch { setSyncMsg({ ok: false, text: t('whatsapp.statusCheckFailed') }) }
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

      {/* ── Sub-tab bar — HUISSTIJL-1: left hand-styled, this is a tab selector
          (bottom-border active indicator), not a chrome action button. ── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {TABS.map(tb => {
          const active = tab === tb.id
          return (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: 'none',
                       border: 'none', borderBottom: `2px solid ${active ? 'var(--color-primary)' : 'transparent'}`,
                       marginBottom: -1, cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500,
                       // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                       color: active ? 'var(--color-primary-text)' : 'var(--text-muted)' }}>
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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px',
                          // eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this danger-banner border shade; kept literal to avoid changing the rendered tone
                          background: 'var(--color-danger-bg)', border: '1px solid #FCA5A5', borderRadius: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-danger)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger-text)' }}>{t('whatsapp.notConnected')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('whatsapp.notConnectedDesc')}</div>
              </div>
            </div>
            {/* WA-CONN-FORM-1: the way back in after a wiped/absent connection —
                same permission gate as every provision action on this screen. */}
            {canProvision && <AddWhatsAppConnectionForm onCreated={load} />}
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
                    <Caption style={{ fontFamily: 'monospace' }}>
                      WABA: {connection.waba_id}
                    </Caption>
                  )}
                </div>
              </div>
              {connection.last_checked_at && (
                <Caption as="div" style={{ flexShrink: 0 }}>
                  {t('whatsapp.checked')} {formatDate(connection.last_checked_at)}
                </Caption>
              )}
              {/* CONN-CHECK-1: the one action this card was missing — re-verify the
                  token against Meta (and thereby activate an inactive connection).
                  Same button footprint as the two sync buttons on the other tabs. */}
              {connId && canProvision && (
                <Button variant="secondary" size="sm" onClick={checkStatus} disabled={syncing === 'status'}>
                  <RefreshCw size={11} style={{ animation: syncing === 'status' ? 'spin 1s linear infinite' : 'none' }} />
                  {t('whatsapp.checkStatus')}
                </Button>
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
          {connId && canProvision && (
            // BTN_H (§4/§9): one explicit height for every text/action button, everywhere.
            <Button variant="secondary" size="sm" onClick={syncNumbers} disabled={syncing === 'numbers'}>
              <RefreshCw size={11} style={{ animation: syncing === 'numbers' ? 'spin 1s linear infinite' : 'none' }} />
              {t('whatsapp.sync')}
            </Button>
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
                    <Caption style={{ background: 'var(--hover-bg)',
                                   borderRadius: 999, padding: '2px 10px', flexShrink: 0,
                                   border: '1px solid var(--border)' }}>
                      {p.code_verification_status}
                    </Caption>
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
              <Button variant="secondary" size="sm" onClick={syncTemplates} disabled={syncing === 'templates'}>
                <RefreshCw size={11} style={{ animation: syncing === 'templates' ? 'spin 1s linear infinite' : 'none' }} />
                {t('whatsapp.sync')}
              </Button>
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
                          <Caption as="div" style={{ marginTop: 2,
                                         maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bodyText}
                          </Caption>
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

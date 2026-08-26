/**
 * WhatsAppSettings — Settings → WhatsApp. Three sub-tabs: Connection (the tenant's
 * WhatsApp tokens — WA-VESTIGING-FE-1, a tenant can now hold MULTIPLE tokens, each
 * scoped to everyone / one branch / one role, see WhatsAppConnectionsList), Phone
 * numbers and Templates (synced from Meta for ONE selected connection — a picker
 * appears once the tenant holds more than one token). Labels are translated; the
 * meta maps below only carry the colours per quality/status/category key.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Search } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Field, SelectField } from '@/components/forms/fields'
import { useWhatsAppConnections } from './whatsapp/useWhatsAppConnections'
import WhatsAppConnectionsList from './whatsapp/WhatsAppConnectionsList'
import EmbeddedSignupCard from './whatsapp/EmbeddedSignupCard'
import SubTabBar, { type SubTab } from '@/components/drawer/SubTabBar'
import Button from '@/components/ui/Button'
import SoftChip from '@/components/ui/SoftChip'
import { BodyText, Caption, GroupLabel, Mono } from '@/components/ui/typography'

// One phone number under a connection (GET /whatsapp/{id}'s phone_numbers).
// `active` (WhatsappPhoneNumber::$casts) turns false when a WABA switch on the
// connection deactivates it server-side (WA-WABA-EDIT-1) — surfaced as a chip below.
interface PhoneNumberRow {
  id?: string
  name?: string
  display_number?: string
  quality_rating?: string
  code_verification_status?: string
  active?: boolean
}
// One synced Meta template component (BODY/HEADER/…), and one template row.
interface TemplateComponent { type?: string; text?: string }
interface TemplateRow {
  id?: string
  name?: string
  language?: string
  category?: string
  status?: string
  components?: TemplateComponent[]
}
interface ConnectionDetail { phone_numbers?: PhoneNumberRow[]; templates?: TemplateRow[] }

// Phone-number quality ratings → colour. Label = t('whatsapp.quality<KEY>'). Untyped
// keys (Record, not a literal union) since Meta's raw value is looked up dynamically.
const QUALITY_META: Record<string, { color: string; bg: string }> = {
  GREEN:  { color: 'var(--color-success-text)', bg: 'var(--color-success-bg)' },
  YELLOW: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  RED:    { color: 'var(--color-danger-text)',  bg: 'var(--color-danger-bg)' },
}

// Template review status → colour. Label = t('whatsapp.status<KEY>').
const TEMPLATE_STATUS_META: Record<string, { color: string; bg: string }> = {
  APPROVED: { color: 'var(--color-success-text)', bg: 'var(--color-success-bg)' },
  PENDING:  { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  REJECTED: { color: 'var(--color-danger-text)',  bg: 'var(--color-danger-bg)' },
  PAUSED:   { color: 'var(--text-muted)',              bg: 'var(--hover-bg)' },
}

// Settings → WhatsApp: manages the tenant's connections plus each connection's
// numbers/templates sub-views, gated on the whatsapp.manage permission.
export default function WhatsAppSettings() {
  const { t } = useTranslation('settings')
  // PROVISION-GATE-1 (08-08): the create/edit/sync affordances are gated on the
  // exact server permission (whatsapp.manage) — hidden, not disabled, for anyone
  // without it (§3). hasPermission already lets super admins through.
  const auth = useAuth()
  const canManage = auth?.hasPermission?.('whatsapp.manage') === true

  // The tenant's WhatsApp tokens — shared between the Connection tab (the list
  // itself) and the Numbers/Templates tabs (which need to pick ONE to view).
  const conn = useWhatsAppConnections()
  const { connections } = conn
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null)
  const [phones,    setPhones]    = useState<PhoneNumberRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [search,    setSearch]    = useState('')
  const [syncing,   setSyncing]   = useState<'numbers' | 'templates' | null>(null)
  const [syncMsg,   setSyncMsg]   = useState<{ ok: boolean; text: string } | null>(null)
  const [tab,       setTab]       = useState<'connection' | 'numbers' | 'templates'>('connection')

  // Default the numbers/templates connection to the tenant's default token (else
  // the first row) whenever the list changes and nothing valid is selected —
  // never override a still-valid manual pick.
  useEffect(() => {
    if (connections.length === 0) { setSelectedConnId(null); return }
    if (selectedConnId && connections.some(c => c.id === selectedConnId)) return
    setSelectedConnId((connections.find(c => c.is_default) ?? connections[0]).id)
  }, [connections, selectedConnId])

  // Entity-keyed load: an alive guard drops a stale response after a fast switch
  // between connections (§9). F2: also re-fires on `connections` — ANY list reload
  // (a save incl. a WABA switch that deactivates numbers server-side, a status
  // check, a promote, a local remove) hands out a fresh `connections` reference,
  // and that reference is the signal that this connection's own detail
  // (phone_numbers/templates) may have changed too, so refetch it here. One
  // bounded, user-initiated GET per reload; no polling feeds this dep.
  useEffect(() => {
    if (!selectedConnId) { setPhones([]); setTemplates([]); return }
    let alive = true
    api.get(`/whatsapp/${selectedConnId}`).then(r => {
      if (!alive) return
      const full = unwrap<ConnectionDetail>(r)
      setPhones(Array.isArray(full?.phone_numbers) ? full.phone_numbers : [])
      setTemplates(Array.isArray(full?.templates) ? full.templates : [])
    }).catch(() => { if (alive) { setPhones([]); setTemplates([]) } })
    return () => { alive = false }
  }, [selectedConnId, connections])

  // Re-fetch the selected connection's numbers/templates after a sync action.
  const reloadDetail = async () => {
    if (!selectedConnId) return
    const full = unwrap<ConnectionDetail>(await api.get(`/whatsapp/${selectedConnId}`))
    setPhones(Array.isArray(full?.phone_numbers) ? full.phone_numbers : [])
    setTemplates(Array.isArray(full?.templates) ? full.templates : [])
  }

  // Trigger a server-side numbers sync for the selected connection, then reload its detail.
  const syncNumbers = async () => {
    if (!selectedConnId) return
    setSyncing('numbers'); setSyncMsg(null)
    try { await api.post(`/whatsapp/${selectedConnId}/sync-numbers`); await reloadDetail(); setSyncMsg({ ok: true, text: t('whatsapp.numbersSynced') }) }
    catch { setSyncMsg({ ok: false, text: t('whatsapp.syncFailed') }) }
    setSyncing(null)
  }

  // Trigger a server-side templates sync for the selected connection, then reload its detail.
  const syncTemplates = async () => {
    if (!selectedConnId) return
    setSyncing('templates'); setSyncMsg(null)
    try { await api.post(`/whatsapp/${selectedConnId}/sync-templates`); await reloadDetail(); setSyncMsg({ ok: true, text: t('whatsapp.templatesSynced') }) }
    catch { setSyncMsg({ ok: false, text: t('whatsapp.syncFailed') }) }
    setSyncing(null)
  }

  const filteredTemplates = templates.filter(tpl => {
    const q = search.trim().toLowerCase()
    return !q || tpl.name?.toLowerCase().includes(q) || tpl.language?.toLowerCase().includes(q)
  })

  // Sub-tab count badge — a small pill next to the label, coloured by active state.
  const tabBadge = (count: number, id: string) => count > 0 && (
    <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '1px 7px', marginLeft: 5,
                   color: tab === id ? 'var(--color-primary)' : 'var(--text-muted)', background: 'var(--hover-bg)' }}>
      {count}
    </span>
  )
  // Sub-tabs: Connection · Phone numbers (count) · Templates (count) — the shared
  // SubTabBar (§4/§6: one look, roving-tabindex keyboard support) replaces the
  // hand-rolled tab strip every entity's own sub-tab bar used to re-paint.
  const TABS: SubTab[] = [
    { id: 'connection', label: t('whatsapp.connection') },
    { id: 'numbers',    label: <>{t('whatsapp.phoneNumbers')}{tabBadge(phones.length, 'numbers')}</> },
    { id: 'templates',  label: <>{t('whatsapp.templates')}{tabBadge(templates.length, 'templates')}</> },
  ]
  const connectionOptions = connections.map(c => ({ value: c.id, label: c.label?.trim() || c.waba_id }))

  return (
    <div style={{ maxWidth: 800 }}>

      <div style={{ marginBottom: 20 }}>
        <SubTabBar tabs={TABS} active={tab} onChange={id => setTab(id as 'connection' | 'numbers' | 'templates')} />
      </div>

      {/* ── Connection: the token list (create/edit/scope/default) ── */}
      {tab === 'connection' && (
        <>
          {/* Coexistence koppel-wizard (K-160) — the guided path; the manual
              token list below stays the second path, never replaced. */}
          <EmbeddedSignupCard onLinked={conn.reload} canManage={canManage} />
          <WhatsAppConnectionsList {...conn} canManage={canManage} />
        </>
      )}

      {/* ── Phone numbers ── */}
      {tab === 'numbers' && (
      <div>
        {syncMsg && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: 12,
                        background: syncMsg.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                        color: syncMsg.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {syncMsg.text}
          </div>
        )}
        {connectionOptions.length > 1 && (
          <div style={{ marginBottom: 12, maxWidth: 260 }}>
            {/* §6 (Opus F5): the picker's accessible name must survive a picked
                value — Field wires label → trigger via id/aria-labelledby. */}
            <Field label={t('whatsapp.selectConnection')}>
              <SelectField value={selectedConnId ?? ''} onChange={setSelectedConnId} options={connectionOptions}
                placeholder={t('whatsapp.selectConnection')} />
            </Field>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 }}>
          {selectedConnId && canManage && (
            <Button variant="secondary" size="sm" onClick={syncNumbers} disabled={syncing === 'numbers'}>
              <RefreshCw size={11} style={{ animation: syncing === 'numbers' ? 'spin 1s linear infinite' : 'none' }} />
              {t('whatsapp.sync')}
            </Button>
          )}
        </div>
        {!selectedConnId ? (
          <div style={{ padding: '16px 18px', background: 'var(--hover-bg)', border: '1px solid var(--border)',
                        borderRadius: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            {t('whatsapp.noConnections')}
          </div>
        ) : phones.length === 0 ? (
          <div style={{ padding: '16px 18px', background: 'var(--hover-bg)', border: '1px solid var(--border)',
                        borderRadius: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            {t('whatsapp.noNumbers')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {phones.map((p, i) => {
              const q = QUALITY_META[p.quality_rating ?? ''] ?? QUALITY_META.GREEN
              return (
                <div key={p.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 14,
                                               padding: '14px 18px', background: 'var(--surface)',
                                               border: '1px solid var(--border)', borderRadius: 12 }}>
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
                  {/* F2: a WABA switch deactivates every linked number server-side
                      (WA-WABA-EDIT-1) — the row must say so, not just a one-time toast. */}
                  {p.active === false && (
                    <SoftChip label={t('whatsapp.numberInactive')} color="var(--color-danger)" />
                  )}
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
        {syncMsg && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: 12,
                        background: syncMsg.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                        color: syncMsg.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {syncMsg.text}
          </div>
        )}
        {connectionOptions.length > 1 && (
          <div style={{ marginBottom: 12, maxWidth: 260 }}>
            {/* §6 (Opus F5): the picker's accessible name must survive a picked
                value — Field wires label → trigger via id/aria-labelledby. */}
            <Field label={t('whatsapp.selectConnection')}>
              <SelectField value={selectedConnId ?? ''} onChange={setSelectedConnId} options={connectionOptions}
                placeholder={t('whatsapp.selectConnection')} />
            </Field>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {selectedConnId && canManage && (
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

        {!selectedConnId ? (
          <div style={{ padding: '16px 18px', background: 'var(--hover-bg)', border: '1px solid var(--border)',
                        borderRadius: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            {t('whatsapp.noConnections')}
          </div>
        ) : templates.length === 0 ? (
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
                    // GroupLabel = the house 11/600 uppercase-tracked identity; layout (padding/border) rides its style prop.
                    <GroupLabel key={h} as="th" style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      {h}
                    </GroupLabel>
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
                  const s = TEMPLATE_STATUS_META[tpl.status ?? ''] ?? TEMPLATE_STATUS_META.PENDING
                  const bodyText = Array.isArray(tpl.components)
                    ? tpl.components.find(c => c.type === 'BODY')?.text
                    : null
                  const catKey = tpl.category ? t(`whatsapp.cat${tpl.category}`, { defaultValue: tpl.category }) : '—'
                  const statusLabel = t(`whatsapp.status${tpl.status ?? ''}`, { defaultValue: tpl.status ?? '' })
                  return (
                    <tr key={tpl.id ?? i}
                      style={{ borderBottom: '1px solid var(--hover-bg)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '11px 14px' }}>
                        {/* BodyText carries the size/colour identity; the template name itself is an
                            identifier, so it renders through Mono rather than a hand-picked font-family. */}
                        <BodyText as="div" style={{ fontWeight: 500 }}><Mono>{tpl.name}</Mono></BodyText>
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

/**
 * OutreachCreate — "new call list" MODAL on the shared wide-form frame (Danny
 * 27-07: "+ Bellijst is geen popup???" / "elk scherm zoals + locatie moet net
 * zo breed en hoog worden als + match of + nieuwe kandidaat. Zoekbare
 * dropdowns en kaders om elk blokje"). Used to be an inline view that swapped
 * out the whole list (like the API-key/webhook create screens); now an
 * overlay + centred WIDE_MODAL panel like every other create flow, and the
 * list stays mounted behind it. Name + channel group into an "Algemeen" card,
 * the optional source pool into its own "Bron" card — both titled, bordered
 * cards mirroring the MatchModal/AddCandidateModal idiom instead of
 * three lonely full-width inputs. Channel and pool are searchable
 * CreatableSelect pickers (allowCreate=false — channel is a fixed backend
 * enum, pool is a real relational id) instead of a plain <select>. Behaviour
 * is unchanged: same POST payload, same onCreated callback, same pool-seeding.
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api from '@/lib/api'
import { createCampaign } from './data/outreachApi'
import type { Campaign } from './hooks/useOutreachCampaigns'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { cardHead, cardBox, row2, cardPair } from '@/components/ui/modalCards'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'

// Fixed backend enum (not a tenant lookup) — labels via i18n, values stay literal.
const CHANNELS = ['call', 'email', 'whatsapp'] as const

interface Pool { id: string; name: string; color?: string }
interface Props { onClose: () => void; onCreated: (c: Campaign) => void }

// Shared "wide form" frame (Danny 27-07): identical overlay/panel footprint to
// MatchModal/AddCandidateModal — WIDE_MODAL caps width/height so the
// call-list modal reads as the same kind of screen as +Match / +Kandidaat.
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 60 } as const
const panelStyle = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, width: '94vw', maxWidth: WIDE_MODAL.maxWidth, maxHeight: WIDE_MODAL.maxHeight, overflowY: 'auto', background: 'var(--surface)', borderRadius: 12, padding: 22, boxShadow: '0 24px 70px rgba(0,0,0,0.22)' } as const
const lbl = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 5 }
// Canon field style (G33/fieldMetrics) — was its own height-36 copy.
const inputStyle = fieldInputStyle

export default function OutreachCreate({ onClose, onCreated }: Props) {
  const { t } = useTranslation('outreach')
  const [name, setName]     = useState('')
  const [channel, setChannel] = useState<string>('call')
  const [poolId, setPoolId] = useState('')
  const [pools, setPools]   = useState<Pool[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(false)
  const firstField          = useRef<HTMLInputElement>(null)
  // Accessible dialog behaviour (§6): traps Tab, Escape closes, focus restores.
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)

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
      // DD-FE-3: createCampaign now unwraps to the record (was the raw envelope);
      // `unwrap` returns `unknown` by design (mirrors OutreachPage's own
      // `restored as Campaign` after restoreCampaign — same api.ts convention).
      const created = await createCampaign({ name: name.trim(), channel, ...(poolId ? { from_pool_id: poolId } : {}) })
      onCreated(created as Campaign)
      onClose()
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  const title = t('create.title')
  // "No pool" is a real, selectable option (mirrors the old <option value="">)
  // so the picker can be cleared back to it, not just defaulted once.
  const poolOptions = [{ value: '', label: t('create.poolNone') }, ...pools.map((p) => ({ value: p.id, label: p.name }))]

  return (
    <>
      {/* Overlay dims the list behind the modal (Danny 27-07: this must be a
          real popup, not a full-page swap) — click-through closes it. */}
      <div style={overlayStyle} onClick={onClose} />
      <div ref={panelRef} style={panelStyle} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        {/* Title row + close X (mirrors every other wide-form modal's header). */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
          <Button variant="ghost" iconOnly size="sm" onClick={onClose} aria-label={t('common:close', { defaultValue: 'Close' })}>
            <X size={16} />
          </Button>
        </div>

        {/* Two titled cards side by side: Algemeen (naam + kanaal) and Bron
            (optionele pool) — the shared cardPair grid (§11), not a stack
            of lonely inputs. */}
        <div style={cardPair}>
          <div>
            <div style={cardHead}>{t('create.generalCard')}</div>
            <div style={cardBox}>
              <div style={row2}>
                <div>
                  <label style={lbl} htmlFor="oc-name">{t('create.name')}</label>
                  <input id="oc-name" ref={firstField} value={name} onChange={(e) => setName(e.target.value)}
                    placeholder={t('create.namePlaceholder')} style={inputStyle}
                    onKeyDown={(e) => e.key === 'Enter' && submit()} />
                </div>
                <div>
                  <div style={lbl}>{t('create.channel')}</div>
                  {/* Searchable picker (Danny 27-07) — same fixed enum values, only
                      the affordance changes from a bare <select>. */}
                  <CreatableSelect value={channel} onChange={setChannel} allowCreate={false}
                    options={CHANNELS.map((c) => ({ value: c, label: t(`channel.${c}`) }))} />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style={cardHead}>{t('create.sourceCard')}</div>
            <div style={cardBox}>
              <div>
                <div style={lbl}>{t('create.pool')}</div>
                <CreatableSelect value={poolId} onChange={setPoolId} allowCreate={false} options={poolOptions} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{t('create.poolHint')}</p>
            </div>
          </div>
        </div>

        {error && <div role="alert" style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 12 }}>{t('create.error')}</div>}

        {/* Footer — Annuleren + primary create, BTN_H everywhere (§4/§9). */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving || !canSubmit}>
            {saving ? t('create.saving') : t('create.submit')}
          </Button>
        </div>
      </div>
    </>
  )
}

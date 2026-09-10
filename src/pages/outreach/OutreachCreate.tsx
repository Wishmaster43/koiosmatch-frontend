/**
 * OutreachCreate — "new call list" MODAL on the shared wide-form frame (Danny
 * 27-07, translated: "+ Call list isn't a popup???" / "every screen like
 * + location must become just as wide and tall as + match or + new candidate.
 * Searchable dropdowns and frames around every block" — verbatim: "+ Bellijst
 * is geen popup???" / "elk scherm zoals + locatie moet net zo breed en hoog
 * worden als + match of + nieuwe kandidaat. Zoekbare dropdowns en kaders om
 * elk blokje"). Name + channel group into an "Algemeen" card, the optional
 * source pool into its own "Bron" card — both titled, bordered cards
 * mirroring the MatchModal/AddCandidateModal idiom instead of three lonely
 * full-width inputs. Channel and pool are searchable CreatableSelect pickers
 * (allowCreate=false — channel is a fixed backend enum, pool is a real
 * relational id) instead of a plain <select>. Behaviour is unchanged: same
 * POST payload, same onCreated callback, same pool-seeding.
 *
 * SPLITS-R2 (03-09): swapped the bespoke overlay/panel shell + local label-
 * above `lbl` constant for the shared draggable FloatingPanel (POPUP-SLEEP-1
 * — "alle popups sleepbaar") and the label-LEFT FieldRow canon (§3A field
 * layout), mirroring AddDepartmentModal's composition of the two. Same
 * focus-trap/backdrop/Esc semantics as before (FloatingPanel owns them now
 * instead of the local useFocusTrap call); the footer becomes the shared
 * ModalFooter.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { createCampaign } from './data/outreachApi'
import type { Campaign } from './hooks/useOutreachCampaigns'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { WIDE_MODAL_PANEL_SIZE } from '@/components/ui/wideModalPanelSize'
import { cardHead, cardBox, row2, cardPair } from '@/components/ui/modalCards'
import { FieldRow, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ModalFooter from '@/components/ui/ModalFooter'
import { Caption } from '@/components/ui/typography'

// Fixed backend enum (not a tenant lookup) — labels via i18n, values stay literal.
const CHANNELS = ['call', 'email', 'whatsapp'] as const

interface Pool { id: string; name: string; color?: string }
interface Props { onClose: () => void; onCreated: (c: Campaign) => void }

// New call-list modal on the shared wide-form frame, mirroring MatchModal/AddCandidateModal's card layout; behaviour is unchanged from the old inline view (see file header).
export default function OutreachCreate({ onClose, onCreated }: Props) {
  const { t } = useTranslation('outreach')
  const [name, setName]     = useState('')
  const [channel, setChannel] = useState<string>('call')
  const [poolId, setPoolId] = useState('')
  const [pools, setPools]   = useState<Pool[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(false)

  // Load talent pools for the optional source picker (shared /pools resource).
  useEffect(() => {
    api.get('/pools', { params: { active: 1 } }).then((r) => { const d = r.data; setPools(Array.isArray(d) ? d : (d?.data ?? [])) }).catch(() => {})
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
    <FloatingPanel open onClose={onClose} ariaLabel={title} title={title}
      persistKey="outreach-create" scrollBody={false}
      {...WIDE_MODAL_PANEL_SIZE}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Two titled cards side by side: Algemeen (name + channel) and Bron
            (optional pool) — the shared cardPair grid (§11), not a stack
            of lonely inputs. */}
        <div style={cardPair}>
          <div>
            <div style={cardHead}>{t('create.generalCard')}</div>
            <div style={cardBox}>
              <div style={row2}>
                <FieldRow label={t('create.name')} required>
                  {/* Enter-to-submit (restored SPLITS-R2 regression): the old bare input
                      had this before the FieldRow/TextField conversion. */}
                  <TextField value={name} onChange={setName} placeholder={t('create.namePlaceholder')}
                    onKeyDown={e => e.key === 'Enter' && submit()} />
                </FieldRow>
                <FieldRow label={t('create.channel')}>
                  {/* Searchable picker (Danny 27-07) — same fixed enum values, only
                      the affordance changes from a bare <select>. */}
                  <CreatableSelect value={channel} onChange={setChannel} allowCreate={false}
                    options={CHANNELS.map((c) => ({ value: c, label: t(`channel.${c}`) }))} />
                </FieldRow>
              </div>
            </div>
          </div>

          <div>
            <div style={cardHead}>{t('create.sourceCard')}</div>
            <div style={cardBox}>
              <FieldRow label={t('create.pool')}>
                <CreatableSelect value={poolId} onChange={setPoolId} allowCreate={false} options={poolOptions} />
              </FieldRow>
              {/* Caption atom (§4 typography) — was an inline 11px muted <p>. */}
              <Caption as="p" style={{ margin: 0 }}>{t('create.poolHint')}</Caption>
            </div>
          </div>
        </div>

        {error && <div role="alert" style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 12 }}>{t('create.error')}</div>}
      </div>

      <ModalFooter onCancel={onClose} cancelLabel={t('common:cancel', { defaultValue: 'Cancel' })}
        onSubmit={submit} submitLabel={saving ? t('create.saving') : t('create.submit')} disabled={saving || !canSubmit} />
    </FloatingPanel>
  )
}

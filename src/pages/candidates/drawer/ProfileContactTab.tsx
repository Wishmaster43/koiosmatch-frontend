import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Mail, Phone } from 'lucide-react'
import { waDigits } from '@/lib/waDigits'
import { LinkedinMark } from '@/components/drawer/contactLinks'
import { FieldRow, EditControls, GroupCard, GroupHeader, inputStyle } from './profileFieldShared'
import { useProfileRequiredKeys } from './useProfileRequiredKeys'
import type { Candidate } from '@/types/candidate'

// The fields this sub-tab owns — split out of the old combined ProfileTab
// (Danny 28-07: one pencil flipping ~15 fields was unmaintainable).
type ContactKey = 'email' | 'mobile' | 'phone' | 'linkedin'
type ContactForm = Record<ContactKey, string>

// Only email/phone are ever tenant-required among this tab's fields (mirrors
// the old PROFILE_REQ_MAP — mobile/linkedin are never required).
const REQ_MAP: Partial<Record<ContactKey, string>> = { email: 'email', phone: 'phone' }


/** Contact sub-tab — e-mail, mobiel, telefoon, LinkedIn. Own pencil, own
 *  draft/error state; cancelling here never discards an in-progress edit in
 *  the Personal or Address sub-tab (each has its own). */
export default function ProfileContactTab({ c, onSave, autoEditSignal }: {
  c: Candidate; onSave?: (v: Record<string, unknown>) => void; autoEditSignal?: number
}) {
  const { t } = useTranslation('candidates')
  const requiredKeys = useProfileRequiredKeys(c.phase)
  const isReq = (key: ContactKey) => { const bk = REQ_MAP[key]; return !!bk && requiredKeys.includes(bk) }

  const emptyForm = (): ContactForm => ({
    email: c.email ?? '', phone: c.phone ?? '', mobile: c.mobile ?? '', linkedin: c.linkedin ?? '',
  })
  const [editing, setEditing] = useState(false)
  // Open edit mode when the parent bumps the signal (e.g. right after Lead→Kandidaat convert).
  const [prevAutoEdit, setPrevAutoEdit] = useState(autoEditSignal ?? 0)
  if ((autoEditSignal ?? 0) !== prevAutoEdit) { setPrevAutoEdit(autoEditSignal ?? 0); setEditing(true) }
  const [form, setForm] = useState<ContactForm>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<ContactKey, boolean>>>({})
  const setF = (k: ContactKey, v: string) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: false })) }

  // Block save when a required field of THIS tab is empty; flag the offenders.
  const save = () => {
    const e: Partial<Record<ContactKey, boolean>> = {}
    ;(Object.keys(REQ_MAP) as ContactKey[]).forEach(k => { if (isReq(k) && !String(form[k] ?? '').trim()) e[k] = true })
    if (Object.keys(e).length) { setErrors(e); return }
    onSave?.(form); setEditing(false); setErrors({})
  }
  const cancel = () => { setForm(emptyForm()); setErrors({}); setEditing(false) }

  const renderInput = (key: ContactKey) => (
    <input value={form[key]} onChange={e => setF(key, e.target.value)} style={inputStyle}
      placeholder={key === 'linkedin' ? 'https://linkedin.com/in/...' : undefined} />
  )

  // Contact fields render as actionable links (mailto/tel/WhatsApp), not plain text.
  const renderValue = (key: ContactKey) => {
    const v = c[key]
    if (key === 'linkedin') {
      return v
        ? <a href={v.startsWith('http') ? v : `https://${v}`} target="_blank" rel="noopener noreferrer"
            // eslint-disable-next-line no-restricted-syntax -- LinkedIn's official brand blue, not a themeable UI colour
            style={{ fontSize: 12, color: '#0A66C2', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
            {v.replace(/^https?:\/\/(www\.)?/, '')}
          </a>
        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>
    }
    // Plain link-blue, NOT the tenant brand colour (Danny 2026-07-16, job 2): these
    // anchors used var(--color-primary), which turns e.g. orange for a tenant with a
    // custom brand colour (useTenantTheme). --color-info is a fixed semantic token
    // (never touched by tenant theming) — the ordinary "this is a hyperlink" blue.
    if (key === 'email' && v) return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <a href={`mailto:${v}`} style={{ fontSize: 12, color: 'var(--color-info)', textDecoration: 'none' }}>{v}</a>
        {/* Mail shortcut icon (Danny punt 49) — same affordance as WhatsApp/phone. */}
        <a href={`mailto:${v}`} title={t('profile.sendEmail')} aria-label={t('profile.sendEmail')}
          style={{ display: 'inline-flex', color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-info)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
          <Mail size={13} />
        </a>
      </span>
    )
    // Mobile → WhatsApp only (BE 2026-07-20 split): a mobile number is the one
    // that can hold a WhatsApp conversation — the value itself still dials via tel:.
    if (key === 'mobile' && v) return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <a href={`tel:${String(v).replace(/\s/g, '')}`} style={{ fontSize: 12, color: 'var(--color-info)', textDecoration: 'none' }}>{v}</a>
        {waDigits(v) && (
          <a href={`https://wa.me/${waDigits(v)}`} target="_blank" rel="noopener noreferrer"
            title={t('profile.whatsapp')} aria-label={t('profile.whatsapp')}
            style={{ display: 'inline-flex', color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-success)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
            <MessageCircle size={13} />
          </a>
        )}
      </span>
    )
    // Landline ("vast") → dial only (BE 2026-07-20 split): no WhatsApp icon here —
    // a landline can't receive WhatsApp, so the old tenant-configurable toggle
    // (Danny punt 49) is superseded by this fixed per-field mapping.
    if (key === 'phone' && v) return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <a href={`tel:${String(v).replace(/\s/g, '')}`} style={{ fontSize: 12, color: 'var(--color-info)', textDecoration: 'none' }}>{v}</a>
        <a href={`tel:${String(v).replace(/\s/g, '')}`}
          title={t('profile.callPhone')} aria-label={t('profile.callPhone')}
          style={{ display: 'inline-flex', color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-info)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
          <Phone size={13} />
        </a>
      </span>
    )
    return <span style={{ fontSize: 12, color: v ? 'var(--text)' : 'var(--text-muted)' }}>{v || '-'}</span>
  }

  const field = (key: ContactKey, label: string, icon?: ReactNode) => (
    <FieldRow key={key} label={label} labelIcon={icon} required={isReq(key)} errorText={errors[key] ? t('common:required') : undefined}>
      {editing ? renderInput(key) : renderValue(key)}
    </FieldRow>
  )

  return (
    <div>
      <GroupHeader title={t('profile.groupContact')}>
        <EditControls editing={editing} onSave={save} onCancel={cancel} onStart={() => setEditing(true)} />
      </GroupHeader>
      <GroupCard>
        {field('email', t('profile.email'))}
        {field('mobile', t('profile.mobile'))}
        {field('phone', t('profile.phone'))}
        {field('linkedin', t('profile.linkedin'), <LinkedinMark size={12} />)}
      </GroupCard>
    </div>
  )
}

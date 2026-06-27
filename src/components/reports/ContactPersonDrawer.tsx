/**
 * ContactPersonDrawer — slide-in panel with one contact person's details and
 * quick mail/call links. Opened from ContactPersonsTable.
 * InfoRow below = one labeled detail row (optionally a clickable mailto/tel link).
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Mail, Phone, Building2, MessageCircle, Briefcase, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReportContact } from '../../types/reports'

// One labeled row of contact info; renders a mailto/tel link when href is given.
function InfoRow({ icon: Icon, label, value, href }: { icon: LucideIcon; label: ReactNode; value?: ReactNode; href?: string | null }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid var(--hover-bg)' }}>
      <Icon size={13} color="var(--border)" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
      {href
        ? <a href={href} style={{ fontSize: 12, color: 'var(--color-secondary)', textDecoration: 'none', wordBreak: 'break-all' }}>{value}</a>
        : <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>}
    </div>
  )
}

export default function ContactPersonDrawer({ contact, onClose }: { contact: ReportContact; onClose: () => void }) {
  const { t } = useTranslation('reports')
  const fullName = [contact.firstname, contact.lastname].filter(Boolean).join(' ') || '—'
  const initials = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const isPlanning = Boolean(contact.scheduled_order_contact)

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-[var(--surface)]"
        style={{ width: 440, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 15, fontWeight: 700 }}>
                {initials || '?'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 2 }}>
                  {fullName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {contact.function_title && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{contact.function_title}</span>
                  )}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500,
                    background: isPlanning ? 'var(--color-success-bg)' : 'var(--hover-bg)',
                    color:      isPlanning ? 'var(--color-success)'  : 'var(--text-muted)',
                    border:     `1px solid ${isPlanning ? '#BBF7D0' : 'var(--border)'}`,
                  }}>
                    <MessageCircle size={10} />
                    {isPlanning ? t('contactDrawer.planningContact') : t('contactDrawer.noPlanningContact')}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                       borderRadius: 6, marginLeft: 10, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Customer banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                      background: '#F8F9FF', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <Building2 size={13} color="var(--text-muted)" />
          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
            {contact.customer_name ?? '—'}
          </span>
        </div>

        {/* Details */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '0.05em', marginBottom: 8 }}>
            {t('contactDrawer.contactInfo')}
          </div>

          <InfoRow icon={Mail}     label={t('dr.email')}                 value={contact.email}  href={contact.email ? `mailto:${contact.email}` : null} />
          <InfoRow icon={Phone}    label={t('dr.mobile')}                value={contact.mobile} href={contact.mobile ? `tel:${contact.mobile}` : null} />
          <InfoRow icon={Phone}    label={t('dr.phone')}                 value={contact.phone}  href={contact.phone  ? `tel:${contact.phone}`  : null} />
          <InfoRow icon={Briefcase} label={t('contactDrawer.function')}  value={contact.function_title} />
          <InfoRow icon={User}     label={t('contactDrawer.salutation')} value={contact.salutation} />
          <InfoRow icon={Building2} label={t('dr.customer')}             value={contact.customer_name} />

          {contact.remarks && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                            letterSpacing: '0.05em', marginBottom: 8 }}>
                {t('dr.remarks')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text)', background: 'var(--hover-bg)', borderRadius: 8,
                            padding: '10px 12px', lineHeight: 1.6 }}>
                {contact.remarks}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0,
                      display: 'flex', gap: 8 }}>
          {contact.email && (
            <a href={`mailto:${contact.email}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                       fontSize: 13, fontWeight: 500, borderRadius: 8, textDecoration: 'none',
                       border: '1px solid var(--border)', background: 'var(--hover-bg)', color: 'var(--text)' }}>
              <Mail size={13} /> {t('contactDrawer.sendEmail')}
            </a>
          )}
          {contact.mobile && (
            <a href={`tel:${contact.mobile}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                       fontSize: 13, fontWeight: 500, borderRadius: 8, textDecoration: 'none',
                       border: '1px solid var(--border)', background: 'var(--hover-bg)', color: 'var(--text)' }}>
              <Phone size={13} /> {t('contactDrawer.call')}
            </a>
          )}
        </div>
      </div>
    </>
  )
}

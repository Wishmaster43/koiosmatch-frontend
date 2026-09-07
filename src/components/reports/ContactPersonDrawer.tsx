import type { ReactNode } from 'react'
import Avatar from '@/components/ui/Avatar'
import { useTranslation } from 'react-i18next'
import { Mail, Phone, Building2, MessageCircle, Briefcase, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReportContact } from '@/types/reports'
import Button from '@/components/ui/Button'
import { PageTitle, GroupLabel } from '@/components/ui/typography'
import ReportDrawerChrome from './ReportDrawerChrome'

// One labeled row of contact info; renders a mailto/tel link when href is given.
function InfoRow({ icon: Icon, label, value, href }: { icon: LucideIcon; label: ReactNode; value?: ReactNode; href?: string | null }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid var(--hover-bg)' }}>
      <Icon size={13} color="var(--border)" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
      {href
        ? <Button variant="ghost" href={href}
            style={{ fontSize: 12, color: 'var(--color-secondary)', whiteSpace: 'normal', wordBreak: 'break-all',
                     height: 'auto', padding: 0, justifyContent: 'flex-start', textAlign: 'left' }}>
            {value}
          </Button>
        : <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>}
    </div>
  )
}

/**
 * ContactPersonDrawer — slide-in panel with one contact person's details and
 * quick mail/call links. Opened from ContactPersonsTable.
 */
export default function ContactPersonDrawer({ contact, onClose }: { contact: ReportContact; onClose: () => void }) {
  const { t } = useTranslation('reports')
  const fullName = [contact.firstname, contact.lastname].filter(Boolean).join(' ') || '—'
  const initials = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const isPlanning = Boolean(contact.scheduled_order_contact)

  // Header meta: name, function, planning badge.
  const headerMeta = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar initials={initials || '?'} size={44} soft />
      <div>
        <PageTitle style={{ fontWeight: 700, marginBottom: 2 }}>{fullName}</PageTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {contact.function_title && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{contact.function_title}</span>
          )}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500,
            background: isPlanning ? 'var(--color-success-bg)' : 'var(--hover-bg)',
            color:      isPlanning ? 'var(--color-on-success-bg)' : 'var(--text-muted)',
            border:     `1px solid ${isPlanning ? 'var(--color-success)' : 'var(--border)'}`,
          }}>
            <MessageCircle size={10} />
            {isPlanning ? t('contactDrawer.planningContact') : t('contactDrawer.noPlanningContact')}
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <ReportDrawerChrome title={fullName} headerMeta={headerMeta} onClose={onClose}>
      {/* Customer banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 16px 0',
                    borderBottom: '1px solid var(--hover-bg)', marginBottom: 16 }}>
        <Building2 size={13} color="var(--text-muted)" />
        <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
          {contact.customer_name ?? '—'}
        </span>
      </div>

      {/* Contact info rows */}
      <div style={{ marginBottom: 16 }}>
        <GroupLabel as="div" style={{ marginBottom: 8 }}>{t('contactDrawer.contactInfo')}</GroupLabel>

        <InfoRow icon={Mail}     label={t('dr.email')}                 value={contact.email}  href={contact.email ? `mailto:${contact.email}` : null} />
        <InfoRow icon={Phone}    label={t('dr.mobile')}                value={contact.mobile} href={contact.mobile ? `tel:${contact.mobile}` : null} />
        <InfoRow icon={Phone}    label={t('dr.phone')}                 value={contact.phone}  href={contact.phone  ? `tel:${contact.phone}`  : null} />
        <InfoRow icon={Briefcase} label={t('contactDrawer.function')}  value={contact.function_title} />
        <InfoRow icon={User}     label={t('contactDrawer.salutation')} value={contact.salutation} />
        <InfoRow icon={Building2} label={t('dr.customer')}             value={contact.customer_name} />
      </div>

      {/* Remarks section */}
      {contact.remarks && (
        <div style={{ marginBottom: 16 }}>
          <GroupLabel as="div" style={{ marginBottom: 8 }}>{t('dr.remarks')}</GroupLabel>
          <div style={{ fontSize: 12, color: 'var(--text)', background: 'var(--hover-bg)', borderRadius: 8,
                        padding: '10px 12px', lineHeight: 1.6 }}>
            {contact.remarks}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--hover-bg)' }}>
        {contact.email && (
          <Button variant="secondary" href={`mailto:${contact.email}`}>
            <Mail size={13} /> {t('contactDrawer.sendEmail')}
          </Button>
        )}
        {contact.mobile && (
          <Button variant="secondary" href={`tel:${contact.mobile}`}>
            <Phone size={13} /> {t('contactDrawer.call')}
          </Button>
        )}
      </div>
    </ReportDrawerChrome>
  )
}

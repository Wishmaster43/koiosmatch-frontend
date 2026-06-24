/**
 * ContactDrawer — slide-in detail panel for one contact: hero (name + function
 * + planning badge), contact details (email/phone), and the linked customer and
 * work-location cards. Pure presentation; the contact is passed in from ContactsPage.
 */
import { useTranslation } from 'react-i18next'
import { Mail, Phone, MessageCircle, MapPin, X, ChevronRight } from 'lucide-react'
import { ac, ContactAvatar } from './contactParts'

export default function ContactDrawer({ contact, onClose }) {
  const { t } = useTranslation('shiftmanager')
  if (!contact) return null
  const name = [contact.firstname, contact.lastname].filter(Boolean).join(' ')

  return (
    <div style={{ width: 380, flexShrink: 0, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', height: '100%' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('contactsPage.drawerTitle')}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* Hero */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
          <ContactAvatar name={name} size={52} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{contact.function_title}</div>
            {contact.planning && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, marginTop: 6,
                padding: '2px 8px', borderRadius: 999, background: 'var(--color-success-bg)', color: 'var(--color-success)',
                border: '1px solid #BBF7D0', fontWeight: 500 }}>
                <MessageCircle size={10} /> {t('contactsPage.planningContact')}
              </span>
            )}
          </div>
        </div>

        {/* Contact info */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{t('contactsPage.contactDetails')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--hover-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', flexShrink: 0 }}>
                <Mail size={13} color="var(--text-muted)" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('contactsPage.email')}</div>
                <a href={`mailto:${contact.email}`} style={{ fontSize: 13, color: 'var(--color-secondary)', textDecoration: 'none' }}>{contact.email}</a>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--hover-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', flexShrink: 0 }}>
                <Phone size={13} color="var(--text-muted)" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('contactsPage.phone')}</div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{contact.mobile}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Klant */}
        <div style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px',
          marginBottom: 12, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 10 }}>{t('contactsPage.customer')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: ac(contact.customer),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: 'var(--surface)', flexShrink: 0 }}>
              {contact.customer?.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{contact.customer}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('contactsPage.linkedCustomer')}</div>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" />
          </div>
        </div>

        {/* Locatie */}
        <div style={{ background: 'var(--hover-bg)', borderRadius: 10, padding: '14px 16px',
          border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 10 }}>{t('contactsPage.location')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--color-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin size={14} color="var(--color-primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{contact.location}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('contactsPage.workLocation')}</div>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" />
          </div>
        </div>
      </div>
    </div>
  )
}

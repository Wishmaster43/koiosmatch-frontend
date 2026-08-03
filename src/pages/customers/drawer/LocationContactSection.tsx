import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import SectionCard from '@/components/ui/SectionCard'
import ContactNameLink from './ContactNameLink'
import { emailValue, phoneValue } from '@/components/drawer/contactLinks'
import type { Contact } from '@/types/customer'
import type { Id } from '@/types/common'

interface Props {
  /** The site's coupled primary contact (customer_contact_customer_location.is_primary) — the truth. */
  primaryContact: Contact | null
  /** Legacy free text on the location's own columns (contact_name/email/phone). */
  legacyName: string
  legacyEmail: string
  legacyPhone: string
  onOpenContact: (id: Id) => void
  onPickContact: () => void
}

// One label-left/value-right row — mirrors the field-table convention this block replaces.
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
    <span style={{ width: 140, flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
    <div style={{ minWidth: 0, flex: 1 }}>{children}</div>
  </div>
)

// The one CTA every state below can offer: go set/change the real coupling on Contactpersonen.
const PickButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type="button" onClick={onClick}
    style={{ padding: 0, background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 12, color: 'var(--color-info)', cursor: 'pointer' }}>
    {label}
  </button>
)

/**
 * LocationContactSection — CONTACT-LOCATION-PRIMARY-1, second round (Danny 02-08): "Contact
 * ter plaatse" and "Primaire contactpersoon" used to be two SEPARATE blocks that could disagree
 * — free text on the location's own columns vs. the real contact↔location coupling. Danny:
 * "contact ter plaatse is aangegeven als primaire contactpersoon van deze vestiging!!" — one
 * person, told two contradicting ways on the same screen.
 *
 * ONE block now, and the coupling is the only thing it renders as a live record: a COUPLED
 * contact (customer_contact_customer_location.is_primary, resolved via isPrimaryForLocation)
 * shows as a real clickable link — name, role, email and phone all read from THAT contact,
 * exactly like the Contactpersonen tab. Legacy free text on the location's own contact_name/
 * email/phone columns (still written by the create flow — AAT-1, another lane) is never
 * silently hidden — §3, no dropped data — so it stays visible as a plain, UNLINKED fallback
 * until someone couples a real contact. It is deliberately no longer EDITABLE here: editing
 * free text on the location is exactly the affordance that let the two blocks drift apart in
 * the first place, so the only way forward is coupling a real record via the Contactpersonen
 * sub-tab (the star/"maak primair" action already there).
 */
export default function LocationContactSection({
  primaryContact, legacyName, legacyEmail, legacyPhone, onOpenContact, onPickContact,
}: Props) {
  const { t } = useTranslation('customers')
  const typedName = legacyName.trim()
  // A coupled contact is the truth; legacy free text is only a fallback until one exists.
  const hasLegacy = Boolean(typedName || legacyEmail.trim() || legacyPhone.trim())
  const pickLabel = t('locations.detail.pickPrimaryContact')

  return (
    <SectionCard title={t('locations.detail.contactTitle')}>
      {primaryContact ? (
        // The real coupling — full identity, rendered as a link (mirrors Contactpersonen).
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Row label={t('locations.detail.contactName')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <ContactNameLink name={primaryContact.name} id={primaryContact.id} onOpen={onOpenContact} title={t('contacts.openContact')} />
              {primaryContact.role && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{primaryContact.role}</span>}
            </span>
          </Row>
          <Row label={t('locations.detail.email')}>{emailValue(primaryContact.email, t('overview.sendEmail'))}</Row>
          <Row label={t('locations.detail.phone')}>{phoneValue(primaryContact.phone || primaryContact.mobile, t('overview.callPhone'))}</Row>
          <div style={{ marginTop: 4 }}><PickButton label={pickLabel} onClick={onPickContact} /></div>
        </div>
      ) : hasLegacy ? (
        // No coupling yet, but the location still carries typed contact text — show it
        // honestly (not as a link: there is no record behind it) and offer the real fix.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Row label={t('locations.detail.contactName')}>
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{typedName || '-'}</span>
          </Row>
          <Row label={t('locations.detail.email')}>{emailValue(legacyEmail, t('overview.sendEmail'))}</Row>
          <Row label={t('locations.detail.phone')}>{phoneValue(legacyPhone, t('overview.callPhone'))}</Row>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--color-warning)' }}>{t('locations.detail.contactNotLinked')}</span>
            <PickButton label={pickLabel} onClick={onPickContact} />
          </div>
        </div>
      ) : (
        // Honestly empty — no typed text, no coupling.
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>{t('locations.detail.noPrimaryContact')}</span>
          <PickButton label={pickLabel} onClick={onPickContact} />
        </div>
      )}
    </SectionCard>
  )
}

// LocationContactSection — the location's ONE on-site-contact block: a coupled
// contact record when one exists, else the legacy free-text fallback. See the
// fuller doc comment on the component below for why the two used to disagree.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import Spinner from '@/components/ui/Spinner'
import ContactNameLink from './ContactNameLink'
import { emailValue, phoneValue, linkedinValue, LinkedinMark } from '@/components/drawer/contactLinks'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import { notifyError, notifySuccess } from '@/lib/notify'
import { setLocationPrimaryContact, splitContactName } from '../hooks/useCustomerContacts'
import type { ContactPayload } from '../hooks/useCustomerContacts'
import type { Contact } from '@/types/customer'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'

interface Props {
  /** The site's coupled primary contact (customer_contact_customer_location.is_primary) — the truth. */
  primaryContact: Contact | null
  /** Legacy free text on the location's own columns (contact_name/email/phone). */
  legacyName: string
  legacyEmail: string
  legacyPhone: string
  onOpenContact: (id: Id) => void
  onPickContact: () => void
  // ONE-CLICK-COUPLE-1 (Danny: seeing the typed text forever read as "still broken"
  // when it already names a real contact) — the customer's full contact list plus
  // the ids needed to write the coupling through the exact route the star action
  // in ContactsPanel already uses.
  contacts: Contact[]
  customerId?: Id
  locationId: Id
  // ONE-CLICK-COUPLE-2 (Danny, third escalation): the real `useCustomerContacts().add`,
  // threaded down from CustomerDrawer via LocationsTab → LocationDetail (mirrors the
  // identical AddLocationModal threading) — needed to create a real contact record for
  // the no-match dead end below, before coupling it the same way `coupleMatch` does.
  onAddContact?: (payload: ContactPayload) => Promise<Contact | void> | void
}

// One label-left/value-right row — the candidate canon anatomy (fieldRowCanon):
// 11px/120px label with the flex/gap-5 seat for an optional brand mark, 26px row.
const Row = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
    <span style={{ ...CANON_LABEL_STYLE, display: 'flex', alignItems: 'center', gap: 5 }}>{label}</span>
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

// ONE-CLICK-COUPLE-1: the one-click alternative to PickButton, offered only when a
// strict single email match was found — a solid primary button (not a plain link)
// because it performs the write directly, mirroring ContactsPanel's own "make
// primary" star action (Star icon, Spinner while the PUT is in flight).
const LinkMatchButton = ({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) => (
  <Button variant="primary" size="sm" onClick={onClick} disabled={busy}>
    {busy ? <Spinner size={12} /> : <Star size={12} />}
    {label}
  </Button>
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
 * sub-tab (the star/"maak primair" action already there) — UNLESS the typed text already
 * names exactly one of the customer's own contacts (ONE-CLICK-COUPLE-1 below), in which case
 * that manual search is a puzzle we created ourselves and a one-click button replaces it.
 */
export default function LocationContactSection({
  primaryContact, legacyName, legacyEmail, legacyPhone, onOpenContact, onPickContact,
  contacts, customerId, locationId, onAddContact,
}: Props) {
  const { t } = useTranslation('customers')
  const typedName = legacyName.trim()
  // A coupled contact is the truth; legacy free text is only a fallback until one exists.
  const hasLegacy = Boolean(typedName || legacyEmail.trim() || legacyPhone.trim())
  const pickLabel = t('locations.detail.pickPrimaryContact')

  // ONE-CLICK-COUPLE-1: email is the PRIMARY match key — it uniquely identifies a
  // person. When the email yields nothing (seeded locations carry a location-mailbox
  // like locatie2@…, not the person's own address — Danny 03-08 kept hitting this),
  // a unique EXACT full-name hit is offered as a fallback. That is still never an
  // auto-couple: the user confirms by clicking a button carrying the person's name,
  // and two same-named contacts (the classic collision) mean no button at all —
  // anything short of exactly one hit falls back to the manual pick flow untouched.
  const typedEmail = legacyEmail.trim().toLowerCase()
  const emailMatches = typedEmail ? contacts.filter(c => (c.email ?? '').trim().toLowerCase() === typedEmail) : []
  const nameLower = typedName.toLowerCase()
  const nameMatches = emailMatches.length === 0 && nameLower
    ? contacts.filter(c => (c.name ?? '').trim().toLowerCase() === nameLower) : []
  const candidates = emailMatches.length > 0 ? emailMatches : nameMatches
  const uniqueMatch = candidates.length === 1 ? candidates[0] : null
  // Without a customer id there is no route to PUT to (mirrors PdokCard/ContactsPanel's
  // own `blocked` guard) — the section then falls back to the honest generic CTA instead
  // of offering a button that would 404 on /customers/undefined/….
  const canCouple = uniqueMatch != null && customerId != null

  // ONE-CLICK-COUPLE-2 (Danny, third escalation: "Waarom staat dit er nog steeds!!") —
  // closes the case `canCouple` above leaves dead: typed text that names NOBODY in this
  // customer's contact list (a location mailbox email + a pool-generated name is the
  // common seeded shape). Offered only when there is an actual name to split into a
  // contact AND a route to create/couple it through — same shape of guard as `canCouple`.
  const canCreateAndLink = !canCouple && customerId != null && typedName.length > 0 && typeof onAddContact === 'function'

  // In-flight guard so a double click cannot fire the PUT twice; calls the exact same
  // route ContactsPanel's star action does, so the owning hook's CONTACTS_CHANGED_EVENT
  // listener refetches the customer's contacts and this section re-renders into its
  // coupled state on its own — no manual reload needed.
  const [coupling, setCoupling] = useState(false)
  const coupleMatch = async () => {
    if (!uniqueMatch || uniqueMatch.id == null || customerId == null || coupling) return
    setCoupling(true)
    try {
      const applied = await setLocationPrimaryContact(customerId, uniqueMatch.id, locationId)
      // A 200 that did not move the flag (the pivot column missing on this tenant
      // database) is still a failure for the user — say so instead of a silent no-op.
      if (applied) notifySuccess(t('locations.detail.setPrimaryContactDone', { name: uniqueMatch.name }))
      else notifyError(t('locations.detail.setPrimaryContactUnavailable'))
    } catch {
      notifyError(t('locations.detail.setPrimaryContactFailed'))
    } finally {
      setCoupling(false)
    }
  }

  // ONE-CLICK-COUPLE-2: the no-match dead end, closed in two sequenced steps — never
  // bundled into one call, because each half has its own honest failure. STEP 1 creates
  // the real contact from the typed text (same `useCustomerContacts().add` route
  // AddLocationModal's own create-then-couple chain uses, §11 — reused, not reinvented);
  // a create failure (e.g. a genuinely one-word name 422ing, see splitContactName) loses
  // nothing — no location touched, no coupling attempted — and reports once. Only once
  // step 1 actually resolves with a real id does STEP 2 run: couple that new contact as
  // this location's primary via the exact same route `coupleMatch` above uses. A step-2
  // failure leaves the just-created contact record intact (never rolled back) and the
  // block stays on this same fallback render — the `canCouple` branch above will then
  // find that new contact on the very next render (its email now matches it uniquely),
  // so recovering needs nothing more than the unique-match button that already exists.
  const [creating, setCreating] = useState(false)
  const createAndLink = async () => {
    if (!customerId || !onAddContact || creating || coupling) return
    setCreating(true)
    let newContact: Contact | void
    try {
      newContact = await onAddContact({
        ...splitContactName(typedName), middleName: '', email: legacyEmail.trim(), phone: legacyPhone.trim(), mobile: '',
        // CONTACT-LINKEDIN-1: no LinkedIn field on this quick-create path.
        linkedin: '',
        gender: '', role: '', locationId: null, departmentId: null, locationIds: [], departmentIds: [],
        statusId: null, isPrimary: false, customFields: {},
      })
    } catch {
      notifyError(t('locations.detail.createContactFailed'))
      setCreating(false)
      return
    }
    if (newContact?.id) {
      try {
        const applied = await setLocationPrimaryContact(customerId, newContact.id, locationId)
        if (applied) notifySuccess(t('locations.detail.setPrimaryContactDone', { name: newContact.name }))
        else notifyError(t('locations.detail.setPrimaryContactUnavailable'))
      } catch {
        notifyError(t('locations.detail.setPrimaryContactFailed'))
      }
    }
    setCreating(false)
  }

  return (
    <SectionCard title={t('locations.detail.contactTitle')}>
      {primaryContact ? (
        // The real coupling — full identity, rendered as a link (mirrors Contactpersonen).
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Row label={t('locations.detail.contactName')}>
            <ContactNameLink name={primaryContact.name} id={primaryContact.id} onOpen={onOpenContact} title={t('contacts.openContact')} />
          </Row>
          {/* Function on its own labelled row (Danny 03-08), mirroring the field-table
              rows around it — never a floating annex beside the name. */}
          {primaryContact.role && <Row label={t('contacts.detail.role')}><span style={{ fontSize: 12, color: 'var(--text)' }}>{primaryContact.role}</span></Row>}
          <Row label={t('locations.detail.email')}>{emailValue(primaryContact.email, t('overview.sendEmail'))}</Row>
          <Row label={t('locations.detail.phone')}>{phoneValue(primaryContact.phone || primaryContact.mobile, t('overview.callPhone'))}</Row>
          {/* CONTACT-LINKEDIN-1 (Danny 05-08: "gewoon in het blok van de contactpersoon"):
              the coupled contact's LinkedIn, only when set — no empty-dash row here. */}
          {primaryContact.linkedin && (
            <Row label={<><LinkedinMark size={12} />{t('contacts.detail.linkedin')}</>}>
              {linkedinValue(primaryContact.linkedin, t('contacts.detail.openLinkedin'))}
            </Row>
          )}
          {/* Coupled = the action reads as CHANGE; "kies een…" here implied nothing was
              coupled yet and read as still-broken (Danny 03-08). */}
          <div style={{ marginTop: 4 }}><PickButton label={t('locations.detail.changePrimaryContact')} onClick={onPickContact} /></div>
        </div>
      ) : hasLegacy ? (
        // No coupling yet, but the location still carries typed contact text — show it
        // honestly (not as a link: there is no record behind it) and offer the real fix.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Row label={t('locations.detail.contactName')}>
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{typedName || '-'}</span>
          </Row>
          <Row label={t('locations.detail.email')}>{emailValue(legacyEmail, t('overview.sendEmail'))}</Row>
          <Row label={t('locations.detail.phone')}>{phoneValue(legacyPhone, t('overview.callPhone'))}</Row>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            {/* One message, not two (Danny 03-08 "waarom zie ik dit?"): when the system is
                sure enough to offer a NAMED one-click couple, the warning text is noise —
                the button IS the message. ONE-CLICK-COUPLE-2 extends the same rule to the
                no-match case: "create contact and link" is now the PROMOTED primary
                action there, with the manual pick kept only as the secondary way to link
                a DIFFERENT existing person — so the warning also hides whenever that
                create-and-couple action is on offer. It survives only for the genuinely
                ambiguous case (no name typed, or the customer id / add-route is missing)
                where a manual pick is the sole way forward. */}
            {canCouple && uniqueMatch
              ? <LinkMatchButton label={t('locations.detail.linkNamed', { name: uniqueMatch.name })} onClick={() => void coupleMatch()} busy={coupling} />
              : canCreateAndLink
                ? <>
                    <LinkMatchButton label={t('locations.detail.createAndLink')} onClick={() => void createAndLink()} busy={creating} />
                    <PickButton label={pickLabel} onClick={onPickContact} />
                  </>
                : <>
                    <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--color-warning)' }}>{t('locations.detail.contactNotLinked')}</span>
                    <PickButton label={pickLabel} onClick={onPickContact} />
                  </>}
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

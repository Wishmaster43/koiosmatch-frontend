/**
 * ContactDetailsCard — the "Contact" card of AddContactPersonModal: e-mail/
 * telefoon/mobiel (Danny 27-07: exact card the request named). Extracted
 * (§0.3 — the ~400-line split trigger, 2026-08-03); pure presentational — the
 * duplicate/422 CHECK stays in the container (it needs the customer's other
 * contacts + the server response), this card only renders the already-computed
 * error flag and message string per field.
 */
import { FieldRow, TextField } from '@/components/forms/fields'
import { cardHead, cardBox, row3Even, row } from '@/components/ui/modalCards'
import FieldNotice from '@/components/ui/FieldNotice'

// Duplicate/server message line under email·phone·mobile — the client-side
// duplicate message wins over the server's own message when both exist (same
// collision). Rendered by the shared components/ui/FieldNotice; this card's
// rows sit flush, so its 3px top margin is zeroed out here (unchanged look).
const FieldError = ({ text }: { text?: string }) => <FieldNotice text={text} style={{ marginTop: 0 }} />

interface ContactDetailsCardProps {
  cardLabel: string
  emailLabel: string; phoneLabel: string; mobileLabel: string
  // VALIDATIE-LIVE-1-rest: blur marks email touched so its live format error
  // can render (mirrors candidates/addmodal/ContactCard's own onBlur wrapper).
  email: string; onEmailChange: (v: string) => void; onEmailBlur?: () => void; emailError?: boolean; emailMessage?: string
  phone: string; onPhoneChange: (v: string) => void; phoneError?: boolean; phoneMessage?: string
  mobile: string; onMobileChange: (v: string) => void; mobileError?: boolean; mobileMessage?: string
  // CONTACT-LINKEDIN-1 (Danny 05-08): the profile SLUG only — a pasted full URL is
  // stripped down to it at the save boundary (useCustomerContacts' toApi), so this
  // stays a plain, unopinionated text input.
  linkedinLabel: string; linkedinPlaceholder: string
  linkedin: string; onLinkedinChange: (v: string) => void
}

export default function ContactDetailsCard({
  cardLabel, emailLabel, phoneLabel, mobileLabel,
  email, onEmailChange, onEmailBlur, emailError, emailMessage,
  phone, onPhoneChange, phoneError, phoneMessage,
  mobile, onMobileChange, mobileError, mobileMessage,
  linkedinLabel, linkedinPlaceholder, linkedin, onLinkedinChange,
}: ContactDetailsCardProps) {
  return (
    <div>
      <div style={cardHead}>{cardLabel}</div>
      <div style={cardBox}>
        <div style={row3Even}>
          <div onBlur={onEmailBlur}>
            <FieldRow label={emailLabel}>
              <TextField type="email" value={email} onChange={onEmailChange} placeholder="naam@klant.nl" error={emailError} />
            </FieldRow>
            <FieldError text={emailMessage} />
          </div>
          <div>
            <FieldRow label={phoneLabel}>
              <TextField value={phone} onChange={onPhoneChange} error={phoneError} />
            </FieldRow>
            <FieldError text={phoneMessage} />
          </div>
          <div>
            <FieldRow label={mobileLabel}>
              <TextField value={mobile} onChange={onMobileChange} error={mobileError} />
            </FieldRow>
            <FieldError text={mobileMessage} />
          </div>
        </div>
        {/* LinkedIn gets its own row — a 4th field doesn't fit the row3Even grid above. */}
        <div style={row('1fr')}>
          <FieldRow label={linkedinLabel}>
            <TextField value={linkedin} onChange={onLinkedinChange} placeholder={linkedinPlaceholder} />
          </FieldRow>
        </div>
      </div>
    </div>
  )
}

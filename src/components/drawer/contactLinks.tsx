/**
 * contactLinks — how an e-mail address and a phone number are RENDERED in a drawer:
 * as real, actionable links with a shortcut icon, never as plain text.
 *
 * Promoted out of the candidate drawer (§3A/§11 — Danny 28-07: "e-mailadres van contact
 * weergeven zoals kandidaat drill down, zelfde geldt voor telefoon met icon blauw") so
 * the customer, and every entity after it, shows contact data the same way instead of
 * growing a second hand-rolled copy.
 *
 * Colour note: the link colour is `--color-info`, NOT `--color-primary`. Primary is the
 * tenant's brand colour (useTenantTheme), so a tenant with an orange brand would get
 * orange "links"; --color-info is the fixed semantic hyperlink blue.
 */
import type { ReactNode } from 'react'
import { MessageCircle, Mail, Phone, ExternalLink } from 'lucide-react'
import { waDigits } from '@/lib/waDigits'

const linkStyle = { fontSize: 12, color: 'var(--color-info)', textDecoration: 'none' } as const
const iconStyle = { display: 'inline-flex', color: 'var(--text-muted)' } as const

// Shared hover behaviour for the small shortcut icon next to a value.
const hover = (to: string) => ({
  onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.color = to },
  onMouseLeave: (e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.color = 'var(--text-muted)' },
})

// The empty state every drawer field uses.
const dash = () => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>

/** Mailto link + a mail shortcut icon. `sendLabel` is the already-translated tooltip. */
export function emailValue(v: unknown, sendLabel: string): ReactNode {
  const value = typeof v === 'string' ? v.trim() : ''
  if (!value) return dash()
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <a href={`mailto:${value}`} style={linkStyle}>{value}</a>
      <a href={`mailto:${value}`} title={sendLabel} aria-label={sendLabel} style={iconStyle} {...hover('var(--color-info)')}>
        <Mail size={13} />
      </a>
    </span>
  )
}

/**
 * Tel link + a shortcut icon. `whatsapp` adds the WhatsApp icon — only pass it for a
 * MOBILE number: a landline cannot hold a WhatsApp conversation, and offering the icon
 * there would be a control that goes nowhere (§3).
 */
export function phoneValue(v: unknown, callLabel: string, whatsapp?: { label: string }): ReactNode {
  const value = typeof v === 'string' ? v.trim() : ''
  if (!value) return dash()
  const digits = whatsapp ? waDigits(value) : ''
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <a href={`tel:${value.replace(/\s/g, '')}`} style={linkStyle}>{value}</a>
      {digits ? (
        <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer"
          title={whatsapp!.label} aria-label={whatsapp!.label} style={iconStyle} {...hover('var(--color-success)')}>
          <MessageCircle size={13} />
        </a>
      ) : (
        <a href={`tel:${value.replace(/\s/g, '')}`} title={callLabel} aria-label={callLabel} style={iconStyle} {...hover('var(--color-info)')}>
          <Phone size={13} />
        </a>
      )}
    </span>
  )
}

/**
 * Website link + an open-in-new-tab icon. External target, so `rel="noopener noreferrer"`
 * (§7) — without it the opened page can reach back through `window.opener`.
 * A bare "example.nl" (no scheme) still has to open as https, not as a relative path.
 */
export function websiteValue(v: unknown, openLabel: string): ReactNode {
  const value = typeof v === 'string' ? v.trim() : ''
  if (!value) return dash()
  const href = /^https?:\/\//i.test(value) ? value : `https://${value}`
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{value}</a>
      <a href={href} target="_blank" rel="noopener noreferrer" title={openLabel} aria-label={openLabel}
        style={iconStyle} {...hover('var(--color-info)')}>
        <ExternalLink size={13} />
      </a>
    </span>
  )
}

/**
 * A Chamber-of-Commerce number, linked through to the public KvK register (Danny 28-07:
 * "KVK moeten we ook gaan doorlinken"). Only digits are looked up — a free-text value
 * that is not a number is shown as-is rather than sent to a search that cannot resolve it.
 */
export function kvkValue(v: unknown, openLabel: string): ReactNode {
  const value = typeof v === 'string' ? v.trim() : ''
  if (!value) return dash()
  const digits = value.replace(/\D/g, '')
  if (!digits) return <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>
  const href = `https://www.kvk.nl/zoeken/?handelsnaam=${encodeURIComponent(digits)}`
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{value}</a>
      <a href={href} target="_blank" rel="noopener noreferrer" title={openLabel} aria-label={openLabel}
        style={iconStyle} {...hover('var(--color-info)')}>
        <ExternalLink size={13} />
      </a>
    </span>
  )
}

/**
 * A VAT number, linked to the EU VIES validation page (Danny 28-07). VIES is a
 * single-page app whose form state is NOT addressable through query parameters, so the
 * link opens the checker rather than pretending to pre-fill it — the number stays on
 * screen to paste. Building a URL with parameters VIES silently ignores would look like
 * it works and quietly does not (§3).
 */
export function vatValue(v: unknown, openLabel: string): ReactNode {
  const value = typeof v === 'string' ? v.trim() : ''
  if (!value) return dash()
  const href = 'https://ec.europa.eu/taxation_customs/vies/#/vat-validation'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{value}</a>
      <a href={href} target="_blank" rel="noopener noreferrer" title={openLabel} aria-label={openLabel}
        style={iconStyle} {...hover('var(--color-info)')}>
        <ExternalLink size={13} />
      </a>
    </span>
  )
}

// LinkedIn's official brand blue — not a themeable UI colour, so it is exempt from
// the token-only rule.
// eslint-disable-next-line no-restricted-syntax -- LinkedIn's official brand blue, not a themeable UI colour
const LINKEDIN_BLUE = '#0A66C2'

// lucide-react ships no brand/logo icons, so this is a minimal inline LinkedIn
// glyph. THE one shared copy (§11) — candidate + customer both import it.
export function LinkedinMark({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={LINKEDIN_BLUE} xmlns="http://www.w3.org/2000/svg">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

/**
 * CONTACT-LINKEDIN-1 (Danny 05-08): the backend stores only the profile SLUG
 * (`linkedin_slug`) — the link always builds https://www.linkedin.com/in/{slug},
 * so it never depends on a caller having stripped a pasted full URL first (see
 * toLinkedinSlug below, applied once at the save boundary instead).
 *
 * Empty state is the same `-` hyphen as every other contact field — the
 * candidate's own LinkedIn row is the canon (Danny 05-08: both dashes identical).
 */
export function linkedinValue(v: unknown, openLabel: string): ReactNode {
  const slug = typeof v === 'string' ? v.trim() : ''
  if (!slug) return dash()
  const href = `https://www.linkedin.com/in/${slug}`
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{slug}</a>
      <a href={href} target="_blank" rel="noopener noreferrer" title={openLabel} aria-label={openLabel}
        style={iconStyle} {...hover(LINKEDIN_BLUE)}>
        <LinkedinMark size={13} />
      </a>
    </span>
  )
}

/**
 * Strip a pasted LinkedIn URL down to the bare profile slug the backend column
 * expects — so pasting the full address (with/without scheme, www, a trailing
 * query string) still saves the clean slug rather than the whole URL. A value
 * that is already a bare slug passes through unchanged (only stray leading/
 * trailing slashes are trimmed). Applied once at the save boundary (toApi), not
 * per input keystroke, so the field stays a plain, unopinionated text input.
 */
export function toLinkedinSlug(input: string): string {
  const trimmed = (input ?? '').trim()
  if (!trimmed) return ''
  const match = trimmed.match(/^(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/in\/([^/?#]+)/i)
  if (match) return match[1]
  return trimmed.replace(/^\/+|\/+$/g, '')
}

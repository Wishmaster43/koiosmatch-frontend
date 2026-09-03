/** The retention-consent facts, straight from GET /{entity}/{id}. */
interface RetentionConsentBlockProps {
  /** The stored flag the checkbox reflects. */
  optIn: boolean
  /** ISO8601 — when the consent was granted. */
  consentAt: string | null
  /** When the DOSSIER is due to be anonymised (server-derived). */
  expiresAt: string | null
  /** Flip the opt-in; the parent maps it onto the consent patch. */
  onToggle: (next: boolean) => void
  /** i18n namespace for the block's keys (e.g. 'candidates', 'customers'). */
  namespace: string
  /** Permission key to gate visibility of the dossier deadline (e.g. 'candidates.delete', 'customers.update'). */
  viewPermission: string
  /** The language Koios will message this entity in (own preference or the agency default). */
  messagingLanguage?: string
}

/**
 * AVG retention block — consent opt-in + how long that consent still HOLDS.
 *
 * Danny 2026-08-02: a retention consent LAPSES (default 24 months, tenant setting
 * `retention_consent_months`; 0 = deliberately indefinite). The expiry is imperative —
 * the backend policy and the nightly command enforce it whether or not the "ask to
 * renew" workflow is switched on — so this block must never render a checked "may be
 * kept" box while the consent expired months ago. Every state says plainly where the
 * consent stands, and dates go through lib/formatters' DD-MM-YYYY formatter.
 *
 * This shared component renders in both candidates and customers (contacts) with the
 * same UI; the namespace and viewPermission props make it work across both domains.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, ShieldAlert, HelpCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Toggle from '@/components/ui/Toggle'
import { GroupLabel, Caption, BodyText } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { useAuth } from '@/context/AuthContext'
import { resolveRetentionConsent, useRetentionConsentMonths } from '@/pages/candidates/shared'
import { useMessagingLanguageOptions } from '@/lib/useMessagingLanguageOptions'

// See the file's top doc above; the retention opt-in toggle plus its consent/expiry facts, gated on the tenant validity-window lookup.
export default function RetentionConsentBlock({ optIn, consentAt, expiresAt, onToggle, namespace, viewPermission, messagingLanguage }: RetentionConsentBlockProps) {
  const { t } = useTranslation(namespace)
  // The language line shows a display name, never the bare code.
  const { labelFor: languageLabelFor } = useMessagingLanguageOptions()
  const { formatDate } = useDateFormat()
  const statusId = useId()
  // Tenant validity window — loading/error are surfaced, never guessed away.
  const { months, loading, error } = useRetentionConsentMonths()
  // The dossier deadline exposes the erasure timeline, so it stays gated like the rest
  // of the erasure-adjacent UI (mirrors CandidatesPage's archive/merge gate). The
  // consent's OWN validity is not gated: an unchecked-by-permission user must not be
  // the one person who still reads a lapsed consent as active.
  const canViewRetention = useAuth()?.hasPermission(viewPermission) ?? false

  const state = resolveRetentionConsent({ optIn, consentAt, months })

  // One line per consent state: icon + text (colour is never the only signal, §6).
  const status: { text: string; tone: string; Icon: LucideIcon | null } = (() => {
    if (state.kind === 'none') return { text: t('communication.retentionConsentNone'), tone: 'var(--text-muted)', Icon: null }
    if (loading) return { text: t('communication.retentionConsentLoading'), tone: 'var(--text-muted)', Icon: null }
    if (error || state.kind === 'unknownWindow') return { text: t('communication.retentionConsentWindowUnknown'), tone: 'var(--text-muted)', Icon: HelpCircle }
    if (state.kind === 'indefinite') return { text: t('communication.retentionConsentIndefinite'), tone: 'var(--color-info, var(--color-primary))', Icon: ShieldCheck }
    if (state.kind === 'undated') return { text: t('communication.retentionConsentUndated'), tone: 'var(--color-danger)', Icon: ShieldAlert }
    if (state.kind === 'lapsed') return { text: t('communication.retentionConsentLapsed', { date: formatDate(state.since) }), tone: 'var(--color-danger)', Icon: ShieldAlert }
    return { text: t('communication.retentionConsentValidUntil', { date: formatDate(state.until) }), tone: 'var(--color-success)', Icon: ShieldCheck }
  })()

  // Read-only dossier deadline (Block A) — soft-tint per state, role-gated.
  const dossier = (() => {
    const kind = expiresAt ? 'until' : optIn ? 'unlimited' : 'unknown'
    const tone = kind === 'until' ? 'var(--color-info, var(--color-primary))' : kind === 'unlimited' ? 'var(--color-success)' : 'var(--text-muted)'
    const label = kind === 'until'
      ? t('communication.retentionUntil', { date: formatDate(expiresAt) })
      : kind === 'unlimited'
        ? t('communication.retentionUnlimited', { date: formatDate(consentAt) })
        : t('communication.retentionUnknown')
    return { tone, label }
  })()

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      {/* HUISSTIJL-1: identical 11/600/uppercase render, letterSpacing kept at
          this block's own 0.04em (atom default is 0.05em) via the style override. */}
      <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 8 }}>
        {t('communication.retentionTitle')}
      </GroupLabel>

      {/* Opt-in toggle — described by the validity line below, so a screen reader
          hears "may be kept … consent lapsed on 12-05-2026" as one statement.
          House toggle (Danny live review, 04-08, translated: "Replace with
          toggles!!" — verbatim: "Vervangen door toggles!!" —
          a raw checkbox is never the house control, §0/§4); `describedBy` wires
          aria-describedby onto Toggle's own underlying switch button. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Toggle checked={optIn} onChange={onToggle} ariaLabel={t('communication.consentRetentionOptIn')} describedBy={statusId} />
        <span style={{ flex: 1 }}><BodyText as="span">{t('communication.consentRetentionOptIn')}</BodyText></span>
        {optIn && consentAt && (
          // HUISSTIJL-1: identical 11/400/var(--text-muted) render.
          <Caption>
            {t('communication.consentGivenAt', { date: formatDate(consentAt) })}
          </Caption>
        )}
      </div>

      {/* Validity of the consent itself — the line that stops a lapsed consent from
          reading as active. Soft-tinted per §4, never a solid fill. Dynamic status.tone
          color requires inline color-mix; the tint helpers cannot handle runtime-computed
          colors (mirrors candidate RetentionConsentBlock). */}
      <div id={statusId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8,
        fontSize: 12, fontWeight: 600, color: status.tone,
        background: `color-mix(in srgb, ${status.tone} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${status.tone} 35%, transparent)` }}>
        {status.Icon && <status.Icon size={14} aria-hidden="true" style={{ flexShrink: 0 }} />}
        <span>{status.text}</span>
      </div>

      {/* The story the backend actually implements: expiry is imperative, the workflow
          only asks for renewal — so consent never silently becomes eternal. */}
      {/* HUISSTIJL-1: identical 11/400/var(--text-muted) render as a div. */}
      <Caption as="div" style={{ marginTop: 6, lineHeight: 1.45 }}>
        {t('communication.retentionConsentExpiryNote')}
      </Caption>

      {canViewRetention && (
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: dossier.tone,
          background: `color-mix(in srgb, ${dossier.tone} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${dossier.tone} 35%, transparent)` }}>
          {dossier.label}
        </div>
      )}
      {/* AVG-RET-2-TAAL-1: which language the retention ask (and every message) goes out in. */}
      {messagingLanguage && (
        <Caption as="div" style={{ marginTop: 8 }}>{t('communication.messagingLanguage', { language: languageLabelFor(messagingLanguage) })}</Caption>
      )}
    </div>
  )
}

/**
 * backofficeLinkCards — the presentational bits behind BackofficeLinksTab: the
 * brand CardTitle, the shared "Koppelen" trigger + "Gekoppeld door …" line, and
 * the two per-system card bodies (HelloFlex/Shiftmanager). Split out of
 * BackofficeLinksTab.tsx (§3 size discipline — the orchestrating component plus
 * both card bodies inline would clear ~250 lines) — pure presentational props,
 * no API calls or state of its own; the state/handlers stay in the parent.
 */
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Link2 } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import Spinner from '@/components/ui/Spinner'
import SoftChip from '@/components/ui/SoftChip'
import { useDateFormat } from '@/lib/datetime'
import helloflexIcon from '@/assets/integrations/helloflex.png'
import shiftmanagerIcon from '@/assets/integrations/shiftmanager.png'
import type { BackofficeLink } from '@/lib/backofficeLink'

// Shared inline styles (§4 tokens only — no ad-hoc hex).
const mutedItalic: CSSProperties = { fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', margin: 0 }
const errorLine: CSSProperties = { fontSize: 11, color: 'var(--color-danger)', margin: 0 }
const monoText: CSSProperties = { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text)' }
// PRIMAIR-VLAK-1 (Danny 19-08 op deze knop: "die ook!!"): action buttons read
// the button trio — one token flip restyles them with every other accent action.
const actionBtn = (disabled: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px',
  fontSize: 11, fontWeight: 500, borderRadius: 7, border: '1px solid var(--button-border)',
  cursor: disabled ? 'not-allowed' : 'pointer', background: 'var(--button-fill)',
  color: 'var(--button-ink)', opacity: disabled ? 0.6 : 1, flexShrink: 0,
})

// Small brand icon, fixed at a 16px footprint in every card header (never
// hotlinked — local assets only, §7 CSP); alt text always comes through i18n.
export function CardTitle({ icon, alt, label }: { icon: string; alt: string; label: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <img src={icon} alt={alt} width={16} height={16} style={{ borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />
      {label}
    </span>
  )
}

// Shared "Koppelen" / "Opnieuw koppelen" trigger for both systems — one real POST
// per click (§3: no fake affordances), never fires on its own; a spinner replaces
// the icon while the request is in flight. Renders DISABLED (never hidden) when
// the caller's own permission check says the user may not link (canLink=false),
// so the control's existence still communicates the feature honestly (§3).
function LinkButton({ onClick, busy, retry, disabled }: { onClick: () => void; busy: boolean; retry?: boolean; disabled?: boolean }) {
  const { t } = useTranslation('common')
  const isDisabled = busy || !!disabled
  return (
    <button type="button" onClick={onClick} disabled={isDisabled} style={actionBtn(isDisabled)}>
      {busy ? <Spinner size={11} /> : <Link2 size={11} />}
      {busy ? t('backofficeLinks.common.linking') : t(retry ? 'backofficeLinks.common.retry' : 'backofficeLinks.common.linkButton')}
    </button>
  )
}

// "Gekoppeld door {naam} op {datum}" — shared by both linked backoffice cards.
// Renders nothing until the backend has resolved both who and when (H2 pattern).
function LinkedByLine({ link }: { link: BackofficeLink | null }) {
  const { t } = useTranslation('common')
  const { formatDate } = useDateFormat()
  if (!link?.linkedBy || !link.linkedAt) return null
  return (
    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
      {t('backofficeLinks.common.linkedByOn', { name: link.linkedBy.name ?? '—', date: formatDate(link.linkedAt) })}
    </span>
  )
}

interface CardProps { status: string | null; link: BackofficeLink | null; canLink: boolean; busy: boolean; onLink: () => void }

// HelloFlex card body — gated on module/app by the caller; links through the
// generic sync POST (real endpoint today, even though it commonly fails clean
// until Settings → Integraties holds HelloFlex credentials — that failure is a
// real, surfaced state, not a placeholder).
export function HelloflexCard({ status, link, canLink, busy, onLink }: CardProps) {
  const { t } = useTranslation('common')
  return (
    <SectionCard title={<CardTitle icon={helloflexIcon} alt={t('backofficeLinks.helloflex.alt')} label={t('backofficeLinks.helloflex.name')} />}>
      {status === 'linked' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <SoftChip label={t('backofficeLinks.common.statusLinked')} color="var(--color-success)" />
            {link?.externalId && <span style={monoText}>{link.externalId}</span>}
          </div>
          <LinkedByLine link={link} />
        </div>
      ) : status === 'pending' ? (
        <SoftChip label={t('backofficeLinks.common.statusPending')} color="var(--color-warning)" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {status === 'failed'
              ? <SoftChip label={t('backofficeLinks.common.statusFailed')} color="var(--color-danger)" />
              : <p style={mutedItalic}>{t('backofficeLinks.helloflex.notLinked')}</p>}
            <LinkButton onClick={onLink} busy={busy} retry={status === 'failed'} disabled={!canLink} />
          </div>
          {status === 'failed' && link?.lastError && <p style={errorLine}>{link.lastError}</p>}
        </div>
      )}
    </SectionCard>
  )
}

// canSyncNow: whether a manual-resync ROUTE exists for this entity at all (see
// BackofficeLinksTab) — false hides the trigger instead of offering a guaranteed 404.
interface ShiftmanagerCardProps extends CardProps { syncing: boolean; canSyncNow: boolean; onSyncNow: () => void }

// Shiftmanager card body — same generic link POST, plus its own "Nu
// synchroniseren" once actually linked (its own lightweight one-off endpoint).
export function ShiftmanagerCard({ status, link, canLink, busy, syncing, canSyncNow, onLink, onSyncNow }: ShiftmanagerCardProps) {
  const { t } = useTranslation('common')
  const { formatDateTime } = useDateFormat()
  const externalId = status === 'linked' ? link?.externalId ?? null : null
  return (
    <SectionCard title={<CardTitle icon={shiftmanagerIcon} alt={t('backofficeLinks.shiftmanager.alt')} label={t('backofficeLinks.shiftmanager.name')} />}>
      {status === 'linked' && externalId ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={monoText}>{t('backofficeLinks.shiftmanager.externalId')}: {externalId}</span>
            {canSyncNow && (
              <button type="button" onClick={onSyncNow} disabled={syncing} style={actionBtn(syncing)}>
                <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
                {syncing ? t('backofficeLinks.shiftmanager.syncing') : t('backofficeLinks.shiftmanager.syncNow')}
              </button>
            )}
          </div>
          <LinkedByLine link={link} />
          {link?.lastSyncedAt && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t('backofficeLinks.shiftmanager.lastSynced', { date: formatDateTime(link.lastSyncedAt) })}
            </span>
          )}
        </div>
      ) : status === 'pending' ? (
        <SoftChip label={t('backofficeLinks.common.statusPending')} color="var(--color-warning)" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {status === 'failed'
              ? <SoftChip label={t('backofficeLinks.common.statusFailed')} color="var(--color-danger)" />
              : <p style={mutedItalic}>{t('backofficeLinks.shiftmanager.notLinked')}</p>}
            <LinkButton onClick={onLink} busy={busy} retry={status === 'failed'} disabled={!canLink} />
          </div>
          {status === 'failed' && link?.lastError && <p style={errorLine}>{link.lastError}</p>}
        </div>
      )}
    </SectionCard>
  )
}

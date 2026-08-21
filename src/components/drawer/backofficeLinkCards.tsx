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
import Button from '@/components/ui/Button'
import { Caption, Mono } from '@/components/ui/typography'

// Shared inline styles (§4 tokens only — no ad-hoc hex).
const mutedItalic: CSSProperties = { fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', margin: 0 }
const errorLine: CSSProperties = { fontSize: 11, color: 'var(--color-danger-text)', margin: 0 }

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
    <Button variant="primary" size="sm" onClick={onClick} disabled={isDisabled} style={{ flexShrink: 0 }}>
      {busy ? <Spinner size={11} /> : <Link2 size={11} />}
      {busy ? t('backofficeLinks.common.linking') : t(retry ? 'backofficeLinks.common.retry' : 'backofficeLinks.common.linkButton')}
    </Button>
  )
}

// "Gekoppeld door {naam} op {datum}" — shared by both linked backoffice cards.
// Renders nothing until the backend has resolved both who and when (H2 pattern).
function LinkedByLine({ link }: { link: BackofficeLink | null }) {
  const { t } = useTranslation('common')
  const { formatDate } = useDateFormat()
  if (!link?.linkedBy || !link.linkedAt) return null
  return (
    <Caption as="span">
      {t('backofficeLinks.common.linkedByOn', { name: link.linkedBy.name ?? '—', date: formatDate(link.linkedAt) })}
    </Caption>
  )
}

interface CardProps { status: string | null; link: BackofficeLink | null; canLink: boolean; busy: boolean; onLink: () => void }

// HelloFlex card body — gated on module/app by the caller; links through the
// generic sync POST (real endpoint today, even though it commonly fails clean
// until Settings → Integraties holds HelloFlex credentials — that failure is a
// real, surfaced state, not a placeholder).
export function HelloflexCard({ status, link, canLink, busy, onLink }: CardProps) {
  const { t } = useTranslation('common')
  const { formatDateTime } = useDateFormat()
  return (
    <SectionCard title={<CardTitle icon={helloflexIcon} alt={t('backofficeLinks.helloflex.alt')} label={t('backofficeLinks.helloflex.name')} />}>
      {status === 'linked' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <SoftChip label={t('backofficeLinks.common.statusLinked')} color="var(--color-success)" />
            {link?.externalId && <Mono style={{ fontSize: 12 }}>{link.externalId}</Mono>}
          </div>
          <LinkedByLine link={link} />
          {/* MATCHES 16 (21-08): sync metadata lives with the coupling, not on the
              Overview tab — mirrors ShiftmanagerCard's own lastSynced line. */}
          {link?.lastSyncedAt && (
            <Caption as="span">
              {t('backofficeLinks.helloflex.lastSynced', { date: formatDateTime(link.lastSyncedAt) })}
            </Caption>
          )}
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
            <Mono style={{ fontSize: 12 }}>{t('backofficeLinks.shiftmanager.externalId')}: {externalId}</Mono>
            {canSyncNow && (
              <Button variant="primary" size="sm" onClick={onSyncNow} disabled={syncing} style={{ flexShrink: 0 }}>
                <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
                {syncing ? t('backofficeLinks.shiftmanager.syncing') : t('backofficeLinks.shiftmanager.syncNow')}
              </Button>
            )}
          </div>
          <LinkedByLine link={link} />
          {link?.lastSyncedAt && (
            <Caption as="span">
              {t('backofficeLinks.shiftmanager.lastSynced', { date: formatDateTime(link.lastSyncedAt) })}
            </Caption>
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

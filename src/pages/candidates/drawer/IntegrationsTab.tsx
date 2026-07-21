/**
 * IntegrationsTab ("Koppelingen") — per-system backoffice link status: PDOK
 * address-geocoding (fully automatic), and HelloFlex/Shiftmanager (KOPPELINGEN-
 * META-1: both link through the same POST /sync/candidates/{id} { system }
 * endpoint, which now also stamps who/when the link was FIRST made). PDOK is
 * always shown; the HelloFlex/Shiftmanager cards only appear when the tenant has
 * the matching module OR app/koppeling flag on (same OR-gate as SettingsPage's
 * `passesModuleOrApp`). No fake affordances (§3): every button here fires a real
 * request; nothing renders a control that goes nowhere.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Link2 } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import { useAuth } from '@/context/AuthContext'
import { useApps } from '@/context/AppsContext'
import { useDateFormat } from '@/lib/datetime'
import api from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import pdokIcon from '@/assets/integrations/pdok.png'
import helloflexIcon from '@/assets/integrations/helloflex.png'
import shiftmanagerIcon from '@/assets/integrations/shiftmanager.png'
import type { Candidate, CandidateBackofficeLink } from '@/types/candidate'

type BackofficeSystem = 'helloflex' | 'shiftmanager'

// Small brand icon, fixed at a 16px footprint in every card header (never
// hotlinked — local assets only, §7 CSP); alt text always comes through i18n.
function CardTitle({ icon, alt, label }: { icon: string; alt: string; label: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <img src={icon} alt={alt} width={16} height={16} style={{ borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />
      {label}
    </span>
  )
}

// Shared "Koppelen" / "Opnieuw koppelen" trigger for both systems — one real POST
// per click (§3: no fake affordances), never fires on its own; a spinner replaces
// the icon while the request is in flight.
function LinkButton({ onClick, busy, retry }: { onClick: () => void; busy: boolean; retry?: boolean }) {
  const { t } = useTranslation('candidates')
  return (
    <button type="button" onClick={onClick} disabled={busy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px',
        fontSize: 11, fontWeight: 500, borderRadius: 7, border: '1px solid var(--border)',
        cursor: busy ? 'not-allowed' : 'pointer', background: 'var(--surface)',
        color: 'var(--text)', opacity: busy ? 0.6 : 1, flexShrink: 0,
      }}>
      {busy ? <RefreshCw size={11} className="animate-spin" /> : <Link2 size={11} />}
      {busy ? t('integrations.common.linking') : t(retry ? 'integrations.common.retry' : 'integrations.common.linkButton')}
    </button>
  )
}

// "Gekoppeld door {naam} op {datum}" — shared by both linked backoffice cards.
// Renders nothing until the backend has resolved both who and when (H2 pattern).
function LinkedByLine({ link }: { link: CandidateBackofficeLink | null }) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  if (!link?.linkedBy || !link.linkedAt) return null
  return (
    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
      {t('integrations.common.linkedByOn', { name: link.linkedBy.name ?? '—', date: formatDate(link.linkedAt) })}
    </span>
  )
}

export default function IntegrationsTab({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { formatDateTime } = useDateFormat()
  // Module OR app/koppeling flag unlocks the card — never AND (a tenant can enable
  // either signal first); mirrors SettingsPage's passesModuleOrApp.
  const auth = useAuth()
  const hasModule = auth?.hasModule ?? (() => false)
  const apps = useApps()
  const isAppEnabled = apps?.isAppEnabled ?? (() => false)
  const showHelloflex = hasModule('hf') || isAppEnabled('helloflex')
  const showShiftmanager = hasModule('sm') || isAppEnabled('shiftmanager')

  // Real datapath: STRAAL-1 coordinates, already mapped onto Candidate today.
  const hasCoords = c.lat != null && c.lng != null

  // KOPPELINGEN-META-1: both systems resolved onto the candidate symmetrically —
  // status/external id/last error plus who/when the link was FIRST made.
  const hf = c.helloflexLink
  const sm = c.shiftmanagerLink

  // Start-linking: the ONE generic POST both systems share. Optimistic: a spinner
  // while in flight, then the 202's `pending` snapshot overlays the card locally
  // until the candidate is refetched with the real linked/failed result (the same
  // simplification the existing "Nu synchroniseren" below already relies on — it
  // resets to the fresh server value the next time this tab mounts). Never fires
  // on its own (§13: the test asserts the click, not an auto-call).
  const [linking, setLinking] = useState<Partial<Record<BackofficeSystem, boolean>>>({})
  const [queuedStatus, setQueuedStatus] = useState<Partial<Record<BackofficeSystem, string>>>({})
  const onLink = async (system: BackofficeSystem) => {
    if (linking[system]) return
    setLinking(s => ({ ...s, [system]: true }))
    try {
      const { data } = await api.post(`/sync/candidates/${c.id}`, { system })
      setQueuedStatus(s => ({ ...s, [system]: data?.link?.status ?? 'pending' }))
      notifySuccess(t('integrations.common.linkStarted'))
    } catch (err) {
      notifyError(extractApiError(err, t('integrations.common.linkFailed')))
    } finally {
      setLinking(s => ({ ...s, [system]: false }))
    }
  }

  // Manual "Nu synchroniseren" (Shiftmanager only — its own lightweight one-off
  // endpoint, distinct from the generic link POST above) — optimistic spinner,
  // result via a toast (§13: this asserts the real POST route/body in the test).
  const smExternalId = sm?.status === 'linked' ? sm.externalId ?? null : null
  const [syncing, setSyncing] = useState(false)
  const onSyncNow = async () => {
    if (!smExternalId || syncing) return
    setSyncing(true)
    try {
      await api.post(`/sm_candidates/sync/${smExternalId}`)
      notifySuccess(t('integrations.shiftmanager.syncSuccess'))
    } catch (err) {
      notifyError(extractApiError(err, t('integrations.shiftmanager.syncFailed')))
    } finally {
      setSyncing(false)
    }
  }

  // Effective status per system: the just-clicked optimistic overlay wins, else
  // the mapped link's real status, else "never attempted" (null).
  const hfStatus = queuedStatus.helloflex ?? hf?.status ?? null
  const smStatus = queuedStatus.shiftmanager ?? sm?.status ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* PDOK — always visible; geocoding is fully automatic, no manual trigger exists. */}
      <SectionCard title={<CardTitle icon={pdokIcon} alt={t('integrations.pdok.alt')} label={t('integrations.pdok.name')} />}>
        {hasCoords ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SoftChip label={t('integrations.pdok.linked')} color="var(--color-success)" />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
              {c.lat?.toFixed(5)}, {c.lng?.toFixed(5)}
            </span>
          </div>
        ) : (
          <SoftChip label={t('integrations.pdok.notGeocoded')} color="var(--text-muted)" />
        )}
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
          {t('integrations.pdok.autoInfo')}
        </p>
      </SectionCard>

      {/* HelloFlex — gated on module/app; links through the same generic sync POST
          as Shiftmanager (real endpoint today, even though it commonly fails clean
          until Settings → Integraties holds HelloFlex credentials — that failure
          is a real, surfaced state, not a placeholder). */}
      {showHelloflex && (
        <SectionCard title={<CardTitle icon={helloflexIcon} alt={t('integrations.helloflex.alt')} label={t('integrations.helloflex.name')} />}>
          {hfStatus === 'linked' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <SoftChip label={t('integrations.common.statusLinked')} color="var(--color-success)" />
                {hf?.externalId && (
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text)' }}>{hf.externalId}</span>
                )}
              </div>
              <LinkedByLine link={hf} />
            </div>
          ) : hfStatus === 'pending' ? (
            <SoftChip label={t('integrations.common.statusPending')} color="var(--color-warning)" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {hfStatus === 'failed' ? (
                  <SoftChip label={t('integrations.common.statusFailed')} color="var(--color-danger)" />
                ) : (
                  <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', margin: 0 }}>
                    {t('integrations.helloflex.notLinked')}
                  </p>
                )}
                <LinkButton onClick={() => onLink('helloflex')} busy={!!linking.helloflex} retry={hfStatus === 'failed'} />
              </div>
              {hfStatus === 'failed' && hf?.lastError && (
                <p style={{ fontSize: 11, color: 'var(--color-danger)', margin: 0 }}>{hf.lastError}</p>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {/* Shiftmanager — same generic link POST, plus its own "Nu synchroniseren"
          once actually linked. */}
      {showShiftmanager && (
        <SectionCard title={<CardTitle icon={shiftmanagerIcon} alt={t('integrations.shiftmanager.alt')} label={t('integrations.shiftmanager.name')} />}>
          {smStatus === 'linked' && smExternalId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text)' }}>
                  {t('integrations.shiftmanager.externalId')}: {smExternalId}
                </span>
                <button type="button" onClick={onSyncNow} disabled={syncing}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                    fontSize: 11, fontWeight: 500, borderRadius: 7, border: '1px solid var(--border)',
                    cursor: syncing ? 'not-allowed' : 'pointer', background: 'var(--surface)',
                    color: 'var(--text)', opacity: syncing ? 0.6 : 1,
                  }}>
                  <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? t('integrations.shiftmanager.syncing') : t('integrations.shiftmanager.syncNow')}
                </button>
              </div>
              <LinkedByLine link={sm} />
              {sm?.lastSyncedAt && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('integrations.shiftmanager.lastSynced', { date: formatDateTime(sm.lastSyncedAt) })}
                </span>
              )}
            </div>
          ) : smStatus === 'pending' ? (
            <SoftChip label={t('integrations.common.statusPending')} color="var(--color-warning)" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {smStatus === 'failed' ? (
                  <SoftChip label={t('integrations.common.statusFailed')} color="var(--color-danger)" />
                ) : (
                  <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', margin: 0 }}>
                    {t('integrations.shiftmanager.notLinked')}
                  </p>
                )}
                <LinkButton onClick={() => onLink('shiftmanager')} busy={!!linking.shiftmanager} retry={smStatus === 'failed'} />
              </div>
              {smStatus === 'failed' && sm?.lastError && (
                <p style={{ fontSize: 11, color: 'var(--color-danger)', margin: 0 }}>{sm.lastError}</p>
              )}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}

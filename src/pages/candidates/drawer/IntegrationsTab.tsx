/**
 * IntegrationsTab ("Koppelingen") — read-only status of this candidate's external
 * integrations: PDOK address-geocoding, HelloFlex and Shiftmanager. PDOK is always
 * shown; the HelloFlex/Shiftmanager cards only appear when the tenant has the
 * matching module OR app/koppeling flag on (same OR-gate as SettingsPage's
 * `passesModuleOrApp`). No fake affordances (§3): a card without a real backend
 * datapath renders disabled with an honest notice instead of a button that goes
 * nowhere.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
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
import type { Candidate } from '@/types/candidate'

// FE mapper gap (flagged in the delivery report, not fixed here — out of file scope):
// the backend already returns `backoffice_links` (system/status/external_id/
// last_synced_at per system) on the candidate payload, but mapCandidate.ts does not
// forward it onto the Candidate type yet. Reading it defensively means this card is
// honest TODAY ("not linked" for every candidate) and lights up automatically the
// moment a future change adds a `shiftmanagerLink` field with these exact names to
// the mapper — no further change needed in this file then.
interface ShiftmanagerLink { status?: string | null; externalId?: string | null; lastSyncedAt?: string | null }
function shiftmanagerLinkOf(c: Candidate): ShiftmanagerLink | null {
  return (c as unknown as { shiftmanagerLink?: ShiftmanagerLink | null }).shiftmanagerLink ?? null
}

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

  // Shiftmanager link (see the gap note above) — only a 'linked' status carries a
  // usable external id to sync against.
  const sm = shiftmanagerLinkOf(c)
  const smExternalId = sm?.status === 'linked' ? sm.externalId ?? null : null

  // Manual "Nu synchroniseren" — optimistic spinner, result via a toast (§13: this
  // asserts the real POST route/body in the test, not just that a callback fired).
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

      {/* HelloFlex — gated on module/app; no endpoints exist yet (creds-flow pending
          Danny), so this stays a disabled, honest notice — never a dead button. */}
      {showHelloflex && (
        <SectionCard title={<CardTitle icon={helloflexIcon} alt={t('integrations.helloflex.alt')} label={t('integrations.helloflex.name')} />}>
          <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', margin: 0 }}>
            {t('integrations.helloflex.notAvailable')}
          </p>
        </SectionCard>
      )}

      {/* Shiftmanager — gated on module/app; real sync endpoint once an external id
          is known (see the gap note above for why that's not wired yet today). */}
      {showShiftmanager && (
        <SectionCard title={<CardTitle icon={shiftmanagerIcon} alt={t('integrations.shiftmanager.alt')} label={t('integrations.shiftmanager.name')} />}>
          {smExternalId ? (
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
              {sm?.lastSyncedAt && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('integrations.shiftmanager.lastSynced', { date: formatDateTime(sm.lastSyncedAt) })}
                </span>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', margin: 0 }}>
              {t('integrations.shiftmanager.notLinked')}
            </p>
          )}
        </SectionCard>
      )}
    </div>
  )
}

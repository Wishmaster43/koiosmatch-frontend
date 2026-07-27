/**
 * IntegrationsTab ("Koppelingen") — the candidate-only PDOK address-geocoding
 * card (automatic on address change, plus a manual "Bijwerken" trigger —
 * CAND-PDOK-GEOCODE-FE-1), followed by the shared HelloFlex/Shiftmanager
 * backoffice-link cards (EXTRACT-1: extracted into
 * components/drawer/BackofficeLinksTab so every entity that carries
 * backoffice_links[] — customers, locations, departments, contacts, matches —
 * reuses the exact same cards, §3A/§11). PDOK is always shown; the shared
 * component itself gates HelloFlex/Shiftmanager on the tenant's connector app
 * flag. No fake affordances (§3): every button fires a real request.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import BackofficeLinksTab, { CardTitle } from '@/components/drawer/BackofficeLinksTab'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import api, { unwrap } from '@/lib/api'
import { toCoord } from '@/lib/coords'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import pdokIcon from '@/assets/integrations/pdok.png'
import type { Candidate } from '@/types/candidate'

// PDOK geocode provenance (CAND-PDOK-GEOCODE-META-1): prefers "Bijgewerkt …" once
// coordinates were actually written (the automatic address-change path stamps
// this too, without a requester — name part only shows when known); falls back
// to "Aangevraagd … door …" while a manual request is still queued. Renders
// nothing once neither timestamp is known (H2 graceful-null pattern).
function PdokMetaLine({ geocode }: { geocode: Candidate['geocode'] }) {
  const { t } = useTranslation('candidates')
  const { formatDateTime } = useDateFormat()
  if (geocode?.updatedAt) {
    return (
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
        {geocode.requestedBy
          ? t('integrations.pdok.updatedAtBy', { date: formatDateTime(geocode.updatedAt), name: geocode.requestedBy })
          : t('integrations.pdok.updatedAt', { date: formatDateTime(geocode.updatedAt) })}
      </p>
    )
  }
  if (geocode?.requestedAt && geocode.requestedBy) {
    return (
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
        {t('integrations.pdok.requestedAtBy', { date: formatDateTime(geocode.requestedAt), name: geocode.requestedBy })}
      </p>
    )
  }
  return null
}

export default function IntegrationsTab({ c, onUpdate }: {
  c: Candidate
  // Optional record-merge callback (CandidateDrawer wires the page's updateCandidate):
  // lets the PDOK poll push fresh lat/lng/geocode into the page record so the whole
  // drawer/list/map updates without a manual reload (Danny 22-07: "nog steeds CMD+R").
  onUpdate?: (id: Candidate['id'], patch: Record<string, unknown>) => void
}) {
  const { t } = useTranslation('candidates')
  const auth = useAuth()
  const hasPermission = auth?.hasPermission ?? (() => false)

  // CAND-PDOK-GEOCODE-FE-1: manual "Bijwerken" trigger for the async geocode
  // workflow (POST .../geocode, 202 queued). Once it resolves we poll the
  // candidate a few times so the fresh lat/lng show up without a full drawer
  // reload; guarded so a stray poll tick after unmount never sets state.
  // One write-permission check, used by BOTH the PDOK refresh and the Koppelen buttons.
  const canUpdate = hasPermission('candidates.update')
  const [pdokRefreshing, setPdokRefreshing] = useState(false)
  const [coordsOverride, setCoordsOverride] = useState<{ lat: number | null; lng: number | null } | null>(null)
  // PDOK-REFRESH-2 (Danny 22-07 "moet CMD-R doen"): the poll must also refresh the
  // provenance line ("Bijgewerkt … door …") — coords alone often DON'T change on a
  // re-geocode (same address → same pin), so without this nothing visibly updates.
  const [geocodeOverride, setGeocodeOverride] = useState<Candidate['geocode']>(null)
  const mountedRef = useRef(true)
  // PDOK-REFRESH-3 (Danny 22-07 "MOET CMD+R???"): the setup MUST re-arm the ref.
  // StrictMode runs setup → cleanup → setup in dev; the old cleanup-only effect
  // left mountedRef permanently false after the simulated remount, so every poll
  // tick bailed instantly — the panel never updated in dev, only after a reload.
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const onRefreshPdok = async () => {
    if (pdokRefreshing) return
    setPdokRefreshing(true)
    try {
      await api.post(`/candidates/${c.id}/geocode`)
      notifySuccess(t('integrations.pdok.refreshStarted'))
    } catch (err) {
      notifyError(extractApiError(err, t('integrations.pdok.refreshFailed')))
      setPdokRefreshing(false)
      return
    }
    // PDOK-LATLNG-1 (CMBE 22-07): the 202 means "queued" — stop the spinner HERE
    // (Danny saw an "eternal" spinner riding the whole poll) and refresh in the
    // background: the job writes lat/lng within ~1s, so re-fetch at ~3s (one
    // retry at 6s). Values are coerced via toCoord — Laravel sends decimals as
    // strings, which the old !== comparison and the mapper both mishandled.
    setPdokRefreshing(false)
    // PDOK-REFRESH-2: always ADOPT the fresh values (coords + provenance) — a re-geocode
    // of the same address keeps the same pin, but the "Bijgewerkt … door …" meta DID
    // change; the old changed-coords-only guard made that invisible until a page reload.
    const baseUpdatedAt = c.geocode?.updatedAt ?? null
    // Slightly longer window (~11s) so a slower dev queue-worker still lands in view.
    for (const delayMs of [2000, 2000, 3000, 4000]) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
      if (!mountedRef.current) return
      try {
        const fresh = unwrap<{ lat?: unknown; lng?: unknown; geocode?: { requested_at?: string | null; requested_by?: string | null; updated_at?: string | null } | null }>(
          await api.get(`/candidates/${c.id}`),
        )
        if (!mountedRef.current) return
        const lat = toCoord(fresh?.lat)
        const lng = toCoord(fresh?.lng)
        if (lat != null && lng != null) {
          setCoordsOverride({ lat, lng })
        }
        const meta = fresh?.geocode
          ? {
              requestedAt: fresh.geocode.requested_at ?? null,
              requestedBy: fresh.geocode.requested_by ?? null,
              updatedAt: fresh.geocode.updated_at ?? null,
            }
          : null
        if (meta) setGeocodeOverride(meta)
        // Done once the write actually landed (a fresh updated_at stamp); else poll once more.
        if (meta?.updatedAt && meta.updatedAt !== baseUpdatedAt) {
          // PDOK-REFRESH-2b (Danny: "nog steeds CMD+R"): merge the fresh values into the
          // PAGE record too — list/map/other tabs update in place, and the panel survives
          // a tab switch. Pure local merge: patchCandidate maps none of these keys, so
          // this never fires an API write (buildCandidatePatch → empty body → skipped).
          onUpdate?.(c.id, { lat, lng, geocode: meta })
          return
        }
      } catch {
        // Silent — a poll failure just keeps the last-known coordinates; the
        // manual trigger already reported "started" above.
      }
    }
  }

  // Effective coordinates: the just-polled override wins, else the candidate prop.
  const effectiveLat = coordsOverride?.lat ?? c.lat
  const effectiveLng = coordsOverride?.lng ?? c.lng
  const hasCoords = effectiveLat != null && effectiveLng != null

  return (
    // EXTRACT-1: the shared HelloFlex/Shiftmanager cards (§3A/§11). Koppelen is gated
    // on candidates.update exactly like the five other entities gate on their own
    // write permission — the extraction briefly left this one always-enabled, which
    // offered a link button to read-only users the backend would refuse anyway.
    <BackofficeLinksTab entity="candidates" id={c.id} helloflexLink={c.helloflexLink} shiftmanagerLink={c.shiftmanagerLink} canLink={canUpdate}>
      {/* PDOK — geocoding runs automatically on address change; "Bijwerken" (gated
          on candidates.update) queues a manual re-geocode via the same async
          workflow, then the tab polls briefly for the fresh coordinates. */}
      <SectionCard title={<CardTitle icon={pdokIcon} alt={t('integrations.pdok.alt')} label={t('integrations.pdok.name')} />}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          {hasCoords ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SoftChip label={t('integrations.pdok.linked')} color="var(--color-success)" />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                {effectiveLat?.toFixed(5)}, {effectiveLng?.toFixed(5)}
              </span>
            </div>
          ) : (
            <SoftChip label={t('integrations.pdok.notGeocoded')} color="var(--text-muted)" />
          )}
          {canUpdate && (
            <button type="button" onClick={onRefreshPdok} disabled={pdokRefreshing}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                fontSize: 11, fontWeight: 500, borderRadius: 7, border: '1px solid var(--border)',
                cursor: pdokRefreshing ? 'not-allowed' : 'pointer', background: 'var(--surface)',
                color: 'var(--text)', opacity: pdokRefreshing ? 0.6 : 1, flexShrink: 0,
              }}>
              <RefreshCw size={11} className={pdokRefreshing ? 'animate-spin' : ''} />
              {pdokRefreshing ? t('integrations.pdok.refreshing') : t('integrations.pdok.refresh')}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          <PdokMetaLine geocode={geocodeOverride ?? c.geocode} />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            {t('integrations.pdok.autoInfo')}
          </p>
        </div>
      </SectionCard>
    </BackofficeLinksTab>
  )
}

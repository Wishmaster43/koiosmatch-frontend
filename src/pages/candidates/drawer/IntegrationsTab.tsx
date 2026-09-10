/**
 * IntegrationsTab ("Koppelingen") — the candidate-only OpenCage address-geocoding
 * card (automatic on address change, plus a manual "Bijwerken" trigger —
 * GEO-GEOCODE-FE-1), followed by the shared HelloFlex/Shiftmanager
 * backoffice-link cards (EXTRACT-1: extracted into
 * components/drawer/BackofficeLinksTab so every entity that carries
 * backoffice_links[] — customers, locations, departments, contacts, matches —
 * reuses the exact same cards, §3A/§11). OpenCage geocoding is always shown; the shared
 * component itself gates HelloFlex/Shiftmanager on the tenant's connector app
 * flag. No fake affordances (§3): every button fires a real request.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Compass } from 'lucide-react'
import Button from '@/components/ui/Button'
import SectionCard from '@/components/ui/SectionCard'
import SoftChip from '@/components/ui/SoftChip'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import api from '@/lib/api'
import { useGeocodePoll } from '@/hooks/useGeocodePoll'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { formatCoord } from '@/lib/formatters'
import { Mono } from '@/components/ui/typography'
import type { Candidate } from '@/types/candidate'

// OpenCage geocode provenance (GEO-GEOCODE-META-1): prefers "Bijgewerkt …" once
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
          ? t('backofficeLinks.geocode.updatedAtBy', { date: formatDateTime(geocode.updatedAt), name: geocode.requestedBy })
          : t('backofficeLinks.geocode.updatedAt', { date: formatDateTime(geocode.updatedAt) })}
      </p>
    )
  }
  if (geocode?.requestedAt && geocode.requestedBy) {
    return (
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
        {t('backofficeLinks.geocode.requestedAtBy', { date: formatDateTime(geocode.requestedAt), name: geocode.requestedBy })}
      </p>
    )
  }
  return null
}

// Backoffice/PDOK integrations tab: manual geocode refresh (with its own poll for
// the async result) plus the Koppelen (link) buttons, both gated on candidates.update.
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

  // One write-permission check, used by BOTH the geocode refresh and the Koppelen buttons.
  const canUpdate = hasPermission('candidates.update')
  const [pdokRefreshing, setPdokRefreshing] = useState(false)
  // GEO-POLL-1: the background poll after a queued re-geocode lives in the shared hook
  // (with the PDOK-REFRESH-2/3 and GEO-REFRESH-2 lessons); it also resumes on mount while
  // a request is still open, so a tab switch mid-request never loses the update.
  const poll = useGeocodePoll({
    fetchEndpoint: `/candidates/${c.id}`,
    base: { lat: c.lat, lng: c.lng, geocode: c.geocode },
    // GEO-REFRESH-2b (Danny: "nog steeds CMD+R"): merge the landed values into the PAGE
    // record too — list/map/other tabs update in place, and the panel survives a tab
    // switch. Pure local merge: patchCandidate maps none of these keys, so this never
    // fires an API write (buildCandidatePatch → empty body → skipped).
    onLanded: patch => onUpdate?.(c.id, { lat: patch.lat, lng: patch.lng, geocode: patch.geocode }),
  })

  // GEO-GEOCODE-FE-1: manual "Bijwerken" trigger for the async geocode workflow
  // (POST .../geocode, 202 queued). GEO-LATLNG-1 (CMBE 22-07): the 202 means "queued" —
  // the spinner stops HERE (Danny saw an "eternal" spinner riding the whole poll) and
  // the poll refreshes the card in the background until the write lands.
  const onRefreshPdok = async () => {
    if (pdokRefreshing) return
    setPdokRefreshing(true)
    try {
      await api.post(`/candidates/${c.id}/geocode`)
      notifySuccess(t('backofficeLinks.geocode.refreshStarted'))
    } catch (err) {
      notifyError(extractApiError(err, t('backofficeLinks.geocode.refreshFailed')))
      return
    } finally {
      setPdokRefreshing(false)
    }
    poll.start()
  }

  // Effective coordinates: the just-polled values win, else the candidate prop.
  const effectiveLat = poll.lat
  const effectiveLng = poll.lng
  const hasCoords = effectiveLat != null && effectiveLng != null

  return (
    // EXTRACT-1: the shared HelloFlex/Shiftmanager cards (§3A/§11). Koppelen is gated
    // on candidates.update exactly like the five other entities gate on their own
    // write permission — the extraction briefly left this one always-enabled, which
    // offered a link button to read-only users the backend would refuse anyway.
    <BackofficeLinksTab entity="candidates" id={c.id} helloflexLink={c.helloflexLink} shiftmanagerLink={c.shiftmanagerLink} canLink={canUpdate}>
      {/* OpenCage — geocoding runs automatically on address change; "Bijwerken" (gated
          on candidates.update) queues a manual re-geocode via the same async
          workflow, then the tab polls briefly for the fresh coordinates. */}
      <SectionCard title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Compass size={16} />
        {t('backofficeLinks.geocode.name')}
      </span>}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          {hasCoords ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SoftChip label={t('backofficeLinks.geocode.linked')} color="var(--color-success)" />
              <Mono style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {formatCoord(effectiveLat)}, {formatCoord(effectiveLng)}
              </Mono>
            </div>
          ) : (
            <SoftChip label={t('backofficeLinks.geocode.notGeocoded')} color="var(--text-muted)" />
          )}
          {/* HUISSTIJL-1: the house Button trio (variant="soft", iconOnly) — same
              title/aria-label/disabled as before, only the chrome moved off a
              hand-rolled <button>. RefreshCw keeps its spin-while-refreshing
              className (stateful action icon, never re-tinted by the trio). */}
          {canUpdate && (
            <Button variant="soft" iconOnly onClick={onRefreshPdok} disabled={pdokRefreshing}
              title={pdokRefreshing ? t('backofficeLinks.geocode.refreshing') : t('backofficeLinks.geocode.refresh')}
              aria-label={pdokRefreshing ? t('backofficeLinks.geocode.refreshing') : t('backofficeLinks.geocode.refresh')}>
              <RefreshCw size={13} className={pdokRefreshing ? 'animate-spin' : ''} />
            </Button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          <PdokMetaLine geocode={poll.geocode} />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            {t('backofficeLinks.geocode.autoInfo')}
          </p>
        </div>
      </SectionCard>
    </BackofficeLinksTab>
  )
}

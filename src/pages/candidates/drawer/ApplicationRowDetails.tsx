/**
 * ApplicationRowDetails — the panel that unfolds under ONE application row in the
 * candidate drawer (Danny 09-08: "bij matches heb ik een pijltje om uit te klappen
 * en wat informatie te zien, bij sollicitaties niet. Dat is niet consistent").
 * Mirrors the label/value rows MatchCard reveals in its own `collapsible` mode, so
 * both collapsibles in this drawer read as one system.
 *
 * WHY IT FETCHES INSTEAD OF READING THE ROW (measured live 09-08, both endpoints):
 * the candidate-embedded application (Candidate/ApplicationResource.php) carries
 * ONLY `{ id, vacancy{id,title}, vacancyTitle, stageLabel, stageColor, created_at }` —
 * every one of which the COLLAPSED row already shows, so a panel built off that
 * payload would repeat the row and add nothing. Client, owner, reference number and
 * the rejection trail exist only on the application DETAIL resource
 * (GET /applications/{id} → ApplicationDetailResource). The panel loads it ONCE, on
 * first expand: nothing is fetched for a row the recruiter never opens (§8 data
 * minimisation), and the request is never repeated while the row stays mounted.
 *
 * NO FIELD IS RENDERED THAT CANNOT CARRY A VALUE (§3, Danny's explicit instruction):
 * every row below is dropped when its value is absent rather than showing a dash —
 * measured proof this matters: a vacancy-less intake application (S-00046) genuinely
 * returns `vacancy: null` + `client_name: null`, while an application on a vacancy
 * (S-00047) returns "Inovum". Fase / recruiter / aangemaakt-op / referentienr. were
 * populated on every application measured.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import api, { unwrap } from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { useDateFormat } from '@/lib/datetime'
import SoftChip from '@/components/ui/SoftChip'
import { Mono } from '@/components/ui/typography'
import type { Id } from '@/types/common'

// The slice of ApplicationDetailResource this panel reads. Hand-written on purpose
// (§10): the generated OpenAPI export documents request shapes + the 401 for this
// route, not its 2xx body — so the success shape is measured, not generated.
interface ApplicationRowDetail {
  client_name?: string | null
  phase_label?: string | null
  phase_color?: string | null
  owner?: { name?: string | null } | null
  created_at?: string | null
  reference_number?: string | null
  rejection?: { reason_label?: string | null } | null
}

// One label/value line — the exact geometry MatchCard uses for its detail rows.
const line = { display: 'flex', padding: '7px 12px', gap: 16, background: 'var(--surface)', alignItems: 'center' } as const

export default function ApplicationRowDetails({ applicationId, labelledBy, id }: {
  applicationId: Id
  // The toggle button that owns this panel — names the region for screen readers.
  labelledBy: string
  id: string
}) {
  const { t } = useTranslation(['candidates', 'common'])
  const { formatDate } = useDateFormat()
  const [detail, setDetail] = useState<ApplicationRowDetail | null>(null)
  // The raw failure, translated at RENDER time — keeping `t` out of the effect's
  // deps, so switching language can never re-trigger the request.
  const [error, setError] = useState<unknown>(null)

  // Alive guard re-armed in SETUP — StrictMode runs setup→cleanup→setup, and a
  // cleanup-only ref would stay false and silently swallow the response (§9).
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  // Load the detail once per application; a fresh id refetches, a re-expand does not.
  useEffect(() => {
    let current = true
    setDetail(null); setError(null)
    api.get(`/applications/${applicationId}`)
      .then(res => { if (current && alive.current) setDetail(unwrap<ApplicationRowDetail>(res) ?? {}) })
      .catch(err => { if (current && alive.current) setError(err ?? new Error('load failed')) })
    return () => { current = false }
  }, [applicationId])
  const errorMessage = error ? extractApiError(error, t('work.detailsError')) : null

  // Only fields that actually carry a value become a row (see the docblock).
  const rows: Array<{ key: string; label: string; value: ReactNode }> = []
  if (detail?.client_name) rows.push({ key: 'client', label: t('work.client'), value: detail.client_name })
  if (detail?.phase_label) rows.push({ key: 'phase', label: t('work.phase'), value: <SoftChip label={detail.phase_label} color={detail.phase_color} /> })
  if (detail?.owner?.name) rows.push({ key: 'owner', label: t('work.owner'), value: detail.owner.name })
  if (detail?.created_at) rows.push({ key: 'createdAt', label: t('work.createdAt'), value: formatDate(detail.created_at) })
  if (detail?.reference_number) rows.push({ key: 'reference', label: t('work.reference'), value: <Mono>{detail.reference_number}</Mono> })
  if (detail?.rejection?.reason_label) rows.push({ key: 'rejection', label: t('work.rejectionReason'), value: <SoftChip label={detail.rejection.reason_label} color="var(--color-danger)" /> })

  // Four states, never a blank panel (§3): error → success → empty → loading.
  const body = errorMessage
    ? <div style={{ ...line, fontSize: 12, color: 'var(--color-danger-text)' }}>{errorMessage}</div>
    : rows.length > 0
      ? rows.map(({ key, label, value }) => (
          <div key={key} style={line}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>
          </div>
        ))
      : <div style={{ ...line, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{detail ? t('work.detailsEmpty') : t('common:loading')}</div>

  return (
    <div id={id} role="region" aria-labelledby={labelledBy} style={{ borderTop: '1px solid var(--border)' }}>
      {body}
    </div>
  )
}

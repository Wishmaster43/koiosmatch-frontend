/**
 * EmailTab — see the fuller docblock below, right above the component, for
 * this opportunity's e-mail history tab: what it fetches and why.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import type { TFunction } from 'i18next'
import { AlertTriangle, Lock } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { useDateFormat } from '@/lib/datetime'
import Spinner from '@/components/ui/Spinner'
import { DirectionPill, StatusPill, isInbound } from '@/components/ui/logChips'
import { BodyText, Caption } from '@/components/ui/typography'
import type { Opportunity } from '@/types/opportunity'

// One row of the (PII-arm) e-mail-log list — the index response never carries
// a body (EmailLogController, see EmailRow below for the body's own fetch).
interface EmailLogEntry {
  id?: string | number
  direction?: string
  from?: string
  to?: string
  subject?: string
  status?: string
  created_at?: string
  entity_id?: string | number
}

// The single-item read adds the (decrypted) body — GET /email-log/{id}.
interface EmailLogDetail extends EmailLogEntry {
  body?: string
}

// True when an axios error carries a 403 — the settings.view (+ candidates.view for
// a body read) gate on the /email-log routes (routes/api/tenant/communication-ai.php).
// A recruiter with only opportunities.view legitimately hits this; it is a real,
// expected state, never a generic error.
const isForbidden = (err: unknown): boolean => (err as AxiosError)?.response?.status === 403

/**
 * EmailTab — this opportunity's e-mail history (KANSEN-VERDIEPING-PLAN DEEL 2 fase A
 * item 5). Built on the CommunicationTab recipe (fetch -> four states -> compact rows)
 * but e-mail-only: no sub-tab bar, no WhatsApp/notes. Reads GET /email-log scoped by
 * entity_type=opportunity&entity_id (the backend's EmailLogController ENTITY_MAP
 * already carries 'opportunity', measured against the controller source) plus a
 * defensive client-side entity_id re-check (§8: never trust the network alone with
 * a special-category-adjacent list). A row click lazily fetches ITS OWN body via
 * GET /email-log/{id} (the list itself never carries one) and expands INLINE under
 * the row - never a second overlay drawer (the settings EmailLogDrawer overlay is a
 * different pattern, not reused here).
 */
export default function EmailTab({ opportunity: o }: { opportunity: Opportunity }) {
  const { t } = useTranslation('opportunities')
  const { formatDateTime } = useDateFormat()

  // K-33: react-query is the server-state standard; the key is scoped per opportunity
  // so switching records never shows a stale sibling's mail while the new one loads.
  // per_page 200 = the backend's MAX_PER_PAGE (its default page of 50 would silently
  // hide older mail); `total` is kept so a history larger than one page says so.
  const { data, isLoading, error } = useQuery({
    queryKey: ['opportunity-email-log', o.id],
    queryFn: async ({ signal }) => {
      const res = await api.get('/email-log', { params: { entity_type: 'opportunity', entity_id: o.id, per_page: 200 }, signal })
      const { rows, total } = unwrapList<EmailLogEntry>(res)
      return { rows, total }
    },
    enabled: Boolean(o.id),
  })
  // Defensive re-check: the controller filters server-side and stamps entity_id on
  // every row, but a list this sensitive never trusts the network alone (§8).
  const fetched = data?.rows ?? []
  const rows = fetched.filter(r => r.entity_id == null || String(r.entity_id) === String(o.id))

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16 }}>
        <Spinner size={13} /> <Caption as="span">{t('email.loading')}</Caption>
      </div>
    )
  }

  if (error) {
    const forbidden = isForbidden(error)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16 }}>
        {forbidden
          ? <Lock size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          : <AlertTriangle size={14} style={{ color: 'var(--color-danger-text)' }} aria-hidden="true" />}
        <Caption as="span" style={forbidden ? undefined : { color: 'var(--color-danger-text)' }}>
          {forbidden ? t('email.noAccess') : t('email.error')}
        </Caption>
      </div>
    )
  }

  if (rows.length === 0) {
    return <Caption as="div" style={{ fontStyle: 'italic' }}>{t('email.empty')}</Caption>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((row, i) => (
        <EmailRow key={row.id ?? i} row={row} opportunityId={o.id} formatDateTime={formatDateTime} t={t} />
      ))}
      {/* No silent caps: when the server holds more than one page, say so. */}
      {data?.total != null && data.total > fetched.length && (
        <Caption as="div">{t('email.showingOf', { shown: rows.length, total: data.total })}</Caption>
      )}
    </div>
  )
}

// One compact row: a real <button> (keyboard-operable by nature, aria-expanded)
// toggling an inline body panel that lazily fetches GET /email-log/{id} the first
// time it opens - the body is never fetched for rows the user never expands, and
// react-query caches it per id so re-toggling the same row never re-fetches.
function EmailRow({ row, opportunityId, formatDateTime, t }: {
  row: EmailLogEntry
  opportunityId: Opportunity['id']
  formatDateTime: (v?: string | null) => string
  t: TFunction<'opportunities'>
}) {
  const [expanded, setExpanded] = useState(false)
  const { data: detail, isLoading: bodyLoading, error: bodyError } = useQuery({
    queryKey: ['opportunity-email-body', opportunityId, row.id],
    queryFn: async ({ signal }) => {
      const res = await api.get(`/email-log/${row.id}`, { params: { entity_type: 'opportunity', entity_id: opportunityId }, signal })
      return unwrap<EmailLogDetail>(res)
    },
    enabled: expanded && row.id != null,
  })
  const party = (isInbound(row.direction) ? row.from : row.to) ?? '—'
  const bodyForbidden = isForbidden(bodyError)

  return (
    <div>
      {/* Full-width structural row (not an action button) - toggles the body below. */}
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- full-width clickable list row (structural, not an action button), mirrors this folder's StatisticsTab row verbatim
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 11px',
          border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer' }}>
        <DirectionPill direction={row.direction} />
        <BodyText as="span" style={{ width: 150, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {party}
        </BodyText>
        <BodyText as="span" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.subject ?? '—'}
        </BodyText>
        <StatusPill status={row.status} />
        <Caption as="span" style={{ flexShrink: 0 }}>{formatDateTime(row.created_at)}</Caption>
      </button>

      {expanded && (
        <div style={{ marginTop: 4, borderRadius: 8, background: 'var(--hover-bg)', padding: '12px 14px' }}>
          {bodyLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Spinner size={12} /> <Caption as="span">{t('email.body.loading')}</Caption>
            </div>
          )}
          {!bodyLoading && bodyError && (
            <Caption as="div" style={bodyForbidden ? undefined : { color: 'var(--color-danger-text)' }}>
              {bodyForbidden ? t('email.body.noAccess') : t('email.body.error')}
            </Caption>
          )}
          {!bodyLoading && !bodyError && (
            <BodyText as="div" style={{ whiteSpace: 'pre-wrap' }}>{detail?.body || '—'}</BodyText>
          )}
        </div>
      )}
    </div>
  )
}

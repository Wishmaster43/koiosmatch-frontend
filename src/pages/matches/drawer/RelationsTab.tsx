/**
 * RelationsTab — the match's three related records (candidate · vacancy · klant),
 * each a hyperlink to that record's own page + drawer (EntityLink → NavigationContext
 * → the hash-router's `{ open: id }` intent — same mechanism as the Klant tab's
 * cross-entity links on Opportunities, and CandidateTab/VacancyTab elsewhere).
 * Read-only: a match is the continuation of an application → placement (§3B), so
 * these relations themselves never change here — only navigated to. EntityLink
 * degrades to plain (unlinked) text when an id is absent, so an older match row
 * without the flat FK never renders a dead link.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import EntityLink from '@/components/ui/EntityLink'
import type { MatchRow } from '@/types/match'

// One read-only field: label above, value below (mirrors OverviewTab's Field).
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-word' }}>{children}</div>
    </div>
  )
}

// Render a plain dash for an empty value — EntityLink itself handles the "no id" case.
const dash = <span style={{ color: 'var(--text-muted)' }}>—</span>

export default function RelationsTab({ match }: { match: MatchRow }) {
  const { t } = useTranslation('matches')

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label={t('drawer.fields.candidate')}>
          {match.candidate && match.candidate !== '—'
            ? <EntityLink page="candidates" id={match.candidateId} title={t('drawer.openCandidate')}>{match.candidate}</EntityLink>
            : dash}
        </Field>
        <Field label={t('drawer.fields.vacancy')}>
          {match.vacancy && match.vacancy !== '—'
            ? <EntityLink page="vacancies" id={match.vacancyId} title={t('drawer.openVacancy')}>{match.vacancy}</EntityLink>
            : dash}
        </Field>
        <Field label={t('drawer.fields.client')}>
          {match.client && match.client !== '—'
            ? <EntityLink page="customers" id={match.clientId} title={t('drawer.openClient')}>{match.client}</EntityLink>
            : dash}
        </Field>
      </div>
    </div>
  )
}

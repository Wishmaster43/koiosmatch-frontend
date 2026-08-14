/**
 * NotesPopoutPage — F5-uitbreiding: the entity-aware dispatcher for every
 * second-screen notes popout. Lives OUTSIDE DashboardLayout (see the route in
 * App.tsx) so this whole browser window can sit on a second monitor next to
 * whatever else a recruiter is working on. Reads `:entity`/`:id` off the URL
 * and renders the matching entity's own thin popout page — CandidateNotesPopout /
 * CustomerNotesPopout / VacancyNotesPopout — each wired to that entity's own
 * lite-identity + notes hooks, mirroring how its drawer wires its Notes tab. An
 * unknown `:entity` segment (a stale/hand-typed URL) shows the same shell's error
 * state instead of a blank screen (§3) — the original candidate-only URL keeps
 * resolving via the legacy alias route (CandidatePopoutRedirect), never this branch.
 */
import type { ComponentType } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PopoutShell from './PopoutShell'
import CandidateNotesPopout from './CandidateNotesPopout'
import CustomerNotesPopout from './CustomerNotesPopout'
import VacancyNotesPopout from './VacancyNotesPopout'
import ApplicationNotesPopout from './ApplicationNotesPopout'
import type { PopoutEntity } from '@/lib/secondScreen'

// One entry per PopoutEntity (secondScreen.ts) — keep the two in sync.
const ENTITY_PAGES: Record<PopoutEntity, ComponentType<{ id: string | undefined }>> = {
  candidate: CandidateNotesPopout,
  customer: CustomerNotesPopout,
  vacancy: VacancyNotesPopout,
  application: ApplicationNotesPopout,
}

// Type guard: narrows the raw `:entity` URL param to a known PopoutEntity.
const isKnownEntity = (v: string | undefined): v is PopoutEntity => !!v && v in ENTITY_PAGES

export default function NotesPopoutPage() {
  const { entity, id } = useParams<{ entity: string; id: string }>()
  const { t } = useTranslation('common')

  // Unknown entity segment — never a blank screen (§3); reload is the only
  // meaningful "retry" for a malformed URL (there is no request to re-issue).
  if (!isKnownEntity(entity)) {
    return (
      <PopoutShell
        loading={false} error onRetry={() => window.location.reload()}
        loadingLabel="" errorLabel={t('popout.unknownEntity')} retryLabel={t('error.retry')}
        name="" initials="" subtitle=""
      >
        {null}
      </PopoutShell>
    )
  }

  const EntityPage = ENTITY_PAGES[entity]
  return <EntityPage id={id} />
}

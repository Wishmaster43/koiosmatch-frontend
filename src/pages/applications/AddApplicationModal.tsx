/**
 * AddApplicationModal — ADDAPPLICATION-TWIN-1: ONE component for both entry
 * points that used to be two independently-maintained implementations
 * (pages/applications/AddApplicationModal.tsx and
 * pages/candidates/drawer/AddApplicationModal.tsx): the applications-page
 * toolbar / vacancy-drawer "+ Sollicitatie" flow (context 'page', the
 * default — picks BOTH a candidate and a vacancy, optionally with
 * `lockedVacancy`) and the candidate-drawer "+ Solliciteren" flow (context
 * 'drawer' — fixed candidateId, picks only a vacancy, supports edit mode).
 *
 * The two contexts differ enough (which entity is picked, edit vs create,
 * panel width, i18n key sets, field layout) that they stay two dedicated
 * render components — addmodal/PageAddApplicationModal and
 * addmodal/DrawerAddApplicationModal — selected by the discriminant below,
 * rather than one branching JSX tree. This file is the ONLY place that owns
 * the choice; every hook and sub-component both variants use now lives under
 * this entity (hooks/, addmodal/). The candidate drawer stays frozen —
 * identical look and behaviour to before the merge (§14 SCHERMWAARHEID-1) —
 * pages/candidates/drawer/AddApplicationModal.tsx is now a thin adapter that
 * renders this component with context="drawer".
 */
import PageAddApplicationModal from './addmodal/PageAddApplicationModal'
import DrawerAddApplicationModal from './addmodal/DrawerAddApplicationModal'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'

// The applications-page-toolbar / vacancy-drawer entry point — unchanged
// prop shape from the original pages/applications/AddApplicationModal.
interface PageContextProps {
  context?: 'page'
  onClose: () => void
  onCreated: (app: Application) => void
  lockedVacancy?: { id: Id; title: string; client?: string }
}

// The candidate-drawer entry point — unchanged prop shape from the original
// pages/candidates/drawer/AddApplicationModal.
interface DrawerContextProps {
  context: 'drawer'
  candidateId: Id
  // OWNER-DEVIATION-1: the candidate's own owner, passed down from the already-
  // loaded drawer record (WorkTab's `c.ownerId`/`c.owner`) — never refetched.
  candidateOwnerId?: Id | null
  candidateOwnerName?: string
  // VACANCY-PREFILL-1: a vacancy already chosen by the caller (e.g. the score panel
  // in VacancySearchTab) — seeds the picker once, still freely changeable.
  initialVacancyId?: Id
  // KOIOS-VOORSTEL-1 (Danny 13-08): vacancy Koios suggests from the candidate's
  // history — seeds the picker AND shows the Koios mark while it still holds
  // initialVacancyId (score panel: user clicked THAT vacancy) stays badge-less:
  // explicit context is the user's own choice, not a proposal.
  suggestedVacancyId?: Id | null
  // Punt 5: set from an application row's pencil — prefill + PATCH instead of POST.
  editApplicationId?: Id
  onClose: () => void
  onCreated: () => void
}

export type AddApplicationModalProps = PageContextProps | DrawerContextProps

// The candidate-drawer entry point's own props, sans the `context` discriminant
// (DrawerAddApplicationModal and the candidate-drawer thin adapter each declared
// this exact object type inline — export it once here, §2 barrel rule).
export type DrawerAddApplicationModalProps = Omit<DrawerContextProps, 'context'>

// Dispatch on `context` — a discriminated union keeps each entry point's own
// props (and TS narrowing) exactly as strict as before the merge.
export default function AddApplicationModal(props: AddApplicationModalProps) {
  if (props.context === 'drawer') return <DrawerAddApplicationModal {...props} />
  return <PageAddApplicationModal {...props} />
}

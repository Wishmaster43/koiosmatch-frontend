/**
 * CandidatePopoutRedirect — legacy alias for the originally shipped candidate-only
 * popout URL (`/popout/notes/:candidateId`, pre F5-uitbreiding). Redirects to the
 * new entity-aware route (`/popout/notes/candidate/:candidateId`) so an already-
 * open OS window or a bookmarked link from before this change keeps resolving
 * instead of ever 404ing — "never break the shipped candidate URL".
 */
import { Navigate, useParams } from 'react-router-dom'

// Legacy-URL redirect to the entity-aware route, so an already-open window or bookmarked link keeps resolving (see file header).
export default function CandidatePopoutRedirect() {
  const { candidateId } = useParams<{ candidateId: string }>()
  return <Navigate to={`/popout/notes/candidate/${candidateId}`} replace />
}

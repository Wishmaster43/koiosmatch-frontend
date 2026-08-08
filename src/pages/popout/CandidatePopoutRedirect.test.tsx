/**
 * CandidatePopoutRedirect — proves the legacy candidate-only popout URL still
 * resolves: it redirects to the new entity-aware route with the SAME candidate
 * id, so a bookmarked link or an already-open OS window from before F5-uitbreiding
 * never breaks (§13: assert the actual navigation target, not just "it rendered").
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import CandidatePopoutRedirect from './CandidatePopoutRedirect'

// Renders the pathname it lands on, so the test can assert the REDIRECT TARGET
// (not just that some route matched).
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="landed">{location.pathname}</div>
}

describe('CandidatePopoutRedirect', () => {
  it('redirects the legacy /popout/notes/:candidateId URL to /popout/notes/candidate/:id', () => {
    render(
      <MemoryRouter initialEntries={['/popout/notes/cand-1']}>
        <Routes>
          <Route path="/popout/notes/:candidateId" element={<CandidatePopoutRedirect />} />
          <Route path="/popout/notes/:entity/:id" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByTestId('landed')).toHaveTextContent('/popout/notes/candidate/cand-1')
  })
})

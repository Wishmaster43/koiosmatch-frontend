/**
 * Recent-list tiles (DASH-PAIRS-1) — each list renders its viewmodel rows and
 * deep-links exactly where the old rows did; the registry entries read their
 * rows from ctx.lists and self-hide when empty.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecentCandidatesList, RecentApplicationsList, LeadsPipelineList, RecentRunsList, RecentConversationsList } from './RecentLists'
import { LIST_TILES, leadsPipelineTile } from './index'
import type { DashData } from '@/types/dashboard'
import type { FeedTileLists } from '../feedTileKit'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const emptyLists: FeedTileLists = {
  recentCandidates: [], recentApplications: [], recentLeads: [], runs: [], conversations: [],
  expiringMatchesRows: [], staleVacanciesRows: [], koiosSuggestionsRows: [],
}

describe('recent-list tiles', () => {
  it('a candidate row opens the candidate; an application row opens the application', () => {
    const onNavigate = vi.fn()
    render(<RecentCandidatesList rows={[{ id: 'c1', name: 'Anna', initials: 'A', role: 'Nurse', status: 'Beschikbaar', statusColor: 'var(--color-success)', time: '1u' }]} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Anna').closest('[role="button"]')!)
    expect(onNavigate).toHaveBeenCalledWith('candidates', { open: 'c1' })

    render(<RecentApplicationsList rows={[{ id: 'a1', candidate: 'Bram', vacancy: 'Chauffeur', status: 'Nieuw', statusColor: 'var(--color-primary)', time: '2u' }]} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Bram').closest('[role="button"]')!)
    expect(onNavigate).toHaveBeenCalledWith('applications', { open: 'a1' })
  })

  it('a lead opens the customer; a run opens workflows; a conversation opens the WhatsApp messages tab', () => {
    const onNavigate = vi.fn()
    render(<LeadsPipelineList rows={[{ id: 'k1', name: 'Acme', contact: 'Piet', status: 'Lead', statusColor: 'var(--color-secondary)', time: '3u' }]} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Acme').closest('[role="button"]')!)
    expect(onNavigate).toHaveBeenCalledWith('customers', { open: 'k1' })

    render(<RecentRunsList rows={[{ name: 'Nightly', time: '4u', ok: true, n: 3, err: undefined }]} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Nightly').closest('[role="button"]')!)
    expect(onNavigate).toHaveBeenCalledWith('workflows')
    expect(screen.getByText('run.processed')).toBeInTheDocument()

    render(<RecentConversationsList rows={[{ name: 'Kees Klant', msg: 'Hoi', time: '5u' }]} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Kees Klant').closest('[role="button"]')!)
    expect(onNavigate).toHaveBeenCalledWith('whatsapp', { tab: 'messages' })
  })

  it('rows without a navigator are plain rows (no role=button)', () => {
    render(<RecentCandidatesList rows={[{ id: 'c1', name: 'Anna', initials: 'A', role: 'Nurse', status: 'x', statusColor: 'var(--text)', time: '1u' }]} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('LIST_TILES registry', () => {
  it('lists the KD11 widgets first, then the five recent lists', () => {
    expect(LIST_TILES.map(e => e.blockId)).toEqual([
      'block.expiringMatches', 'block.staleVacancies', 'block.koiosSuggestions',
      'list.candidates', 'list.applications', 'list.leads', 'list.runs', 'list.conversations',
    ])
  })

  it('every entry self-hides without rows and shows with rows (rows come from ctx.lists, not dash)', () => {
    const dash = {} as DashData
    for (const entry of LIST_TILES) {
      expect(entry.hasData(dash, { hasPlanning: false, lists: emptyLists })).toBe(false)
      expect(entry.hasData(dash, { hasPlanning: false })).toBe(false)
    }
    expect(leadsPipelineTile.hasData(dash, { hasPlanning: false, lists: { ...emptyLists, recentLeads: [{ id: 'k1', name: 'Acme', contact: '', status: '', statusColor: '', time: '' }] } })).toBe(true)
  })
})

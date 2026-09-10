/**
 * SearchSummaryCardFrame — behaviour (slot order, action/pager/close wiring,
 * conditional score/AI-advice blocks) plus BYTE-IDENTITY proof (rule F, DRY
 * round 11 SEARCHTABS): the frame's render is compared against the HISTORICAL
 * shape assembled BY HAND from the exact same shared atoms (DrillPager, Button,
 * StatusPill, MatchScoreBlock, KoiosAiMark, Caption, SectionTitle) that both
 * VacancySearchSummaryCard.tsx and CandidateSearchTab.tsx used before this
 * extraction — proven via react-dom/server (never jsdom, which would expand
 * inline-style shorthand and hide a hidden key-order drift). Mirrors the
 * MATCHLISTS pattern (d0dd723f, MatchListBody.test.tsx / DrawerSearchField.test.tsx):
 * pinned expectations built from real atoms, never a test that shells out to
 * git or writes into src (that both breaks the moment this patch lands — HEAD
 * then IS the new code — and risks leaving generated files behind on a crash).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { X } from 'lucide-react'
import DrillPager from './DrillPager'
import Button from '@/components/ui/Button'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import StatusPill from '@/components/ui/StatusPill'
import MatchScoreBlock from '@/components/match/MatchScoreBlock'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import EntityLink from '@/components/ui/EntityLink'
import { Caption, SectionTitle } from '@/components/ui/typography'
// Real i18next instance: DrillPager/MatchScoreBlock/DrawerAddButton all call
// useTranslation() internally.
import '@/i18n'
import SearchSummaryCardFrame from './SearchSummaryCardFrame'

// ---------------------------------------------------------------------------
// Behaviour
// ---------------------------------------------------------------------------

describe('SearchSummaryCardFrame · behaviour', () => {
  const baseProps = {
    title: 'Vacancy title', subtitle: 'Customer · City',
    index: 1, total: 3, onPrev: undefined, onNext: undefined,
    onClose: vi.fn(), closeLabel: 'Close',
    chips: <span>chip-content</span>,
    score: null as number | null, criteria: [], aiAdviceReason: null as string | null, aiAdvisedLabel: 'AI advised',
  }

  it('renders header (title/subtitle), then chips, then extra, then description, then the score block, in that DOM order', () => {
    const { container } = render(
      <SearchSummaryCardFrame {...baseProps}
        extra={<div>extra-block</div>}
        description={<p>description-text</p>}
        score={80} criteria={[]} />
    )
    const html = container.innerHTML
    expect(html.indexOf('Vacancy title')).toBeLessThan(html.indexOf('chip-content'))
    expect(html.indexOf('chip-content')).toBeLessThan(html.indexOf('extra-block'))
    expect(html.indexOf('extra-block')).toBeLessThan(html.indexOf('description-text'))
    expect(html.indexOf('description-text')).toBeLessThan(html.indexOf('80%'))
  })

  it('renders nothing for action/extra/description when the caller omits them', () => {
    render(<SearchSummaryCardFrame {...baseProps} />)
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull()
    expect(screen.queryByText('extra-block')).toBeNull()
    expect(screen.queryByText('description-text')).toBeNull()
  })

  it('renders the action slot when given (e.g. a gated apply button)', () => {
    render(<SearchSummaryCardFrame {...baseProps} action={<button aria-label="Apply">Apply</button>} />)
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<SearchSummaryCardFrame {...baseProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('wires onPrev/onNext into the pager — undefined disables the matching button, a handler fires on click', () => {
    const onNext = vi.fn()
    render(<SearchSummaryCardFrame {...baseProps} onPrev={undefined} onNext={onNext} index={2} total={3} />)
    const prevBtn = screen.getByTitle(/Vorige|Prev/i)
    const nextBtn = screen.getByTitle(/Volgende|Next/i)
    expect(prevBtn).toBeDisabled()
    expect(nextBtn).not.toBeDisabled()
    fireEvent.click(nextBtn)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('renders the read-only score block only when score is not null', () => {
    const { rerender } = render(<SearchSummaryCardFrame {...baseProps} score={null} />)
    expect(screen.queryByText('75%')).toBeNull()
    rerender(<SearchSummaryCardFrame {...baseProps} score={75} criteria={[]} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders the AI-advice line only when aiAdviceReason is set, using the resolved label as the mark title', () => {
    const { rerender } = render(<SearchSummaryCardFrame {...baseProps} aiAdviceReason={null} />)
    expect(screen.queryByText('Good fit for the role')).toBeNull()
    rerender(<SearchSummaryCardFrame {...baseProps} aiAdviceReason="Good fit for the role" aiAdvisedLabel="AI says" />)
    expect(screen.getByText('Good fit for the role')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'AI says' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Byte-identity (rule F) — pinned expectations assembled from the SAME atoms,
// in the SAME shape, both consumers' pre-refactor JSX rendered (mirrors
// MatchListBody.test.tsx's own method, never git/fs).
// ---------------------------------------------------------------------------

describe('SearchSummaryCardFrame · byte-identical shell (rule F)', () => {
  // Vacancy shape (VacancySearchSummaryCard.tsx, candidate drawer, FROZEN
  // screen): header + chips + the vacancy-only extra/description blocks +
  // score + AI-advice — the shell HEAD's own inline card used before extraction.
  it('matches the historical vacancy-card shape (title/subtitle/chips/extra/description/score/AI-advice)', () => {
    const headMarkup = renderToStaticMarkup(
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <SectionTitle as="div">
              <EntityLink page="vacancies" id="v1">Verpleegkundige</EntityLink>
            </SectionTitle>
            <Caption as="div">Yesway · Utrecht</Caption>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <DrillPager index={1} total={2} onPrev={undefined} onNext={() => {}} />
              <Button variant="ghost" iconOnly size="sm" onClick={() => {}} aria-label="Close">
                <X size={14} />
              </Button>
            </div>
            <DrawerAddButton onClick={() => {}} label="Apply" />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>chips</span>
        </div>
        <div>extra-block</div>
        <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>A description.</p>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <MatchScoreBlock score={80} criteria={[]} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
          <KoiosAiMark size={16} title="AI advised" />
          <span>Good fit</span>
        </div>
      </div>
    )
    const newMarkup = renderToStaticMarkup(
      <SearchSummaryCardFrame
        title={<EntityLink page="vacancies" id="v1">Verpleegkundige</EntityLink>}
        subtitle="Yesway · Utrecht"
        index={1} total={2} onPrev={undefined} onNext={() => {}}
        onClose={() => {}} closeLabel="Close"
        action={<DrawerAddButton onClick={() => {}} label="Apply" />}
        chips={<span>chips</span>}
        extra={<div>extra-block</div>}
        description={<p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>A description.</p>}
        score={80} criteria={[]}
        aiAdviceReason="Good fit" aiAdvisedLabel="AI advised"
      />
    )
    expect(newMarkup).toBe(headMarkup)
  })

  // Candidate shape (CandidateSearchTab.tsx's inline card, vacancy drawer): the
  // same header/pager/close/score/AI-advice shell, but NO extra/description
  // slot (candidate rows carry no salary/experience/description fields) —
  // proves the frame renders nothing for the slots this shape never fills.
  it('matches the historical candidate-card shape (title/subtitle/chips/score/AI-advice, no extra/description)', () => {
    const headMarkup = renderToStaticMarkup(
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <SectionTitle as="div">
              <EntityLink page="candidates" id="c1">Alice</EntityLink>
            </SectionTitle>
            <Caption as="div">Verzorgende IG · Amersfoort</Caption>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <DrillPager index={1} total={2} onPrev={undefined} onNext={() => {}} />
              <Button variant="ghost" iconOnly size="sm" onClick={() => {}} aria-label="Close">
                <X size={14} />
              </Button>
            </div>
            <DrawerAddButton onClick={() => {}} label="Apply" />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <StatusPill label="Beschikbaar" color="var(--color-success)" />
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <MatchScoreBlock score={82} criteria={[]} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
          <KoiosAiMark size={16} title="AI advised" />
          <span>Sterke fit qua ervaring.</span>
        </div>
      </div>
    )
    const newMarkup = renderToStaticMarkup(
      <SearchSummaryCardFrame
        title={<EntityLink page="candidates" id="c1">Alice</EntityLink>}
        subtitle="Verzorgende IG · Amersfoort"
        index={1} total={2} onPrev={undefined} onNext={() => {}}
        onClose={() => {}} closeLabel="Close"
        action={<DrawerAddButton onClick={() => {}} label="Apply" />}
        chips={<StatusPill label="Beschikbaar" color="var(--color-success)" />}
        score={82} criteria={[]}
        aiAdviceReason="Sterke fit qua ervaring." aiAdvisedLabel="AI advised"
      />
    )
    expect(newMarkup).toBe(headMarkup)
  })
})

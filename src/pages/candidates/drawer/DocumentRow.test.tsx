/**
 * DocumentRow — DOC-LIST-LINK-1 (Danny 08-08): the row shows its resolved
 * education/certification/language/skill link as a soft chip (no link = no chip,
 * point 1) and can open the inline "Koppelen aan" picker to change/clear it
 * (point 2). This file covers the PURELY PRESENTATIONAL contract (props in,
 * markup out); the actual PATCH requests live in DocumentsSection and are
 * asserted there (§13 — request, not just a fired callback).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentRow from './DocumentRow'
import type { DocItem } from './documentHelpers'

vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})`, locale: 'nl-NL' }),
}))

// Minimal, fully-specified default props — every test overrides only what it needs,
// so a prop added later never silently leaves another test half-configured.
const baseDoc: DocItem = { id: 'doc1', name: 'diploma.pdf', type: 'Diploma', size: '10 KB', url: '/x' }
// eslint-disable-next-line no-restricted-syntax -- mock fixture DATA (a fake doc-type colour), not UI styling; mirrors DocumentsSection.test.tsx's colorOf stub.
const FIXTURE_DOC_COLOR = '#4F46E5'
const defaultProps = {
  d: baseDoc,
  selected: false,
  downloadable: true,
  onToggleSelect: vi.fn(),
  canManage: true,
  renaming: false,
  renameValue: '',
  onRenameStart: vi.fn(),
  onRenameChange: vi.fn(),
  onRenameCommit: vi.fn(),
  onRenameCancel: vi.fn(),
  onReplace: vi.fn(),
  onPreview: vi.fn(),
  onDeleteRequest: vi.fn(),
  docColor: () => FIXTURE_DOC_COLOR,
  docTypeLabel: (v?: string) => v ?? '',
  docTypeIcon: undefined,
  linked: null,
  linking: false,
  linkValue: '',
  canLink: true,
  onLinkToggle: vi.fn(),
  onLinkChange: vi.fn(),
  educations: [{ id: 'e1', title: 'Verpleegkunde' }],
  certifications: [{ id: 'cert1', name: 'VCA Basis' }],
  languages: [],
  skills: [],
  references: [],
}

describe('DocumentRow · DOC-LIST-LINK-1 link chip (no link = no chip)', () => {
  it('renders no chip and no tooltip when the row has no link', () => {
    render(<DocumentRow {...defaultProps} linked={null} />)
    expect(screen.queryByTitle('documents.linkedTo')).not.toBeInTheDocument()
  })

  it('renders the linked entry\'s OWN label as the chip text', () => {
    render(<DocumentRow {...defaultProps} linked={{ kind: 'education', id: 'e1', label: 'Verpleegkunde' }} />)
    expect(screen.getByText('Verpleegkunde')).toBeInTheDocument()
  })

  it('renders the grouped kind + label as the chip tooltip (mirrors the picker\'s own "<Group> · <label>" format)', () => {
    render(<DocumentRow {...defaultProps} linked={{ kind: 'certification', id: 'cert1', label: 'VCA Basis' }} />)
    expect(screen.getByTitle('documents.linkedTo')).toBeInTheDocument()
  })

  // REFERENTIE-VELDEN-1: same chip mechanic, extended to references — the chip
  // text is the referent's OWN composed name (never their internal id).
  it('renders the referent\'s composed name as the chip text for a reference link', () => {
    render(<DocumentRow {...defaultProps} linked={{ kind: 'reference', id: 'ref1', label: 'Jan de Vries' }} />)
    expect(screen.getByText('Jan de Vries')).toBeInTheDocument()
  })
})

describe('DocumentRow · DOC-LIST-LINK-1 change-link control', () => {
  it('hides the control entirely when canLink is false (no fake affordance)', () => {
    render(<DocumentRow {...defaultProps} canLink={false} />)
    expect(screen.queryByRole('button', { name: 'documents.changeLink' })).not.toBeInTheDocument()
  })

  it('hides the control without candidates.documents.manage', () => {
    render(<DocumentRow {...defaultProps} canManage={false} />)
    expect(screen.queryByRole('button', { name: 'documents.changeLink' })).not.toBeInTheDocument()
  })

  it('shows the control when manageable and there is something to link to', () => {
    render(<DocumentRow {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'documents.changeLink' })).toBeInTheDocument()
  })

  it('fires onLinkToggle when clicked', async () => {
    const user = userEvent.setup()
    const onLinkToggle = vi.fn()
    render(<DocumentRow {...defaultProps} onLinkToggle={onLinkToggle} />)
    await user.click(screen.getByRole('button', { name: 'documents.changeLink' }))
    expect(onLinkToggle).toHaveBeenCalledTimes(1)
  })

  it('swaps the chip for the inline "Koppelen aan" picker while linking, and hides the static chip', () => {
    render(<DocumentRow {...defaultProps} linked={{ kind: 'education', id: 'e1', label: 'Verpleegkunde' }} linking />)
    // The picker's own trigger is present (G34 house SelectMenu, not a native <select>).
    expect(screen.getByRole('button', { name: /documents\.linkToFor/ })).toBeInTheDocument()
    // The static chip is replaced, not duplicated, while editing.
    expect(screen.queryByTitle('documents.linkedTo')).not.toBeInTheDocument()
  })
})

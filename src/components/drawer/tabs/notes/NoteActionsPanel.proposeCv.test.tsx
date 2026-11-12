/**
 * NoteActionsPanel · proposal CV (CVPICK-NITS-1): the picker shows on a pending propose row
 * without the pencil, and the pick reaches the execute request with the application id.
 */
import { useState } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoteActionsPanel from './NoteActionsPanel'
import type { NoteActionPanelItem } from './NoteActionsPanel'
import { executeRichTextActions } from '@/components/ui/richtext/assistActionsExecuteApi'

// Stateful host, like the real composer (the panel is controlled).
function Controlled({ initial }: { initial: NoteActionPanelItem[] }) {
  const [items, setItems] = useState(initial)
  return <NoteActionsPanel items={items} onItemsChange={setItems} />
}

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL', en: 'en-GB' } }))
vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (n: number) => String(n) }) }))
// The ensure hook is stubbed the house way (as NoteActionsPanel.test.tsx does); the picked CV means it is never needed here.
vi.mock('@/components/ui/richtext/useEnsureProposalCv', () => ({ useEnsureProposalCv: () => ({ ensureProposalCv: vi.fn(), preparingFor: null, error: null }) }))
// The docs hook is mocked, the picker itself renders for real.
const cvDocsMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/richtext/useProposalCvDocuments', () => ({ useProposalCvDocuments: cvDocsMock }))
vi.mock('@/components/ui/richtext/assistActionsExecuteApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/richtext/assistActionsExecuteApi')>()
  return { ...actual, executeRichTextActions: vi.fn() }
})

beforeEach(() => cvDocsMock.mockReturnValue({ docs: [{ id: 'd1', label: 'CV - Jan.pdf', uploadedAt: null }], loading: false, error: false }))
afterEach(() => vi.clearAllMocks())

const proposal: NoteActionPanelItem = {
  title: 'Stel voor', type: 'application_propose', due_date: null, note_excerpt: null,
  status: 'pending', link_type: 'application', link_id: 'a1',
}

describe('NoteActionsPanel · proposal CV picker', () => {
  it('shows the picker without the pencil and sends cv_document_id + application_id on confirm', async () => {
    const user = userEvent.setup()
    vi.mocked(executeRichTextActions).mockResolvedValue([{ title: 'Stel voor', type: 'application_propose', status: 'executed' }])
    render(<Controlled initial={[proposal]} />)
    // Visible while pending, no pencil click needed; the row hands over its application id.
    expect(cvDocsMock).toHaveBeenCalledWith('a1', undefined)
    await user.click(screen.getByRole('button', { name: /notesAssist.proposeCv.placeholder/ }))
    await user.click(await screen.findByText('CV - Jan.pdf'))
    await user.click(screen.getByRole('button', { name: 'notesAssist.panel.confirm' }))
    expect(executeRichTextActions).toHaveBeenLastCalledWith(
      [expect.objectContaining({ confirmed: true, cv_document_id: 'd1', application_id: 'a1' })],
      {},
    )
  })

  it('renders no picker on a declined propose row', () => {
    render(<Controlled initial={[{ ...proposal, status: 'declined' }]} />)
    expect(screen.queryByRole('button', { name: /notesAssist.proposeCv.placeholder/ })).toBeNull()
  })

  it('renders no picker on a propose row without link_id', () => {
    render(<Controlled initial={[{ ...proposal, link_type: undefined, link_id: undefined }]} />)
    expect(screen.queryByRole('button', { name: /notesAssist.proposeCv.placeholder/ })).toBeNull()
  })
})

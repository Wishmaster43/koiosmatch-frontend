/**
 * MergeCandidateModal — behaviour: search → pick duplicate → survivor choice →
 * POST /candidates/{survivor}/merge with the OTHER id as source; onMerged gets
 * the survivor id. The swap case (other record remains) is the regression that
 * matters: survivor/source must invert together.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Real i18n (nl) side-effect init so t() resolves genuine Dutch text (mirrors SectionTabs.test).
import '@/i18n'
import MergeCandidateModal from './MergeCandidateModal'

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { get: getMock, post: postMock },
  unwrapList: (res: { data: { data: unknown[] } }) => ({ rows: res.data.data, total: res.data.data.length, lastPage: 1 }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const current = { id: 'aaa', name: 'Anna Huidig', code: 'K-1', email: 'anna@x.nl' }
const dupRow = { id: 'bbb', name: 'Anna Dubbel', reference_number: 'K-2', email: 'dup@x.nl' }

function mount(onMerged = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MergeCandidateModal current={current} onClose={vi.fn()} onMerged={onMerged} />
    </QueryClientProvider>
  )
  return onMerged
}

// Type in the search box and wait for the debounced result row.
async function searchAndPick() {
  getMock.mockResolvedValue({ data: { data: [dupRow, { ...dupRow, id: 'aaa' }] } })
  fireEvent.change(screen.getByPlaceholderText(/zoek op naam/i), { target: { value: 'anna' } })
  const row = await screen.findByText('Anna Dubbel', undefined, { timeout: 2000 })
  fireEvent.click(row)
}

describe('MergeCandidateModal', () => {
  beforeEach(() => { getMock.mockReset(); postMock.mockReset() })

  it('excludes the open candidate from search results and shows survivor cards after picking', async () => {
    mount()
    await searchAndPick()
    // the open candidate (id aaa) came back from the API but must not be listed twice
    expect(screen.getByText('Anna Huidig')).toBeTruthy()
    expect(screen.getByText(/dit dossier blijft/i)).toBeTruthy()
  })

  it('merges INTO the open candidate by default (survivor=current, source=other)', async () => {
    postMock.mockResolvedValue({ data: {} })
    const onMerged = mount()
    await searchAndPick()
    fireEvent.click(screen.getByRole('button', { name: /^samenvoegen$/i }))
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/candidates/aaa/merge', { source_id: 'bbb' }))
    expect(onMerged).toHaveBeenCalledWith('aaa')
  })

  it('swaps survivor and source when the other record is chosen to remain', async () => {
    postMock.mockResolvedValue({ data: {} })
    const onMerged = mount()
    await searchAndPick()
    // click the OTHER card to make it the survivor
    fireEvent.click(screen.getByText('Anna Dubbel'))
    fireEvent.click(screen.getByRole('button', { name: /^samenvoegen$/i }))
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/candidates/bbb/merge', { source_id: 'aaa' }))
    expect(onMerged).toHaveBeenCalledWith('bbb')
  })

  it('keeps the modal open and reports the error on a failed merge', async () => {
    postMock.mockRejectedValue({ response: { status: 500 } })
    const onMerged = mount()
    await searchAndPick()
    fireEvent.click(screen.getByRole('button', { name: /^samenvoegen$/i }))
    await waitFor(() => expect(postMock).toHaveBeenCalled())
    expect(onMerged).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})

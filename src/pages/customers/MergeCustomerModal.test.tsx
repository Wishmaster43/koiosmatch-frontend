/**
 * MergeCustomerModal — behaviour: search (excluding the open record) → pick the
 * duplicate → confirm → POST /customers/{DUPLICATE}/merge { target_customer_id:
 * OPEN_RECORD }. The route direction is the regression that matters most here: it is
 * INVERTED relative to the candidate merge (candidates/{SURVIVOR}/merge {source_id}),
 * so a copy-paste of that call shape would delete the record the user opened instead
 * of the duplicate they picked.
 *
 * `react-i18next` is mocked to the identity function (t => key) rather than relying on
 * the real locale files — the new `customers:merge.*` keys are added to the locale
 * JSON by the reviewing lane, not this file, so asserting on real translated copy would
 * be a false negative until that lands (mirrors useCustomerContacts.test.ts's mock).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MergeCustomerModal from './MergeCustomerModal'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }) }))

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }))
vi.mock('@/lib/api', () => ({
  default: { get: getMock, post: postMock },
  unwrapList: (res: { data: { data: unknown[] } }) => ({ rows: res.data.data, total: res.data.data.length, lastPage: 1 }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const current = { id: 'aaa', name: 'Acme Actueel', code: 'D-1', city: 'Utrecht' }
const dupRow = { id: 'bbb', name: 'Acme Dubbel', reference_number: 'D-2', city: 'Amsterdam' }

function mount(onMerged = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MergeCustomerModal current={current} onClose={vi.fn()} onMerged={onMerged} />
    </QueryClientProvider>
  )
  return onMerged
}

// Type in the search box and wait for the debounced result row.
async function searchAndPick() {
  getMock.mockResolvedValue({ data: { data: [dupRow, { ...dupRow, id: 'aaa' }] } })
  fireEvent.change(screen.getByPlaceholderText('merge.searchPlaceholder'), { target: { value: 'acme' } })
  const row = await screen.findByText('Acme Dubbel', undefined, { timeout: 2000 })
  fireEvent.click(row)
}

describe('MergeCustomerModal', () => {
  beforeEach(() => { getMock.mockReset(); postMock.mockReset() })

  it('excludes the open customer from search results and shows the honest survivor summary', async () => {
    mount()
    await searchAndPick()
    // The open customer (id aaa) came back from the API alongside the real duplicate
    // but must never be offered as a pick — only one "Acme" row is clickable in step 1,
    // and step 2 now shows both cards labelled by their fixed role, not a choice.
    expect(screen.getByText(current.name)).toBeTruthy()
    expect(screen.getByText('merge.staysLabel')).toBeTruthy()
    expect(screen.getByText('merge.duplicateLabel')).toBeTruthy()
  })

  it('posts the merge with the duplicate in the path and the open record as target_customer_id', async () => {
    postMock.mockResolvedValue({ data: {} })
    const onMerged = mount()
    await searchAndPick()
    fireEvent.click(screen.getByRole('button', { name: /^merge\.confirm$/ }))
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/customers/bbb/merge', { target_customer_id: 'aaa' }))
    expect(onMerged).toHaveBeenCalledTimes(1)
  })

  it('keeps the modal open and does not call onMerged on a failed merge', async () => {
    postMock.mockRejectedValue({ response: { status: 500 } })
    const onMerged = mount()
    await searchAndPick()
    fireEvent.click(screen.getByRole('button', { name: /^merge\.confirm$/ }))
    await waitFor(() => expect(postMock).toHaveBeenCalled())
    expect(onMerged).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('never lists the open record itself as a pickable duplicate', async () => {
    mount()
    getMock.mockResolvedValue({ data: { data: [{ ...current, reference_number: current.code }] } })
    fireEvent.change(screen.getByPlaceholderText('merge.searchPlaceholder'), { target: { value: 'acme' } })
    // The API returned exactly one row (the open record itself); the in-memory self-filter
    // must drop it, leaving the empty-results state rather than an offerable self-merge.
    await screen.findByText('merge.noResults', undefined, { timeout: 2000 })
  })
})

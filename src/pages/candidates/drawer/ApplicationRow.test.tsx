/**
 * ApplicationRow — the candidate drawer's application row, now with the SAME
 * disclosure MatchCard's compact mode has (Danny 09-08). Real i18n is loaded (the
 * MatchesTab.test convention): a raw-key stub would assert against text that never
 * renders. Keys still missing from the locale files resolve to the key itself on
 * BOTH sides of the assertion, so these tests hold before and after they land.
 *
 * The detail panel's request is asserted by ROUTE (§13: a test that never touches
 * the seam proves nothing about the seam) — GET /applications/{id}, made on first
 * expand and never for a collapsed row.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ApplicationRow from './ApplicationRow'
import api from '@/lib/api'
import type { AppRow } from './applicationRowModel'
import type { Id } from '@/types/common'

const ct = (key: string) => i18n.t(key, { ns: 'candidates' })

// The application DETAIL body, copied from the live measurement of
// GET /applications/019fe2df-… (S-00047) — only the fields this panel reads.
const detail = {
  client_name: 'Inovum',
  phase_label: 'Intake',
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  phase_color: '#8B5CF6',
  owner: { name: 'Kelly Yesway' },
  created_at: '2026-08-08T19:35:55+00:00',
  reference_number: 'S-00047',
}

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: detail } })) },
  unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
}))
// Cross-entity navigation is spied, never really performed.
const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))
const { rememberReturnTab } = vi.hoisted(() => ({ rememberReturnTab: vi.fn() }))
vi.mock('./constants', () => ({ rememberReturnTab }))

const row: AppRow = { id: 'app-1', vacancy: { id: 'vac-1', title: 'Activiteitenbegeleider', url: 'https://example.test/vacancy' }, stageLabel: 'Intake', created_at: '2026-08-08T19:35:55+00:00' }

const onEdit = vi.fn()
const onDetach = vi.fn()
const onEditAppointment = vi.fn()

// Default: a recruiter with BOTH permissions (chevron + pencil/unlink visible).
const renderRow = (props: Partial<Parameters<typeof ApplicationRow>[0]> = {}) => render(
  <ApplicationRow candidateId={'cand-1' as Id} row={row} canManage canView
    onEdit={onEdit} onDetach={onDetach} onEditAppointment={onEditAppointment} {...props} />
)

const chevron = () => screen.getByRole('button', { name: ct('work.showDetails') })

beforeEach(() => {
  vi.mocked(api.get).mockClear()
  openEntity.mockClear(); onEdit.mockClear(); onDetach.mockClear(); rememberReturnTab.mockClear()
})

describe('ApplicationRow · expand/collapse (mirrors MatchCard)', () => {
  it('starts COLLAPSED — no panel, aria-expanded=false, and no detail request', () => {
    renderRow()
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('expands on click: aria-expanded flips, the panel appears and GET /applications/{id} fires', async () => {
    const user = userEvent.setup()
    renderRow()
    await user.click(chevron())
    expect(api.get).toHaveBeenCalledWith('/applications/app-1')
    const toggle = screen.getByRole('button', { name: ct('work.hideDetails') })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    // The button owns the panel it reveals (§6) — the arrow is not the only signal.
    expect(screen.getByRole('region')).toHaveAttribute('id', toggle.getAttribute('aria-controls'))
  })

  it('shows the measured detail fields once loaded', async () => {
    const user = userEvent.setup()
    renderRow()
    await user.click(chevron())
    expect(await screen.findByText('Inovum')).toBeInTheDocument()
    expect(screen.getByText(ct('work.client'))).toBeInTheDocument()
    expect(screen.getByText('Kelly Yesway')).toBeInTheDocument()
    expect(screen.getByText('S-00047')).toBeInTheDocument()
  })

  it('collapses again, hiding the panel', async () => {
    const user = userEvent.setup()
    renderRow()
    await user.click(chevron())
    await screen.findByText('Inovum')
    await user.click(screen.getByRole('button', { name: ct('work.hideDetails') }))
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('omits a field the payload does not carry (vacancy-less application: client_name null)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { ...detail, client_name: null } } } as never)
    const user = userEvent.setup()
    renderRow()
    await user.click(chevron())
    await screen.findByText('Kelly Yesway')
    // No dash-filled "Klant" row — the label itself must be absent.
    expect(screen.queryByText(ct('work.client'))).not.toBeInTheDocument()
  })

  it('shows the rejection reason only when the application carries one', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { ...detail, rejection: { reason_label: 'Te weinig ervaring' } } } } as never)
    const user = userEvent.setup()
    renderRow()
    await user.click(chevron())
    expect(await screen.findByText('Te weinig ervaring')).toBeInTheDocument()
    expect(screen.getByText(ct('work.rejectionReason'))).toBeInTheDocument()
  })

  it('surfaces a failed detail load instead of an empty panel', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    renderRow()
    await user.click(chevron())
    expect(await screen.findByText(ct('work.detailsError'))).toBeInTheDocument()
  })

  it('offers NO chevron without applications.view (GET /applications/{id} would 403)', () => {
    renderRow({ canView: false })
    expect(screen.queryByRole('button', { name: ct('work.showDetails') })).not.toBeInTheDocument()
  })
})

describe('ApplicationRow · the existing row actions keep working', () => {
  it('the title still opens the APPLICATION in-app and does NOT toggle the row', async () => {
    const user = userEvent.setup()
    renderRow()
    await user.click(screen.getByRole('button', { name: 'Activiteitenbegeleider' }))
    expect(openEntity).toHaveBeenCalled()
    expect(rememberReturnTab).toHaveBeenCalledWith('cand-1', 'work')
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
  })

  it('the pencil still edits the application and does NOT toggle the row', async () => {
    const user = userEvent.setup()
    renderRow()
    await user.click(screen.getByRole('button', { name: ct('work.editApplication') }))
    expect(onEdit).toHaveBeenCalledWith('app-1')
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
    expect(api.get).not.toHaveBeenCalled()
  })

  it('the unlink still detaches the application and does NOT toggle the row', async () => {
    const user = userEvent.setup()
    renderRow()
    await user.click(screen.getByRole('button', { name: ct('work.detachApplication') }))
    expect(onDetach).toHaveBeenCalledWith(row)
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
  })

  it("keeps the vacancy's own external link", () => {
    renderRow()
    expect(screen.getByRole('link', { name: ct('work.openVacancy') })).toHaveAttribute('href', 'https://example.test/vacancy')
  })

  it('clicking the row body itself toggles (mouse convenience on top of the button)', async () => {
    const user = userEvent.setup()
    renderRow()
    // The stage pill is inert text inside the row — the click bubbles to the row.
    await user.click(screen.getByText('Intake'))
    await waitFor(() => expect(screen.getByRole('button', { name: ct('work.hideDetails') })).toHaveAttribute('aria-expanded', 'true'))
  })
})

/**
 * Danny 09-08: the unlink button used a SOLID `--color-danger-bg` fill with no
 * border, standing out next to the borderless pencil right beside it. Now the
 * real §4 soft-tint (background color-mix 8-16%, icon/text = the colour
 * itself, border color-mix 28-50%) — and the SAME rendered size as the pencil.
 */
describe('ApplicationRow · unlink follows the soft-tint convention, same size as the pencil (Danny 09-08)', () => {
  it('renders a color-mix background + border instead of a solid fill', () => {
    renderRow()
    const unlink = screen.getByRole('button', { name: ct('work.detachApplication') })
    expect(unlink.style.background).toContain('color-mix')
    expect(unlink.style.background).toContain('var(--color-danger)')
    expect(unlink.style.border).toContain('color-mix')
    expect(unlink.style.border).toContain('var(--color-danger)')
    expect(unlink.style.color).toBe('var(--color-danger)')
  })

  it('renders at the EXACT same box size as the pencil next to it', () => {
    renderRow()
    const pencil = screen.getByRole('button', { name: ct('work.editApplication') })
    const unlink = screen.getByRole('button', { name: ct('work.detachApplication') })
    expect(unlink.style.width).toBe(pencil.style.width)
    expect(unlink.style.height).toBe(pencil.style.height)
    // border-box keeps the border unlink carries (and pencil doesn't) from
    // growing its rendered box past the pencil's — the actual regression guard.
    expect(unlink.style.boxSizing).toBe('border-box')
    expect(pencil.style.boxSizing).toBe('border-box')
  })
})

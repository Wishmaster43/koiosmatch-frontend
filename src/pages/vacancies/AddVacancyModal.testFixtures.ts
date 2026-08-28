/**
 * AddVacancyModal.test.tsx split (§3 1000-line hard-cap) — pure, non-hoisted
 * fixtures and factories shared by AddVacancyModal.layout/.cascade/.slice2
 * test files. vi.mock/vi.hoisted blocks CANNOT live here (hoisting is
 * per-file), so each test file still declares its own mocks; only the plain
 * data/helpers below are shared.
 */
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Base recruiter/customer fixtures reused across every split file.
export const users = [{ id: 'u1', name: 'Piet Recruiter' }]
export const usersWithSecond = [{ id: 'u1', name: 'Piet Recruiter' }, { id: 'u2', name: 'Anne Manager' }]
export const customers = [{ id: 'c1', name: 'Rivas Zorggroep' }, { id: 'c2', name: 'Yesway Zorg' }]
export const noop = () => {}

// Factory for the mocked VacancyLookupsContext statuses — used to seed and
// reset the per-file `lookupState.statuses` hoisted mutable.
export function makeDefaultStatuses() {
  return [
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
    { value: 'open', label: 'Open', color: '#79B58E' },
    // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
    { value: 'closed', label: 'Closed', color: '#8A94A6' },
  ] as Array<{ value: string; label: string; color?: string }>
}

// Fill the required title and submit — the shared last step of most tests.
export async function fillTitleAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Verpleegkundige')
  await user.click(screen.getByRole('button', { name: 'modal.create' }))
}

// TABBLADEN-1: the modal's cards live behind free-switching tabs — a test
// touching a non-General card must open its tab first (panes stay mounted but
// hidden via CSS, which getByRole correctly treats as inaccessible).
export async function openTab(user: ReturnType<typeof userEvent.setup>, id: string) {
  await user.click(screen.getByRole('tab', { name: `modal.tabs.${id}` }))
}

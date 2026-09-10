import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { vacancyStatusAndActionColumns } from './vacancyListColumns'
import type { VacancyRow } from '../hooks/useCustomerDrawerData'

const t = ((key: string) => key) as unknown as TFunction
const row: VacancyRow = { id: 'v-1', title: 'Logistiek medewerker', status: { value: 's1', label: 'Open', color: '#111' }, applications: 3 }

describe('vacancyStatusAndActionColumns', () => {
  it('returns status + applications columns without the pencil when canEditVacancies is false', () => {
    const cols = vacancyStatusAndActionColumns(t, { openEntity: vi.fn(), canEditVacancies: false })
    expect(cols.map(c => c.key)).toEqual(['status', 'applications'])
  })

  it('adds the pencil actions column when canEditVacancies is true', () => {
    const cols = vacancyStatusAndActionColumns(t, { openEntity: vi.fn(), canEditVacancies: true })
    expect(cols.map(c => c.key)).toEqual(['status', 'applications', 'actions'])
  })

  it('the applications ghost button deep-links to the vacancy applicants tab and stops propagation', () => {
    const openEntity = vi.fn()
    const cols = vacancyStatusAndActionColumns(t, { openEntity, canEditVacancies: false })
    const applicationsCol = cols.find(c => c.key === 'applications')!
    render(<>{applicationsCol.render!(row)}</>)

    fireEvent.click(screen.getByText('3'))
    expect(openEntity).toHaveBeenCalledWith('vacancies', 'v-1', 'applicants')
  })

  it('the pencil action opens the vacancy drawer (no tab argument)', () => {
    const openEntity = vi.fn()
    const cols = vacancyStatusAndActionColumns(t, { openEntity, canEditVacancies: true })
    const actionsCol = cols.find(c => c.key === 'actions')!
    render(<>{actionsCol.render!(row)}</>)

    fireEvent.click(screen.getByTitle('vacancies.editVacancy'))
    expect(openEntity).toHaveBeenCalledWith('vacancies', 'v-1')
  })
})

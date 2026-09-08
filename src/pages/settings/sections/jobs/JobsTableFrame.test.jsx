import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import JobsTableFrame from './JobsTableFrame'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}))

vi.mock('@/components/ui/DataTable', () => ({
  default: ({ rows, emptyText, loading }) => (
    <div>
      {loading && <div>Loading...</div>}
      {!loading && rows.length === 0 && <div>{emptyText}</div>}
      {rows.map((r) => (
        <div key={r.id}>{r.job}</div>
      ))}
    </div>
  ),
}))

describe('JobsTableFrame', () => {
  it('shows error message on error phase', () => {
    render(
      <JobsTableFrame
        phase="error"
        columns={[]}
        rows={[]}
        emptyText="No jobs"
        getRowId={(r) => r.id}
      />
    )

    expect(screen.getByText('jobs.loadError')).toBeInTheDocument()
  })

  it('renders DataTable with rows', () => {
    const rows = [
      { id: '1', job: 'test-job', queue: 'default' },
    ]

    render(
      <JobsTableFrame
        phase="success"
        columns={[{ key: 'job', header: 'Job' }]}
        rows={rows}
        emptyText="No jobs"
        getRowId={(r) => r.id}
      />
    )

    expect(screen.getByText('test-job')).toBeInTheDocument()
  })

  it('shows empty text when no rows', () => {
    render(
      <JobsTableFrame
        phase="success"
        columns={[{ key: 'job', header: 'Job' }]}
        rows={[]}
        emptyText="No jobs"
        getRowId={(r) => r.id}
      />
    )

    expect(screen.getByText('No jobs')).toBeInTheDocument()
  })
})

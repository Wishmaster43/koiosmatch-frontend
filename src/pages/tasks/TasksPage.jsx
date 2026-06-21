import { useState, useEffect } from 'react'
import api from '../../lib/api'
import TasksTable from './TasksTable'

// Map a raw API task → the flat shape the table renders (snake_case-tolerant).
function mapTask(t) {
  return {
    id:          t.id,
    title:       t.title ?? t.name ?? '—',
    candidate:   t.candidate?.name ?? t.candidate_name ?? '',
    type:        t.type ?? t.category ?? '',
    status:      t.status_label ?? t.status ?? '',
    statusColor: t.status_color ?? '#6E8FD6',
    assignee:    t.assignee?.name ?? t.assigned_to?.name ?? t.assignee_name ?? '',
    due:         t.due_date ?? t.due_at ?? '',
  }
}

// TasksPage — thin container: loads tasks and hands them to the table.
export default function TasksPage() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  // Load tasks; a missing endpoint (404) is an empty list, not an error.
  useEffect(() => {
    let alive = true
    api.get('/tasks')
      .then(r => { if (alive) setRows((r.data?.data ?? r.data ?? []).map(mapTask)) })
      .catch(e => { if (alive && e?.response?.status && e.response.status !== 404) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return (
    <div style={{ padding: 20, height: '100%', overflow: 'auto', background: 'var(--bg)' }}>
      <TasksTable rows={rows} loading={loading} error={error} />
    </div>
  )
}

import { unwrapList } from '@/lib/api'

// GET /roles → picker rows. unwrapList reads the measured bare array AND a {data}
// envelope, so a later Resource wrap cannot empty the picker again (SMZ-04).
// Own module: the screen file exports its component only (react-refresh).
export function mapRoles(resp) {
  return unwrapList(resp).rows.map(r => ({ name: r.name, label: r.label || r.name }))
}

/**
 * useShiftmanagerDashboard — data layer for the ShiftManager dashboard (§3): SM
 * candidates (feed the "new this month" KPI), shift KPIs, and — only for AI/Workflow
 * packages — recent workflow runs + WhatsApp conversations. Each request aborts when
 * its input changes or on unmount; the page stays presentational.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
import type { ReportCandidate } from '@/types/reports'

// Shift KPI stats from /sm_reports/dashboard.
export interface SmDashStats {
  open_hours?: number; hours_this_month?: number; occupancy_pct?: number
  messages_sent?: number; response_rate_pct?: number; [k: string]: unknown
}
export interface RunItem { name?: string; ok: boolean; n?: number; err?: string; time: string }
export interface ConvItem { name: string; msg: string; time: string }

// Locale-aware HH:MM from an ISO timestamp.
const hhmm = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''

export function useShiftmanagerDashboard(candidatesPerPage: number, hasAI: boolean) {
  const [candidates,    setCandidates]    = useState<ReportCandidate[]>([])
  const [loading,       setLoading]       = useState(true)
  const [stats,         setStats]         = useState<SmDashStats | null>(null)
  const [runs,          setRuns]          = useState<RunItem[]>([])
  const [conversations, setConversations] = useState<ConvItem[]>([])

  // Candidates feed the (real) "new this month" KPI card.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get(`/sm_candidates?per_page=${candidatesPerPage}`, { signal: ctrl.signal })
      .then(res => { const body = res.data; setCandidates(Array.isArray(body) ? body : (body?.data ?? [])) })
      .catch(err => { if (!isAbortError(err)) setCandidates([]) })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [candidatesPerPage])

  // Shift KPIs from the ShiftManager report endpoint.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/sm_reports/dashboard', { signal: ctrl.signal })
      .then(res => setStats(res.data ?? null))
      .catch(err => { if (!isAbortError(err)) setStats(null) })
    return () => ctrl.abort()
  }, [])

  // Recent workflow runs + WhatsApp conversations — only for AI/Workflow packages.
  useEffect(() => {
    if (!hasAI) return
    const ctrl = new AbortController()
    api.get('/workflow-runs', { params: { per_page: 5 }, signal: ctrl.signal })
      .then(res => {
        const { rows } = unwrapList<{ name?: string; status?: string; processed_count?: number; error?: string; started_at?: string }>(res)
        setRuns(rows.map(r => ({ name: r.name, ok: (r.status ?? 'ok') === 'ok', n: r.processed_count, err: r.error, time: hhmm(r.started_at) })))
      })
      .catch(err => { if (!isAbortError(err)) setRuns([]) })
    api.get('/whatsapp/messages', { params: { per_page: 4 }, signal: ctrl.signal })
      .then(res => {
        const { rows } = unwrapList<{ candidate?: { first_name?: string; last_name?: string }; body?: string; sent_at?: string }>(res)
        setConversations(rows.map(m => ({
          name: `${m.candidate?.first_name ?? ''} ${m.candidate?.last_name ?? ''}`.trim() || '—',
          msg:  m.body ?? '', time: hhmm(m.sent_at),
        })))
      })
      .catch(err => { if (!isAbortError(err)) setConversations([]) })
    return () => ctrl.abort()
  }, [hasAI])

  return { candidates, loading, stats, runs, conversations }
}

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const SCENARIO_LABEL: Record<string, string> = {
  introduce: 'Introduce Yourself',
  daily: 'My Daily Routine',
  weekend: 'My Weekend',
  family: 'Friends and Family',
  hobbies: 'Hobbies and Free Time',
  cooking: 'Food and Cooking',
  restaurant: 'At a Restaurant',
  shopping: 'Shopping for Clothes',
  airport: 'At the Airport',
  hotel: 'Hotel Check-in',
  directions: 'Asking for Directions',
  doctor: 'Visiting a Doctor',
  past: 'Talking About the Past',
  future: 'Future Plans',
  vacation: 'My Dream Vacation',
  interview: 'Job Interview',
  work: 'A Day at Work',
  meeting: 'Joining a Meeting',
  customer: "Solving a Customer's Problem",
  opinion: 'Expressing and Defending an Opinion',
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

interface ConversationRow {
  id: string
  user_id: string
  scenario: string
  level: string
  status: 'active' | 'completed'
  speaking_seconds: number
  goal_seconds: number
  started_at: string
  completed_at: string | null
}

interface TurnRow {
  id: string
  conversation_id: string | null
  user_id: string
  transcript: string
  reply: string
  feedback: {
    positive?: string
    original?: string
    correction?: string
    explanationArabic?: string
  } | null
  speaking_seconds: number
  created_at: string
  audio_path: string | null
}

/** Private bucket for learner recordings — see supabase/speaking_audio.sql. */
const AUDIO_BUCKET = 'x50-speaking-audio'
/** How long a listen link stays valid once generated. */
const AUDIO_URL_TTL_SECONDS = 60 * 60

interface StudentLite {
  user_id: string
  name: string | null
  phone: string | null
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : '—'
}

/**
 * Admin → "Emma": every /speak conversation across all students, with the
 * full transcript + structured feedback for each turn. Read-only — nothing
 * here writes to x50_speaking_conversations / x50_speaking_turns, which are
 * populated only by the `speak-turn` Edge Function.
 *
 * Relies on the admin RLS branch already granted on both tables (the same
 * `siramrhadid@gmail.com` check used everywhere else in /speak):
 * see supabase/speaking_turns.sql and supabase/speaking_conversations.sql.
 */
export default function EmmaAdmin() {
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [turnsByConversation, setTurnsByConversation] = useState<Record<string, TurnRow[]>>({})
  const [students, setStudents] = useState<Record<string, StudentLite>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({})
  const [audioError, setAudioError] = useState<string | null>(null)

  const load = async () => {
    if (!supabase) {
      setLoading(false)
      setError('Supabase is not configured.')
      return
    }
    setLoading(true)
    setError(null)
    const [convRes, turnRes, studentsRes] = await Promise.all([
      supabase
        .from('x50_speaking_conversations')
        .select('id,user_id,scenario,level,status,speaking_seconds,goal_seconds,started_at,completed_at')
        .order('started_at', { ascending: false })
        .limit(500),
      supabase
        .from('x50_speaking_turns')
        .select('id,conversation_id,user_id,transcript,reply,feedback,speaking_seconds,created_at,audio_path')
        .order('created_at', { ascending: true })
        .limit(5000),
      supabase.from('x50_students').select('user_id,name,phone'),
    ])

    if (convRes.error) {
      setError(
        convRes.error.message.includes('relation') || convRes.error.code === '42P01'
          ? 'The Emma tables have not been created yet — run supabase/speaking_conversations.sql.'
          : convRes.error.message,
      )
      setLoading(false)
      return
    }

    const turns = (turnRes.data as TurnRow[] | null) ?? []
    const grouped: Record<string, TurnRow[]> = {}
    for (const t of turns) {
      if (!t.conversation_id) continue
      ;(grouped[t.conversation_id] ??= []).push(t)
    }
    const studentMap: Record<string, StudentLite> = {}
    for (const s of (studentsRes.data as StudentLite[] | null) ?? []) studentMap[s.user_id] = s

    setConversations((convRes.data as ConversationRow[] | null) ?? [])
    setTurnsByConversation(grouped)
    setStudents(studentMap)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!q) return true
      const student = students[c.user_id]
      const haystack = `${student?.name ?? ''} ${student?.phone ?? ''} ${c.user_id} ${c.scenario}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [conversations, students, statusFilter, query])

  const selected = selectedId ? conversations.find((c) => c.id === selectedId) : null
  const selectedTurns = selectedId ? (turnsByConversation[selectedId] ?? []) : []

  // Sign a listen link for every recorded turn in the opened conversation.
  // The bucket is private, so a fresh signed URL is generated per visit
  // rather than stored — nothing long-lived sits in the database.
  useEffect(() => {
    if (!supabase || !selectedId) return
    const paths = selectedTurns.map((t) => t.audio_path).filter((p): p is string => !!p)
    const missing = paths.filter((p) => !audioUrls[p])
    if (missing.length === 0) return
    let cancelled = false
    supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrls(missing, AUDIO_URL_TTL_SECONDS)
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setAudioError(err.message)
          return
        }
        setAudioError(null)
        const next: Record<string, string> = {}
        for (const row of data ?? []) {
          if (row.path && row.signedUrl) next[row.path] = row.signedUrl
        }
        setAudioUrls((prev) => ({ ...prev, ...next }))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- audioUrls is read, not depended on (would refetch what it just fetched)
  }, [selectedId, selectedTurns])

  if (loading) return <p className="text-sm text-[#9a9aa2]">Loading conversations…</p>

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
        <button onClick={load} className="ml-3 font-bold underline">
          Retry
        </button>
      </div>
    )
  }

  if (selected) {
    const student = students[selected.user_id]
    return (
      <div>
        <button
          onClick={() => setSelectedId(null)}
          className="mb-4 text-sm font-bold text-[#534AB7] hover:underline"
        >
          ← Back to all conversations
        </button>

        <div className="mb-5 rounded-2xl border border-[#f0ecf8] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-extrabold text-[#111]">{student?.name ?? selected.user_id}</p>
              <p className="text-xs text-[#9a9aa2]">{student?.phone ?? selected.user_id}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                selected.status === 'completed' ? 'bg-[#D8FAF0] text-[#0C7C62]' : 'bg-[#FEEFD2] text-[#A66A09]'
              }`}
            >
              {selected.status === 'completed' ? 'Completed' : 'Active'}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-[#9a9aa2]">Scenario</dt>
              <dd className="font-bold text-[#111]">{SCENARIO_LABEL[selected.scenario] ?? selected.scenario}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#9a9aa2]">Level</dt>
              <dd className="font-bold text-[#111]">{LEVEL_LABEL[selected.level] ?? selected.level}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#9a9aa2]">Speaking time</dt>
              <dd className="font-bold text-[#111]">
                {formatDuration(selected.speaking_seconds)} / {formatDuration(selected.goal_seconds)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#9a9aa2]">Started</dt>
              <dd className="font-bold text-[#111]">{formatDate(selected.started_at)}</dd>
            </div>
          </dl>
        </div>

        {audioError && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Couldn't prepare recordings for playback: {audioError}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {selectedTurns.length === 0 && (
            <p className="text-sm text-[#9a9aa2]">No turns recorded for this conversation yet.</p>
          )}
          {selectedTurns.map((t, i) => (
            <div key={t.id} className="rounded-2xl border border-[#f0ecf8] p-4">
              <p className="mb-2 text-xs font-bold text-[#9a9aa2]">
                Turn {i + 1} · {formatDate(t.created_at)} · {formatDuration(t.speaking_seconds)} spoken
              </p>
              {t.audio_path && (
                <div className="mb-2">
                  {audioUrls[t.audio_path] ? (
                    <audio controls preload="none" src={audioUrls[t.audio_path]} className="h-9 w-full max-w-sm" />
                  ) : (
                    <p className="text-xs text-[#9a9aa2]">Preparing recording…</p>
                  )}
                </div>
              )}
              <div className="mb-2 rounded-xl bg-[#f4f3f7] px-3 py-2 text-sm text-[#111]" dir="ltr">
                <span className="font-bold text-[#534AB7]">Student: </span>
                {t.transcript}
              </div>
              <div className="mb-2 rounded-xl bg-[#EDEBFF] px-3 py-2 text-sm text-[#111]" dir="ltr">
                <span className="font-bold text-[#534AB7]">Emma: </span>
                {t.reply}
              </div>
              {t.feedback?.positive && (
                <div className="rounded-xl border border-[#D8FAF0] bg-[#F3FCFA] px-3 py-2 text-sm">
                  <p className="font-bold text-[#0C7C62]">✓ {t.feedback.positive}</p>
                  {t.feedback.correction && (
                    <div className="mt-1.5 space-y-1" dir="ltr">
                      {t.feedback.original && (
                        <p className="text-[#B11D54]">
                          <span className="text-xs font-bold text-[#9a9aa2]">Original: </span>
                          {t.feedback.original}
                        </p>
                      )}
                      <p className="font-bold text-[#0C7C62]">
                        <span className="text-xs font-bold text-[#9a9aa2]">Suggested: </span>
                        {t.feedback.correction}
                      </p>
                      {t.feedback.explanationArabic && (
                        <p className="text-[#5b5670]" dir="rtl">
                          {t.feedback.explanationArabic}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or user id…"
          className="min-w-[220px] flex-1 rounded-xl border border-[#e8e0f0] px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'completed')}
          className="rounded-xl border border-[#e8e0f0] px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
        <button onClick={load} className="text-sm font-bold text-[#534AB7] hover:underline">
          Refresh
        </button>
      </div>

      <p className="mb-3 text-xs text-[#9a9aa2]">
        {filtered.length} conversation{filtered.length === 1 ? '' : 's'}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#f0ecf8] text-xs uppercase text-[#9a9aa2]">
              <th className="py-2 pr-3">Student</th>
              <th className="py-2 pr-3">Scenario</th>
              <th className="py-2 pr-3">Level</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Speaking time</th>
              <th className="py-2 pr-3">Started</th>
              <th className="py-2 pr-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const student = students[c.user_id]
              return (
                <tr key={c.id} className="border-b border-[#f7f5fb]">
                  <td className="py-2 pr-3 font-bold text-[#111]">{student?.name ?? c.user_id.slice(0, 8)}</td>
                  <td className="py-2 pr-3">{SCENARIO_LABEL[c.scenario] ?? c.scenario}</td>
                  <td className="py-2 pr-3">{LEVEL_LABEL[c.level] ?? c.level}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        c.status === 'completed' ? 'bg-[#D8FAF0] text-[#0C7C62]' : 'bg-[#FEEFD2] text-[#A66A09]'
                      }`}
                    >
                      {c.status === 'completed' ? 'Completed' : 'Active'}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {formatDuration(c.speaking_seconds)} / {formatDuration(c.goal_seconds)}
                  </td>
                  <td className="py-2 pr-3 text-[#5b5670]">{formatDate(c.started_at)}</td>
                  <td className="py-2 pr-3">
                    <button onClick={() => setSelectedId(c.id)} className="font-bold text-[#534AB7] hover:underline">
                      View
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-[#9a9aa2]">
                  No conversations match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase, REVIEWS_BUCKET } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Challenge, Review, Code } from '../types'
import { TrashIcon } from '../components/icons'
import FeedbackView from '../components/FeedbackView'
import { parseSubmission } from '../lib/grading'
import { isAdminEmail } from '../lib/admin'

type Tab = 'challenges' | 'reviews' | 'codes' | 'students' | 'grading'

type ChallengeForm = {
  number: string
  title: string
  video_url: string
  pdf_url: string
  speaking_task: string
  is_locked: boolean
}

const EMPTY_FORM: ChallengeForm = {
  number: '',
  title: '',
  video_url: '',
  pdf_url: '',
  speaking_task: '',
  is_locked: false,
}

export default function Admin() {
  const { user, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('challenges')

  const isAdmin = isAdminEmail(user?.email)

  const signInWithGoogle = () => {
    if (!supabase) return
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin` },
    })
  }

  // Not signed in → require Google sign-in.
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-5" dir="ltr">
        <div className="w-full max-w-sm rounded-3xl border border-[#f0ecf8] p-8 text-center shadow-sm">
          <div className="mb-6 flex items-center justify-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#534AB7] font-extrabold text-white">
              X
            </span>
            <span className="text-lg font-extrabold text-[#111]">EnglishX50 Admin</span>
          </div>
          <p className="mb-5 text-sm text-[#5b5670]">Sign in with the admin Google account to continue.</p>
          <button
            onClick={signInWithGoogle}
            className="w-full rounded-2xl bg-[#534AB7] py-3 text-sm font-bold text-white hover:bg-[#46409c]"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  // Signed in with the wrong account → deny.
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-5" dir="ltr">
        <div className="w-full max-w-sm rounded-3xl border border-[#f0ecf8] p-8 text-center shadow-sm">
          <p className="mb-1 text-3xl">🔒</p>
          <p className="mb-1 text-lg font-extrabold text-[#111]">Access denied</p>
          <p className="mb-5 text-sm text-[#5b5670]">
            {user.email} is not authorized to view this page.
          </p>
          <button
            onClick={signOut}
            className="w-full rounded-2xl border border-[#e8e0f0] py-3 text-sm font-bold text-[#5b5670] hover:bg-[#f4f3f7]"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white" dir="ltr">
      <header className="border-b border-[#f0ecf8]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#534AB7] text-sm font-extrabold text-white">
              X
            </span>
            <span className="font-extrabold text-[#111]">Admin Panel</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm font-medium text-[#534AB7] hover:underline">
              View site →
            </a>
            <button onClick={signOut} className="text-sm font-medium text-[#5b5670] hover:underline">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-6">
        <div className="mb-6 flex gap-2">
          {(['challenges', 'reviews', 'codes', 'students', 'grading'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2 text-sm font-bold capitalize transition ${
                tab === t ? 'bg-[#534AB7] text-white' : 'bg-[#f4f3f7] text-[#5b5670]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'challenges' && <ChallengesAdmin />}
        {tab === 'reviews' && <ReviewsAdmin />}
        {tab === 'codes' && <CodesAdmin />}
        {tab === 'students' && <StudentsAdmin />}
        {tab === 'grading' && <GradingAdmin />}
      </div>
    </div>
  )
}

function ChallengesAdmin() {
  const [items, setItems] = useState<Challenge[]>([])
  const [form, setForm] = useState<ChallengeForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('x50_challenges')
      .select('*')
      .order('number', { ascending: true })
    setItems((data as Challenge[]) ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) {
      setMsg('Supabase is not configured.')
      return
    }
    setBusy(true)
    setMsg(null)
    const payload = {
      number: Number(form.number),
      title: form.title,
      video_url: form.video_url || null,
      pdf_url: form.pdf_url || null,
      speaking_task: form.speaking_task || null,
      is_locked: form.is_locked,
    }
    const { error } = editingId
      ? await supabase.from('x50_challenges').update(payload).eq('id', editingId)
      : await supabase.from('x50_challenges').insert(payload)

    setBusy(false)
    if (error) {
      setMsg(`Error: ${error.message}`)
      return
    }
    resetForm()
    load()
  }

  const edit = (c: Challenge) => {
    setEditingId(c.id)
    setForm({
      number: String(c.number),
      title: c.title,
      video_url: c.video_url ?? '',
      pdf_url: c.pdf_url ?? '',
      speaking_task: c.speaking_task ?? '',
      is_locked: c.is_locked,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = async (id: string) => {
    if (!supabase) return
    if (!confirm('Delete this challenge?')) return
    await supabase.from('x50_challenges').delete().eq('id', id)
    if (editingId === id) resetForm()
    load()
  }

  const field = 'w-full rounded-xl border border-[#e8e0f0] px-3 py-2 text-sm outline-none focus:border-[#534AB7]'

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[#f0ecf8] p-5">
        <h3 className="font-bold text-[#111]">{editingId ? 'Edit challenge' : 'Add challenge'}</h3>
        <input
          type="number"
          placeholder="Number"
          value={form.number}
          onChange={(e) => setForm({ ...form, number: e.target.value })}
          required
          className={field}
        />
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className={field}
        />
        <input
          placeholder="Cloudflare Stream video ID (e.g. 6058ab7c...)"
          value={form.video_url}
          onChange={(e) => setForm({ ...form, video_url: e.target.value })}
          className={field}
        />
        <input
          placeholder="Source link / PDF URL (https://...)"
          value={form.pdf_url}
          onChange={(e) => setForm({ ...form, pdf_url: e.target.value })}
          className={field}
        />
        <textarea
          placeholder="Speaking task"
          value={form.speaking_task}
          onChange={(e) => setForm({ ...form, speaking_task: e.target.value })}
          rows={3}
          className={field}
        />
        <label className="flex items-center gap-2 text-sm text-[#5b5670]">
          <input
            type="checkbox"
            checked={form.is_locked}
            onChange={(e) => setForm({ ...form, is_locked: e.target.checked })}
          />
          Locked
        </label>
        {msg && <p className="text-xs text-[#FF6B6B]">{msg}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-[#534AB7] py-2.5 text-sm font-bold text-white hover:bg-[#46409c] disabled:opacity-60"
          >
            {busy ? 'Saving…' : editingId ? 'Update' : 'Add'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-[#e8e0f0] px-4 py-2.5 text-sm font-bold text-[#5b5670]"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-[#9a9aa2]">No challenges yet.</p>}
        {items.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-[#f0ecf8] p-4"
          >
            <div>
              <p className="text-xs font-bold text-[#534AB7]">
                Challenge {String(c.number).padStart(2, '0')}
                {c.is_locked && <span className="ml-2 text-[#9a9aa2]">🔒 locked</span>}
              </p>
              <p className="font-bold text-[#111]">{c.title}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => edit(c)}
                className="rounded-lg bg-[#EEEDFE] px-3 py-1.5 text-xs font-bold text-[#534AB7]"
              >
                Edit
              </button>
              <button
                onClick={() => remove(c.id)}
                className="flex items-center rounded-lg bg-[#FEE2E2] px-3 py-1.5 text-xs font-bold text-[#DC2626]"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReviewsAdmin() {
  const [items, setItems] = useState<Review[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('x50_reviews')
      .select('*')
      .order('created_at', { ascending: false })
    setItems((data as Review[]) ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    if (!supabase) {
      setMsg('Supabase is not configured.')
      return
    }
    setUploading(true)
    setMsg(null)
    setProgress({ done: 0, total: files.length })

    const rows: { image_url: string }[] = []
    const failures: string[] = []

    // Upload files to storage one by one so a single failure doesn't abort
    // the whole batch. DB rows are inserted together at the end.
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `reviews/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error: upErr } = await supabase.storage
        .from(REVIEWS_BUCKET)
        .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })

      if (upErr) {
        failures.push(`${file.name}: ${upErr.message}`)
      } else {
        const { data: pub } = supabase.storage.from(REVIEWS_BUCKET).getPublicUrl(path)
        rows.push({ image_url: pub.publicUrl })
      }
      setProgress({ done: i + 1, total: files.length })
    }

    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('x50_reviews').insert(rows)
      if (insErr) failures.push(`DB insert failed: ${insErr.message}`)
    }

    setUploading(false)
    setProgress(null)
    e.target.value = ''
    setMsg(
      failures.length === 0
        ? `Uploaded ${rows.length} image${rows.length === 1 ? '' : 's'} ✓`
        : `Uploaded ${rows.length}/${files.length}. ${failures.length} failed: ${failures
            .slice(0, 3)
            .join(' · ')}${failures.length > 3 ? ' …' : ''}`,
    )
    load()
  }

  const remove = async (r: Review) => {
    if (!supabase) return
    if (!confirm('Delete this review?')) return
    // Best-effort: remove the stored object if it lives in our bucket.
    const marker = `/${REVIEWS_BUCKET}/`
    const idx = r.image_url.indexOf(marker)
    if (idx !== -1) {
      const objectPath = r.image_url.slice(idx + marker.length)
      await supabase.storage.from(REVIEWS_BUCKET).remove([objectPath])
    }
    await supabase.from('x50_reviews').delete().eq('id', r.id)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#f0ecf8] p-5">
        <h3 className="mb-1 font-bold text-[#111]">Upload review images</h3>
        <p className="mb-3 text-xs text-[#9a9aa2]">
          Select multiple files at once (you can pick all 56 together).
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          disabled={uploading}
          className="block w-full text-sm text-[#5b5670] file:mr-3 file:rounded-xl file:border-0 file:bg-[#534AB7] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white disabled:opacity-60"
        />
        {uploading && progress && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#EEEDFE]">
              <div
                className="h-full rounded-full bg-[#534AB7] transition-all"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[#534AB7]">
              Uploading {progress.done} / {progress.total}…
            </p>
          </div>
        )}
        {msg && !uploading && <p className="mt-2 text-xs text-[#5b5670]">{msg}</p>}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[#9a9aa2]">No reviews yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((r) => (
            <div key={r.id} className="group relative overflow-hidden rounded-2xl border border-[#f0ecf8]">
              <img src={r.image_url} alt="review" className="w-full object-cover" />
              <button
                onClick={() => remove(r)}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#DC2626] shadow hover:bg-white"
                aria-label="Delete review"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function randomCode() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  return `X50-${part()}-${part()}`
}

function CodesAdmin() {
  const [items, setItems] = useState<Code[]>([])
  const [count, setCount] = useState('1')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('x50_codes')
      .select('*')
      .order('created_at', { ascending: false })
    setItems((data as Code[]) ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const generate = async () => {
    if (!supabase) {
      setMsg('Supabase is not configured.')
      return
    }
    const n = Math.min(Math.max(Number(count) || 1, 1), 200)
    setBusy(true)
    setMsg(null)
    const rows = Array.from({ length: n }, () => ({ code: randomCode() }))
    const { error } = await supabase.from('x50_codes').insert(rows)
    setBusy(false)
    if (error) {
      setMsg(`Error: ${error.message}`)
      return
    }
    setMsg(`Generated ${n} code${n === 1 ? '' : 's'} ✓`)
    load()
  }

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500)
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  const copyAllUnused = async () => {
    const unused = items.filter((c) => !c.used_at).map((c) => c.code)
    if (unused.length === 0) return
    try {
      await navigator.clipboard.writeText(unused.join('\n'))
      setMsg(`Copied ${unused.length} unused codes to clipboard ✓`)
    } catch {
      /* ignore */
    }
  }

  const remove = async (id: string) => {
    if (!supabase) return
    if (!confirm('Delete this code?')) return
    await supabase.from('x50_codes').delete().eq('id', id)
    load()
  }

  const fmt = (s?: string | null) =>
    s ? new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  const usedCount = items.filter((c) => c.used_at).length

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#f0ecf8] p-5">
        <h3 className="mb-1 font-bold text-[#111]">Generate subscription codes</h3>
        <p className="mb-3 text-xs text-[#9a9aa2]">
          Create codes to share with subscribers. They redeem them in the “عندك كود؟” box.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-24 rounded-xl border border-[#e8e0f0] px-3 py-2 text-sm outline-none focus:border-[#534AB7]"
          />
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-xl bg-[#534AB7] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#46409c] disabled:opacity-60"
          >
            {busy ? 'Generating…' : 'Generate'}
          </button>
          <button
            onClick={copyAllUnused}
            className="rounded-xl border border-[#e8e0f0] px-4 py-2.5 text-sm font-bold text-[#5b5670] hover:bg-[#f4f3f7]"
          >
            Copy unused
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-[#5b5670]">{msg}</p>}
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-bold text-[#111]">
          Codes <span className="text-[#9a9aa2]">({items.length})</span>
        </p>
        <p className="text-xs text-[#9a9aa2]">
          {usedCount} used · {items.length - usedCount} available
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[#9a9aa2]">No codes yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#f0ecf8]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#f0ecf8] bg-[#faf9ff] text-xs uppercase text-[#9a9aa2]">
                <th className="px-4 py-3 font-bold">Code</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Created</th>
                <th className="px-4 py-3 font-bold">Used at</th>
                <th className="px-4 py-3 font-bold">Used by</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-[#f5f2fb] last:border-0">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => copy(c.code)}
                      className="font-mono font-bold text-[#534AB7] hover:underline"
                      title="Copy"
                    >
                      {c.code}
                      {copied === c.code && <span className="ml-2 text-xs text-[#0C7C62]">copied</span>}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {c.used_at ? (
                      <span className="rounded-full bg-[#FEE2E2] px-2.5 py-1 text-xs font-bold text-[#B91C1C]">
                        Used
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#E1F5EE] px-2.5 py-1 text-xs font-bold text-[#0C7C62]">
                        Available
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#5b5670]">{fmt(c.created_at)}</td>
                  <td className="px-4 py-3 text-[#5b5670]">{fmt(c.used_at)}</td>
                  <td className="px-4 py-3 text-[#5b5670]">{c.used_by || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(c.id)}
                      className="inline-flex items-center rounded-lg bg-[#FEE2E2] px-2.5 py-1.5 text-xs font-bold text-[#DC2626]"
                      aria-label="Delete code"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface VideoView {
  id: string
  student: string | null
  video_id: string | null
  opened_at: string
  watched_percent: number
}

interface Submission {
  id: string
  student: string | null
  challenge_number: number | null
  question: string | null
  transcript: string | null
  score: number | null
  passed: boolean | null
  feedback: string | null
  created_at: string
}

interface StudentRow {
  name: string
  views: VideoView[]
  subs: Submission[]
}

function StudentsAdmin() {
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    Promise.all([
      supabase.from('x50_video_views').select('*').order('opened_at', { ascending: false }),
      supabase.from('x50_submissions').select('*').order('created_at', { ascending: false }),
      // Premium users = those who redeemed a code; used_by matches the activity
      // `student` identity (both come from the x50_user value).
      supabase.from('x50_codes').select('used_by').not('used_at', 'is', null),
    ]).then(([views, subs, codes]) => {
      const premium = new Set(
        ((codes.data as { used_by: string | null }[]) ?? [])
          .map((c) => c.used_by)
          .filter((v): v is string => !!v),
      )

      const map = new Map<string, StudentRow>()
      const keyOf = (s: string | null) => s || 'زائر غير معرّف'
      const get = (s: string | null) => {
        const key = keyOf(s)
        if (!map.has(key)) map.set(key, { name: key, views: [], subs: [] })
        return map.get(key)!
      }
      ;((views.data as VideoView[]) ?? []).forEach((v) => get(v.student).views.push(v))
      ;((subs.data as Submission[]) ?? []).forEach((s) => get(s.student).subs.push(s))

      // Show only premium students (whose identity redeemed a code).
      setStudents(Array.from(map.values()).filter((st) => premium.has(st.name)))
      setLoading(false)
    })
  }, [])

  const fmt = (s?: string | null) =>
    s ? new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  if (loading) return <p className="text-sm text-[#9a9aa2]">Loading…</p>
  if (students.length === 0)
    return <p className="text-sm text-[#9a9aa2]">No premium students yet.</p>

  return (
    <div className="space-y-3">
      {students.map((st) => {
        const maxPct = st.views.reduce((m, v) => Math.max(m, v.watched_percent), 0)
        const isOpen = open === st.name
        return (
          <div key={st.name} className="rounded-2xl border border-[#f0ecf8]">
            <button
              onClick={() => setOpen(isOpen ? null : st.name)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <div>
                <p className="font-bold text-[#111]">{st.name}</p>
                <p className="text-xs text-[#9a9aa2]">
                  {st.views.length} video view{st.views.length === 1 ? '' : 's'} · max {maxPct}% watched ·{' '}
                  {st.subs.length} speaking task{st.subs.length === 1 ? '' : 's'}
                </p>
              </div>
              <span className="text-[#534AB7]">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="space-y-4 border-t border-[#f0ecf8] p-4">
                {/* Video engagement */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9a9aa2]">
                    Video engagement
                  </p>
                  {st.views.length === 0 ? (
                    <p className="text-sm text-[#9a9aa2]">No video opens recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {st.views.map((v) => (
                        <div key={v.id} className="flex items-center gap-3">
                          <span className="w-44 shrink-0 text-xs text-[#5b5670]">
                            Opened {fmt(v.opened_at)}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEEDFE]">
                            <div
                              className="h-full rounded-full bg-[#534AB7]"
                              style={{ width: `${Math.min(100, v.watched_percent)}%` }}
                            />
                          </div>
                          <span className="w-12 shrink-0 text-right text-xs font-bold text-[#534AB7]">
                            {v.watched_percent}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Speaking tasks */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9a9aa2]">
                    Speaking tasks
                  </p>
                  {st.subs.length === 0 ? (
                    <p className="text-sm text-[#9a9aa2]">No speaking submissions.</p>
                  ) : (
                    <div className="space-y-3">
                      {st.subs.map((s) => (
                        <div key={s.id} className="rounded-xl border border-[#f0ecf8] p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs font-bold text-[#534AB7]">
                              {s.challenge_number != null ? `Challenge ${s.challenge_number}` : 'Speaking'} ·{' '}
                              {fmt(s.created_at)}
                            </p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                s.passed ? 'bg-[#E1F5EE] text-[#0C7C62]' : 'bg-[#FEE2E2] text-[#B91C1C]'
                              }`}
                            >
                              {s.passed ? 'Passed' : 'Not passed'} · {s.score ?? 0}%
                            </span>
                          </div>
                          {s.transcript && (
                            <p className="mb-2 rounded-lg bg-[#faf9ff] p-2 text-[13px] text-[#3a3550]" dir="ltr">
                              “{s.transcript}”
                            </p>
                          )}
                          {s.feedback && (
                            <details>
                              <summary className="cursor-pointer text-xs font-bold text-[#534AB7]">
                                View AI feedback
                              </summary>
                              <div className="mt-2">
                                <FeedbackView result={parseSubmission(s as unknown as Record<string, unknown>)} />
                              </div>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function GradingAdmin() {
  const [gradingRules, setGradingRules] = useState('')
  const [feedbackRules, setFeedbackRules] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase
      .from('x50_settings')
      .select('key,value')
      .in('key', ['grading_rules', 'feedback_rules'])
      .then(({ data }) => {
        const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]))
        setGradingRules(map.get('grading_rules') ?? '')
        setFeedbackRules(map.get('feedback_rules') ?? '')
        setLoading(false)
      })
  }, [])

  const save = async () => {
    if (!supabase) {
      setMsg('Supabase is not configured.')
      return
    }
    setBusy(true)
    setMsg(null)
    const now = new Date().toISOString()
    const { error } = await supabase.from('x50_settings').upsert(
      [
        { key: 'grading_rules', value: gradingRules, updated_at: now },
        { key: 'feedback_rules', value: feedbackRules, updated_at: now },
      ],
      { onConflict: 'key' },
    )
    setBusy(false)
    setMsg(error ? `Error: ${error.message}` : 'Saved ✓ — new attempts will use these rules.')
  }

  const area =
    'w-full min-h-[160px] rounded-xl border border-[#e8e0f0] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#534AB7]'

  if (loading) return <p className="text-sm text-[#9a9aa2]">Loading…</p>

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-2xl border border-[#f0ecf8] p-5">
        <h3 className="mb-1 font-bold text-[#111]">AI grading rules</h3>
        <p className="mb-3 text-xs text-[#9a9aa2]">
          Extra instructions added to the AI scoring prompt. Use this to make grading stricter or
          fairer — e.g. “Use the full 0–100 range; only give 70+ for genuinely strong, on-topic
          answers; penalise short or repetitive responses.”
        </p>
        <textarea
          value={gradingRules}
          onChange={(e) => setGradingRules(e.target.value)}
          placeholder="e.g. Be strict. Use the full 0-100 range. Below 50 for weak answers…"
          className={area}
        />
      </div>

      <div className="rounded-2xl border border-[#f0ecf8] p-5">
        <h3 className="mb-1 font-bold text-[#111]">AI feedback guidelines</h3>
        <p className="mb-3 text-xs text-[#9a9aa2]">
          How the AI should write its feedback (tone, language, focus). e.g. “Give feedback in
          Egyptian Arabic, be encouraging but specific, and always include 2 concrete next steps.”
        </p>
        <textarea
          value={feedbackRules}
          onChange={(e) => setFeedbackRules(e.target.value)}
          placeholder="e.g. Feedback in simple Egyptian Arabic, warm but specific…"
          className={area}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-xl bg-[#534AB7] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#46409c] disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save rules'}
        </button>
        {msg && <p className="text-xs text-[#5b5670]">{msg}</p>}
      </div>

      <p className="text-xs text-[#9a9aa2]">
        The grading Edge Function reads these rules server-side on every attempt, so changes take
        effect immediately for new submissions.
      </p>
    </div>
  )
}

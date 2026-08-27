import { useEffect, useMemo, useState } from 'react'
import { supabase, REVIEWS_BUCKET, FILES_BUCKET } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Challenge, Review, Code } from '../types'
import { TrashIcon } from '../components/icons'
import FeedbackView from '../components/FeedbackView'
import StudentsDashboard from '../components/StudentsDashboard'
import { parseSubmission } from '../lib/grading'
import { challengeVideos } from '../lib/challenge'
import { audioUrl } from '../lib/audio'
import { isAdminEmail } from '../lib/admin'
import { MAX_TRIALS } from '../lib/progress'
import { COOLDOWN_DAYS } from '../lib/completion'

type Tab = 'challenges' | 'reviews' | 'codes' | 'leads' | 'students' | 'trials' | 'grading'

type ChallengeForm = {
  number: string
  title: string
  pdf_url: string
  file_url: string
  videos: { title: string; uid: string }[]
  speaking_tasks: string[]
  is_locked: boolean
}

const EMPTY_FORM: ChallengeForm = {
  number: '',
  title: '',
  pdf_url: '',
  file_url: '',
  videos: [{ title: '', uid: '' }],
  speaking_tasks: [''],
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
        <div className="mb-6 -mx-5 flex gap-2 overflow-x-auto px-5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(['challenges', 'reviews', 'codes', 'leads', 'students', 'trials', 'grading'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-sm font-bold capitalize transition ${
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
        {tab === 'leads' && <LeadsAdmin />}
        {tab === 'students' && <StudentsSection />}
        {tab === 'trials' && <TrialsAdmin />}
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
  const [uploadingFile, setUploadingFile] = useState(false)
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
    const videos = form.videos
      .map((v) => ({ title: v.title.trim(), uid: v.uid.trim() }))
      .filter((v) => v.uid)
    const speaking_tasks = form.speaking_tasks.map((t) => t.trim()).filter(Boolean)
    const payload = {
      number: Number(form.number),
      title: form.title,
      pdf_url: form.pdf_url || null,
      file_url: form.file_url || null,
      videos,
      speaking_tasks,
      // Keep the legacy single columns in sync with the first entry.
      video_url: videos[0]?.uid || null,
      speaking_task: speaking_tasks[0] || null,
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
    const videos =
      Array.isArray(c.videos) && c.videos.length
        ? c.videos.map((v) => ({ title: v.title ?? '', uid: v.uid ?? '' }))
        : [{ title: '', uid: c.video_url ?? '' }]
    const speaking_tasks =
      Array.isArray(c.speaking_tasks) && c.speaking_tasks.length
        ? c.speaking_tasks.slice()
        : [c.speaking_task ?? '']
    setForm({
      number: String(c.number),
      title: c.title,
      pdf_url: c.pdf_url ?? '',
      file_url: c.file_url ?? '',
      videos: videos.length ? videos : [{ title: '', uid: '' }],
      speaking_tasks: speaking_tasks.length ? speaking_tasks : [''],
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

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!supabase) {
      setMsg('Supabase is not configured.')
      return
    }
    setUploadingFile(true)
    setMsg(null)
    const path = `challenges/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`
    const { error } = await supabase.storage
      .from(FILES_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/pdf', upsert: false })
    setUploadingFile(false)
    if (error) {
      setMsg(`Upload failed: ${error.message}`)
      return
    }
    const { data: pub } = supabase.storage.from(FILES_BUCKET).getPublicUrl(path)
    setForm((f) => ({ ...f, file_url: pub.publicUrl }))
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
          placeholder="Source link / PDF URL (https://...)"
          value={form.pdf_url}
          onChange={(e) => setForm({ ...form, pdf_url: e.target.value })}
          className={field}
        />

        {/* Challenge file (PDF) — shown behind the "ملف التحدي" button */}
        <div className="rounded-xl border border-[#f0ecf8] p-3">
          <p className="mb-2 text-xs font-bold text-[#5b5670]">Challenge file (PDF)</p>
          {form.file_url ? (
            <div className="flex items-center gap-2">
              <a
                href={form.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm font-semibold text-[#534AB7] hover:underline"
              >
                {decodeURIComponent(form.file_url.split('/').pop() ?? 'View file')}
              </a>
              <button
                type="button"
                onClick={() => setForm({ ...form, file_url: '' })}
                className="shrink-0 rounded-lg bg-[#FEE2E2] px-3 py-1.5 text-sm font-bold text-[#DC2626]"
              >
                ×
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={uploadFile}
              disabled={uploadingFile}
              className="block w-full text-sm text-[#5b5670] file:mr-3 file:rounded-xl file:border-0 file:bg-[#534AB7] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white disabled:opacity-60"
            />
          )}
          {uploadingFile && <p className="mt-2 text-xs text-[#534AB7]">Uploading…</p>}
        </div>

        {/* Videos (multiple) */}
        <div className="rounded-xl border border-[#f0ecf8] p-3">
          <p className="mb-2 text-xs font-bold text-[#5b5670]">Lesson videos</p>
          <div className="space-y-2">
            {form.videos.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input
                  placeholder="Title (optional)"
                  value={v.title}
                  onChange={(e) => {
                    const videos = form.videos.slice()
                    videos[i] = { ...videos[i], title: e.target.value }
                    setForm({ ...form, videos })
                  }}
                  className={`${field} flex-none basis-1/3`}
                />
                <input
                  placeholder="Cloudflare Stream video ID"
                  value={v.uid}
                  onChange={(e) => {
                    const videos = form.videos.slice()
                    videos[i] = { ...videos[i], uid: e.target.value }
                    setForm({ ...form, videos })
                  }}
                  className={`${field} min-w-0 flex-1`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const videos = form.videos.filter((_, j) => j !== i)
                    setForm({ ...form, videos: videos.length ? videos : [{ title: '', uid: '' }] })
                  }}
                  className="shrink-0 rounded-lg bg-[#FEE2E2] px-3 text-sm font-bold text-[#DC2626]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...form, videos: [...form.videos, { title: '', uid: '' }] })}
            className="mt-2 rounded-lg bg-[#EEEDFE] px-3 py-1.5 text-xs font-bold text-[#534AB7]"
          >
            + Add video
          </button>
        </div>

        {/* Speaking tasks (multiple) */}
        <div className="rounded-xl border border-[#f0ecf8] p-3">
          <p className="mb-2 text-xs font-bold text-[#5b5670]">Speaking tasks</p>
          <div className="space-y-2">
            {form.speaking_tasks.map((t, i) => (
              <div key={i} className="flex gap-2">
                <textarea
                  placeholder={`Speaking prompt ${i + 1}`}
                  value={t}
                  onChange={(e) => {
                    const speaking_tasks = form.speaking_tasks.slice()
                    speaking_tasks[i] = e.target.value
                    setForm({ ...form, speaking_tasks })
                  }}
                  rows={2}
                  className={`${field} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const speaking_tasks = form.speaking_tasks.filter((_, j) => j !== i)
                    setForm({ ...form, speaking_tasks: speaking_tasks.length ? speaking_tasks : [''] })
                  }}
                  className="shrink-0 rounded-lg bg-[#FEE2E2] px-3 text-sm font-bold text-[#DC2626]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...form, speaking_tasks: [...form.speaking_tasks, ''] })}
            className="mt-2 rounded-lg bg-[#EEEDFE] px-3 py-1.5 text-xs font-bold text-[#534AB7]"
          >
            + Add speaking task
          </button>
        </div>
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

interface Lead {
  id: string
  name: string | null
  phone: string | null
  country_code: string | null
  job: string | null
  nationality: string | null
  university: string | null
  youtube_subscribed: string | null
  referral: string | null
  paid: boolean
  paid_at: string | null
  created_at: string
}

/** Sentinel for "field is empty" in the dropdown filters. */
const LEAD_BLANK = '__blank__'

/** Distinct non-empty values of one Lead field, plus a blank bucket if any row lacks it. */
function leadOptions(items: Lead[], pick: (l: Lead) => string | null | undefined): string[] {
  const seen = new Set<string>()
  let hasBlank = false
  for (const l of items) {
    const v = (pick(l) ?? '').trim()
    if (v) seen.add(v)
    else hasBlank = true
  }
  const list = [...seen].sort((a, b) => a.localeCompare(b, 'ar'))
  return hasBlank ? [...list, LEAD_BLANK] : list
}

function LeadsAdmin() {
  const [items, setItems] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [search, setSearch] = useState('')
  const [nationality, setNationality] = useState('all')
  const [job, setJob] = useState('all')
  const [referral, setReferral] = useState('all')
  const [university, setUniversity] = useState('all')
  const [youtube, setYoutube] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('x50_leads')
      .select('*')
      .order('created_at', { ascending: false })
    setItems((data as Lead[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const togglePaid = async (l: Lead) => {
    if (!supabase) return
    const next = !l.paid
    await supabase
      .from('x50_leads')
      .update({ paid: next, paid_at: next ? new Date().toISOString() : null })
      .eq('id', l.id)
    load()
  }

  const remove = async (id: string) => {
    if (!supabase) return
    if (!confirm('Delete this lead?')) return
    await supabase.from('x50_leads').delete().eq('id', id)
    load()
  }

  const fmt = (s?: string | null) =>
    s ? new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
  const yn = (v?: string | null) => (v === 'yes' ? 'نعم' : v === 'no' ? 'لا' : '—')

  const paidCount = items.filter((l) => l.paid).length

  const nationalities = useMemo(() => leadOptions(items, (l) => l.nationality), [items])
  const jobs = useMemo(() => leadOptions(items, (l) => l.job), [items])
  const referrals = useMemo(() => leadOptions(items, (l) => l.referral), [items])

  const matchesPick = (value: string | null | undefined, selected: string) => {
    if (selected === 'all') return true
    const v = (value ?? '').trim()
    return selected === LEAD_BLANK ? !v : v === selected
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    // Date inputs are calendar days in the admin's local timezone; widen `to`
    // to the end of that day so a same-day from/to still matches.
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null
    const toTs = to ? new Date(`${to}T23:59:59.999`).getTime() : null

    const list = items.filter((l) => {
      if (filter === 'paid' && !l.paid) return false
      if (filter === 'unpaid' && l.paid) return false
      if (!matchesPick(l.nationality, nationality)) return false
      if (!matchesPick(l.job, job)) return false
      if (!matchesPick(l.referral, referral)) return false
      if (university !== 'all' && (l.university ?? '') !== university) return false
      if (youtube !== 'all' && (l.youtube_subscribed ?? '') !== youtube) return false

      if (fromTs !== null || toTs !== null) {
        const ts = new Date(l.created_at).getTime()
        if (fromTs !== null && ts < fromTs) return false
        if (toTs !== null && ts > toTs) return false
      }

      if (q) {
        const hay = [l.name, l.phone, l.job, l.nationality, l.referral, l.country_code]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    return list.sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return sort === 'newest' ? diff : -diff
    })
  }, [items, filter, sort, search, nationality, job, referral, university, youtube, from, to])

  const filtersActive =
    filter !== 'all' ||
    search.trim() !== '' ||
    nationality !== 'all' ||
    job !== 'all' ||
    referral !== 'all' ||
    university !== 'all' ||
    youtube !== 'all' ||
    from !== '' ||
    to !== ''

  const resetFilters = () => {
    setFilter('all')
    setSearch('')
    setNationality('all')
    setJob('all')
    setReferral('all')
    setUniversity('all')
    setYoutube('all')
    setFrom('')
    setTo('')
  }

  const field =
    'rounded-xl border border-[#e8e0f0] bg-white px-3 py-2 text-xs text-[#5b5670] outline-none focus:border-[#534AB7]'
  const label = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#9a9aa2]'
  const optionLabel = (v: string) => (v === LEAD_BLANK ? '— not specified —' : v)

  if (loading) return <p className="text-sm text-[#9a9aa2]">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-bold text-[#111]">
          Leads{' '}
          <span className="text-[#9a9aa2]">
            ({shown.length}
            {shown.length !== items.length ? ` of ${items.length}` : ''})
          </span>
        </p>
        <p className="text-xs text-[#9a9aa2]">
          {paidCount} paid · {items.length - paidCount} unpaid
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'unpaid', 'paid'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition ${
              filter === f ? 'bg-[#534AB7] text-white' : 'bg-[#f4f3f7] text-[#5b5670]'
            }`}
          >
            {f}
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-[#ece7fb]" />

        {([
          ['newest', 'Newest first'],
          ['oldest', 'Oldest first'],
        ] as const).map(([value, text]) => (
          <button
            key={value}
            onClick={() => setSort(value)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              sort === value ? 'bg-[#534AB7] text-white' : 'bg-[#f4f3f7] text-[#5b5670]'
            }`}
          >
            {text}
          </button>
        ))}

        {filtersActive && (
          <button
            onClick={resetFilters}
            className="ml-auto rounded-full border border-[#e8e0f0] px-4 py-1.5 text-xs font-bold text-[#5b5670] hover:border-[#534AB7] hover:text-[#534AB7]"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#f0ecf8] bg-[#faf9ff] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="lead-search">
            Search
          </label>
          <input
            id="lead-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, phone, job, nationality…"
            className={`${field} w-full`}
          />
        </div>

        <div>
          <label className={label} htmlFor="lead-nationality">
            Nationality
          </label>
          <select
            id="lead-nationality"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            className={`${field} w-full`}
          >
            <option value="all">All nationalities</option>
            {nationalities.map((n) => (
              <option key={n} value={n}>
                {optionLabel(n)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="lead-job">
            Job
          </label>
          <select
            id="lead-job"
            value={job}
            onChange={(e) => setJob(e.target.value)}
            className={`${field} w-full`}
          >
            <option value="all">All jobs</option>
            {jobs.map((j) => (
              <option key={j} value={j}>
                {optionLabel(j)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="lead-referral">
            How heard
          </label>
          <select
            id="lead-referral"
            value={referral}
            onChange={(e) => setReferral(e.target.value)}
            className={`${field} w-full`}
          >
            <option value="all">Any source</option>
            {referrals.map((r) => (
              <option key={r} value={r}>
                {optionLabel(r)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="lead-university">
            University
          </label>
          <select
            id="lead-university"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            className={`${field} w-full`}
          >
            <option value="all">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="">Not specified</option>
          </select>
        </div>

        <div>
          <label className={label} htmlFor="lead-youtube">
            YouTube
          </label>
          <select
            id="lead-youtube"
            value={youtube}
            onChange={(e) => setYoutube(e.target.value)}
            className={`${field} w-full`}
          >
            <option value="all">Any</option>
            <option value="yes">Subscribed</option>
            <option value="no">Not subscribed</option>
            <option value="">Not specified</option>
          </select>
        </div>

        <div>
          <label className={label} htmlFor="lead-from">
            From date
          </label>
          <input
            id="lead-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className={`${field} w-full`}
          />
        </div>

        <div>
          <label className={label} htmlFor="lead-to">
            To date
          </label>
          <input
            id="lead-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className={`${field} w-full`}
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-[#9a9aa2]">
          {items.length === 0 ? 'No leads yet.' : 'No leads match these filters.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#f0ecf8]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#f0ecf8] bg-[#faf9ff] text-xs uppercase text-[#9a9aa2]">
                <th className="px-4 py-3 font-bold">Name</th>
                <th className="px-4 py-3 font-bold">Phone</th>
                <th className="px-4 py-3 font-bold">Nationality</th>
                <th className="px-4 py-3 font-bold">Job</th>
                <th className="px-4 py-3 font-bold">University</th>
                <th className="px-4 py-3 font-bold">YouTube</th>
                <th className="px-4 py-3 font-bold">How heard</th>
                <th className="px-4 py-3 font-bold">Date</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.id} className="border-b border-[#f5f2fb] last:border-0">
                  <td className="px-4 py-3 font-medium text-[#111]">{l.name || '—'}</td>
                  <td className="px-4 py-3 text-[#5b5670]" dir="ltr">
                    {l.phone || '—'}
                  </td>
                  <td className="px-4 py-3 text-[#5b5670]">{l.nationality || '—'}</td>
                  <td className="px-4 py-3 text-[#5b5670]">{l.job || '—'}</td>
                  <td className="px-4 py-3 text-[#5b5670]">{yn(l.university)}</td>
                  <td className="px-4 py-3 text-[#5b5670]">{yn(l.youtube_subscribed)}</td>
                  <td className="px-4 py-3 text-[#5b5670]">{l.referral || '—'}</td>
                  <td className="px-4 py-3 text-[#5b5670]">{fmt(l.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePaid(l)}
                      title={l.paid ? `Paid · ${fmt(l.paid_at)}` : 'Mark as paid'}
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        l.paid
                          ? 'bg-[#E1F5EE] text-[#0C7C62]'
                          : 'bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A]'
                      }`}
                    >
                      {l.paid ? 'Paid' : 'Unpaid'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(l.id)}
                      className="inline-flex items-center rounded-lg bg-[#FEE2E2] px-2.5 py-1.5 text-xs font-bold text-[#DC2626]"
                      aria-label="Delete lead"
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

interface StudentLite {
  user_id: string
  name: string | null
  phone: string | null
  code: string | null
}

interface TrialRow {
  user_id: string
  task_id: string
  used: number
  bonus: number
  updated_at: string
}

function speakingTasksOf(c: Challenge): string[] {
  if (c.speaking_tasks && c.speaking_tasks.length) return c.speaking_tasks
  return c.speaking_task ? [c.speaking_task] : []
}

function TrialsAdmin() {
  const [students, setStudents] = useState<StudentLite[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [grants, setGrants] = useState<TrialRow[]>([])
  const [userId, setUserId] = useState('')
  const [taskKey, setTaskKey] = useState('level_test')
  const [bonus, setBonus] = useState('1')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    const [studentsRes, challengesRes, grantsRes] = await Promise.all([
      supabase
        .from('x50_students')
        .select('user_id, name, phone, code')
        .order('created_at', { ascending: false }),
      supabase.from('x50_challenges').select('*').order('number', { ascending: true }),
      supabase.from('x50_trials').select('user_id, task_id, used, bonus, updated_at').gt('bonus', 0),
    ])
    setStudents((studentsRes.data as StudentLite[]) ?? [])
    setChallenges((challengesRes.data as Challenge[]) ?? [])
    setGrants((grantsRes.data as TrialRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const taskOptions = [
    { key: 'level_test', label: 'Level Test' },
    ...challenges.flatMap((c) => {
      const n = Math.max(speakingTasksOf(c).length, 1)
      return Array.from({ length: n }, (_, i) => ({
        key: i > 0 ? `challenge_${c.id}#${i}` : `challenge_${c.id}`,
        label: `Challenge ${c.number}${n > 1 ? ` · Task ${i + 1}` : ''}`,
      }))
    }),
  ]

  const studentName = (id: string) => {
    const s = students.find((x) => x.user_id === id)
    return s ? s.name || s.phone || id.slice(0, 8) : id.slice(0, 8)
  }

  const taskLabel = (key: string) => {
    if (key === 'level_test') return 'Level Test'
    const m = key.match(/^challenge_(.+?)(?:#(\d+))?$/)
    if (m) {
      const c = challenges.find((ch) => ch.id === m[1])
      const idx = m[2] ? Number(m[2]) : 0
      if (c) return `Challenge ${c.number}${idx ? ` · Task ${idx + 1}` : ''}`
    }
    return key
  }

  const grant = async () => {
    if (!supabase) {
      setMsg('Supabase is not configured.')
      return
    }
    if (!userId) {
      setMsg('Select a student first.')
      return
    }
    const n = Math.min(Math.max(Number(bonus) || 0, 0), 50)
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.rpc('x50_grant_trials', {
      p_user: userId,
      p_task: taskKey,
      p_bonus: n,
    })
    setBusy(false)
    if (error) {
      setMsg(`Error: ${error.message}`)
      return
    }
    setMsg(n > 0 ? `Granted ${n} extra ${n === 1 ? 'trial' : 'trials'} ✓` : 'Bonus cleared ✓')
    load()
  }

  const revoke = async (g: TrialRow) => {
    if (!supabase) return
    await supabase.rpc('x50_grant_trials', { p_user: g.user_id, p_task: g.task_id, p_bonus: 0 })
    load()
  }

  const fieldCls =
    'w-full rounded-xl border border-[#e8e0f0] px-3 py-2 text-sm outline-none focus:border-[#534AB7]'

  if (loading) return <p className="text-sm text-[#9a9aa2]">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#f0ecf8] p-5">
        <h3 className="mb-1 font-bold text-[#111]">Grant extra speaking trials</h3>
        <p className="mb-3 text-xs text-[#9a9aa2]">
          Give a student more attempts on a speaking task (or the level test), on top of the default{' '}
          {MAX_TRIALS}. The extra attempts kick in once they've used their {MAX_TRIALS}.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className={fieldCls}>
            <option value="">Select student…</option>
            {students.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {(s.name || 'Unnamed') +
                  (s.phone ? ` · ${s.phone}` : '') +
                  (s.code ? ` · ${s.code}` : '')}
              </option>
            ))}
          </select>
          <select value={taskKey} onChange={(e) => setTaskKey(e.target.value)} className={fieldCls}>
            {taskOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={50}
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            className="w-24 rounded-xl border border-[#e8e0f0] px-3 py-2 text-sm outline-none focus:border-[#534AB7]"
          />
          <span className="text-xs text-[#9a9aa2]">extra trials</span>
          <button
            onClick={grant}
            disabled={busy || !userId}
            className="rounded-xl bg-[#534AB7] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#46409c] disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Grant'}
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-[#5b5670]">{msg}</p>}
      </div>

      <div>
        <p className="mb-2 px-1 text-sm font-bold text-[#111]">
          Active grants <span className="text-[#9a9aa2]">({grants.length})</span>
        </p>
        {grants.length === 0 ? (
          <p className="text-sm text-[#9a9aa2]">No active grants.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#f0ecf8]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#f0ecf8] bg-[#faf9ff] text-xs uppercase text-[#9a9aa2]">
                  <th className="px-4 py-3 font-bold">Student</th>
                  <th className="px-4 py-3 font-bold">Task</th>
                  <th className="px-4 py-3 font-bold">Used</th>
                  <th className="px-4 py-3 font-bold">Bonus</th>
                  <th className="px-4 py-3 font-bold">Allowed</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {grants.map((g) => (
                  <tr key={`${g.user_id}-${g.task_id}`} className="border-b border-[#f5f2fb] last:border-0">
                    <td className="px-4 py-3 font-medium text-[#111]">{studentName(g.user_id)}</td>
                    <td className="px-4 py-3 text-[#5b5670]">{taskLabel(g.task_id)}</td>
                    <td className="px-4 py-3 text-[#5b5670]">{g.used}</td>
                    <td className="px-4 py-3 text-[#5b5670]">+{g.bonus}</td>
                    <td className="px-4 py-3 text-[#5b5670]">{MAX_TRIALS + g.bonus}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => revoke(g)}
                        className="rounded-lg bg-[#FEE2E2] px-2.5 py-1.5 text-xs font-bold text-[#DC2626]"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
  audio_key: string | null
  created_at: string
}

interface NoteRow {
  student: string | null
  challenge_number: number | null
  entries: string[] | null
  updated_at: string | null
}

interface VideoStat {
  title: string
  uid: string
  percent: number
}

interface ChallengeGroup {
  key: string
  label: string
  number: number | null
  title: string
  videos: VideoStat[]
  subs: Submission[]
  notes: NoteRow[]
}

interface StudentRow {
  name: string
  challenges: ChallengeGroup[]
}

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

/**
 * The Students tab: a whole-cohort "Overview" dashboard (challenge completion +
 * speaking) alongside the existing per-student drill-down list.
 */
function StudentsSection() {
  const [view, setView] = useState<'overview' | 'list'>('overview')
  const subTabs: { key: 'overview' | 'list'; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'list', label: 'Students' },
  ]
  return (
    <div className="space-y-5">
      <div className="inline-flex gap-1 rounded-full bg-[#f4f3f7] p-1">
        {subTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
              view === t.key ? 'bg-white text-[#534AB7] shadow-sm' : 'text-[#5b5670]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <LevelTestBypass />
      <CooldownSkips />
      {view === 'overview' ? <StudentsDashboard /> : <StudentsAdmin />}
    </div>
  )
}

/**
 * Lets the admin mark a student's level test as passed without them actually
 * taking it. Writes a synthetic, already-graded x50_submissions row (or
 * updates their existing level-test row) so every gate that checks for a
 * level-test record — Landing.tsx / StudentHome.tsx via hasLevelTestSubmission
 * — unlocks immediately.
 */
function LevelTestBypass() {
  const [students, setStudents] = useState<StudentLite[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase
      .from('x50_students')
      .select('user_id, name, phone, code')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setStudents((data as StudentLite[]) ?? [])
        setLoading(false)
      })
  }, [])

  const bypass = async () => {
    if (!supabase) {
      setMsg('Supabase is not configured.')
      return
    }
    if (!userId) {
      setMsg('Select a student first.')
      return
    }
    setBusy(true)
    setMsg(null)

    const student = students.find((s) => s.user_id === userId) ?? null
    const label = student ? student.name || student.phone || userId.slice(0, 8) : userId.slice(0, 8)

    // Reuse the student's existing level-test row (if any) so this doesn't
    // pile up duplicate "attempts"; otherwise insert a fresh, pre-passed one.
    const { data: existing, error: findError } = await supabase
      .from('x50_submissions')
      .select('id')
      .eq('user_id', userId)
      .is('challenge_number', null)
      .is('challenge_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError) {
      setBusy(false)
      setMsg(`Error: ${findError.message}`)
      return
    }

    const { error } = existing
      ? await supabase
          .from('x50_submissions')
          .update({ passed: true, score: 100 })
          .eq('id', (existing as { id: string }).id)
      : await supabase.from('x50_submissions').insert({
          challenge_id: null,
          challenge_number: null,
          user_id: userId,
          student: student?.name ?? null,
          question: 'Level Test — marked passed by admin',
          transcript: null,
          score: 100,
          passed: true,
          feedback: 'Marked as passed by an admin, without taking the test.',
          mistakes_json: '[]',
          vocabulary_json: '[]',
          strengths_json: '[]',
          weaknesses_json: '[]',
          corrected_sentences_json: '[]',
          audio_key: null,
        })

    setBusy(false)
    if (error) {
      setMsg(`Error: ${error.message}`)
      return
    }
    setMsg(`${label}'s level test is now marked as passed ✓`)
  }

  if (loading) return null

  return (
    <div className="rounded-2xl border border-[#f0ecf8] p-5">
      <h3 className="mb-1 font-bold text-[#111]">Bypass the level test</h3>
      <p className="mb-3 text-xs text-[#9a9aa2]">
        Mark a student's level test as passed without them completing it. This unlocks the
        challenges for their account immediately, on any device.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full rounded-xl border border-[#e8e0f0] px-3 py-2 text-sm outline-none focus:border-[#534AB7] sm:flex-1"
        >
          <option value="">Select student…</option>
          {students.map((s) => (
            <option key={s.user_id} value={s.user_id}>
              {(s.name || 'Unnamed') + (s.phone ? ` · ${s.phone}` : '') + (s.code ? ` · ${s.code}` : '')}
            </option>
          ))}
        </select>
        <button
          onClick={bypass}
          disabled={busy || !userId}
          className="shrink-0 rounded-xl bg-[#534AB7] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#46409c] disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Mark as passed'}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-[#5b5670]">{msg}</p>}
    </div>
  )
}

interface CooldownSkipRow {
  user_id: string
  challenge_number: number
  created_at: string
}

/**
 * Waives the 5-day cooldown for one student on one challenge. Writes a row to
 * x50_cooldown_skips, which challengeLockState() reads: the challenge opens as
 * soon as the previous one is finished, with no wait. The "finish the previous
 * challenge first" rule still applies — this only removes the gap.
 */
function CooldownSkips() {
  const [students, setStudents] = useState<StudentLite[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [skips, setSkips] = useState<CooldownSkipRow[]>([])
  const [userId, setUserId] = useState('')
  const [challengeNumber, setChallengeNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    const [studentsRes, challengesRes, skipsRes] = await Promise.all([
      supabase
        .from('x50_students')
        .select('user_id, name, phone, code')
        .order('created_at', { ascending: false }),
      supabase.from('x50_challenges').select('*').order('number', { ascending: true }),
      supabase
        .from('x50_cooldown_skips')
        .select('user_id, challenge_number, created_at')
        .order('created_at', { ascending: false }),
    ])
    setStudents((studentsRes.data as StudentLite[]) ?? [])
    setChallenges((challengesRes.data as Challenge[]) ?? [])
    setSkips((skipsRes.data as CooldownSkipRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const studentName = (id: string) => {
    const s = students.find((x) => x.user_id === id)
    return s ? s.name || s.phone || id.slice(0, 8) : id.slice(0, 8)
  }

  const challengeLabel = (n: number) => {
    const c = challenges.find((ch) => ch.number === n)
    return `Challenge ${n}${c?.title ? ` · ${c.title}` : ''}`
  }

  const grant = async () => {
    if (!supabase) {
      setMsg('Supabase is not configured.')
      return
    }
    if (!userId || !challengeNumber) {
      setMsg('Pick a student and a challenge first.')
      return
    }
    setBusy(true)
    setMsg(null)
    const { error } = await supabase
      .from('x50_cooldown_skips')
      .upsert(
        { user_id: userId, challenge_number: Number(challengeNumber) },
        { onConflict: 'user_id,challenge_number' },
      )
    setBusy(false)
    if (error) {
      setMsg(`Error: ${error.message}`)
      return
    }
    setMsg(
      `${studentName(userId)} can open ${challengeLabel(Number(challengeNumber))} without the wait ✓`,
    )
    load()
  }

  const revoke = async (row: CooldownSkipRow) => {
    if (!supabase) return
    await supabase
      .from('x50_cooldown_skips')
      .delete()
      .eq('user_id', row.user_id)
      .eq('challenge_number', row.challenge_number)
    load()
  }

  const fieldCls =
    'w-full rounded-xl border border-[#e8e0f0] px-3 py-2 text-sm outline-none focus:border-[#534AB7]'

  if (loading) return null

  return (
    <div className="rounded-2xl border border-[#f0ecf8] p-5">
      <h3 className="mb-1 font-bold text-[#111]">Skip the cooldown</h3>
      <p className="mb-3 text-xs text-[#9a9aa2]">
        Challenges normally unlock {COOLDOWN_DAYS} days after the previous one is finished. Pick a
        student and a challenge to drop that wait for them — the challenge opens as soon as they
        finish the one before it. Everything else stays the same.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className={fieldCls}>
          <option value="">Select student…</option>
          {students.map((s) => (
            <option key={s.user_id} value={s.user_id}>
              {(s.name || 'Unnamed') +
                (s.phone ? ` · ${s.phone}` : '') +
                (s.code ? ` · ${s.code}` : '')}
            </option>
          ))}
        </select>
        <select
          value={challengeNumber}
          onChange={(e) => setChallengeNumber(e.target.value)}
          className={fieldCls}
        >
          <option value="">Select challenge…</option>
          {challenges.map((c) => (
            <option key={c.id} value={c.number}>
              {challengeLabel(c.number)}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={grant}
        disabled={busy || !userId || !challengeNumber}
        className="mt-2 rounded-xl bg-[#534AB7] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#46409c] disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Skip the cooldown'}
      </button>
      {msg && <p className="mt-2 text-xs text-[#5b5670]">{msg}</p>}

      <div className="mt-5">
        <p className="mb-2 text-sm font-bold text-[#111]">
          Active skips <span className="text-[#9a9aa2]">({skips.length})</span>
        </p>
        {skips.length === 0 ? (
          <p className="text-sm text-[#9a9aa2]">No cooldown skips granted.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#f0ecf8]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#f0ecf8] bg-[#faf9ff] text-xs uppercase text-[#9a9aa2]">
                  <th className="px-4 py-3 font-bold">Student</th>
                  <th className="px-4 py-3 font-bold">Challenge</th>
                  <th className="px-4 py-3 font-bold">Granted</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {skips.map((row) => (
                  <tr
                    key={`${row.user_id}-${row.challenge_number}`}
                    className="border-b border-[#f5f2fb] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-[#111]">{studentName(row.user_id)}</td>
                    <td className="px-4 py-3 text-[#5b5670]">
                      {challengeLabel(row.challenge_number)}
                    </td>
                    <td className="px-4 py-3 text-[#5b5670]">{fmtDate(row.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => revoke(row)}
                        className="rounded-lg bg-[#FEE2E2] px-2.5 py-1.5 text-xs font-bold text-[#DC2626]"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StudentsAdmin() {
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openStudent, setOpenStudent] = useState<string | null>(null)
  const [openChallenge, setOpenChallenge] = useState<string | null>(null)

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
      supabase.from('x50_notes').select('student, challenge_number, entries, updated_at'),
      supabase.from('x50_challenges').select('*').order('number', { ascending: true }),
    ]).then(([views, subs, codes, notes, challengesRes]) => {
      const premium = new Set(
        ((codes.data as { used_by: string | null }[]) ?? [])
          .map((c) => c.used_by)
          .filter((v): v is string => !!v),
      )
      const challenges = (challengesRes.data as Challenge[]) ?? []

      // Group every record under its student.
      type Raw = { views: VideoView[]; subs: Submission[]; notes: NoteRow[] }
      const raw = new Map<string, Raw>()
      const keyOf = (s: string | null) => s || 'زائر غير معرّف'
      const get = (s: string | null) => {
        const key = keyOf(s)
        if (!raw.has(key)) raw.set(key, { views: [], subs: [], notes: [] })
        return raw.get(key)!
      }
      ;((views.data as VideoView[]) ?? []).forEach((v) => get(v.student).views.push(v))
      ;((subs.data as Submission[]) ?? []).forEach((s) => get(s.student).subs.push(s))
      ;((notes.data as NoteRow[]) ?? []).forEach((n) => get(n.student).notes.push(n))

      const result: StudentRow[] = []
      for (const [name, r] of raw) {
        if (!premium.has(name)) continue

        // Furthest watched percent per video uid.
        const maxByUid = new Map<string, number>()
        for (const v of r.views) {
          if (!v.video_id) continue
          maxByUid.set(v.video_id, Math.max(maxByUid.get(v.video_id) ?? 0, v.watched_percent))
        }
        // Speaking / notes indexed by challenge number.
        const subsByNum = new Map<number, Submission[]>()
        const levelSubs: Submission[] = []
        for (const s of r.subs) {
          if (s.challenge_number == null) levelSubs.push(s)
          else (subsByNum.get(s.challenge_number) ?? subsByNum.set(s.challenge_number, []).get(s.challenge_number)!).push(s)
        }
        const notesByNum = new Map<number, NoteRow[]>()
        for (const n of r.notes) {
          if (n.challenge_number == null) continue
          ;(notesByNum.get(n.challenge_number) ?? notesByNum.set(n.challenge_number, []).get(n.challenge_number)!).push(n)
        }

        const groups: ChallengeGroup[] = []
        if (levelSubs.length) {
          groups.push({
            key: `${name}::lt`,
            label: 'Level test',
            number: null,
            title: '',
            videos: [],
            subs: levelSubs,
            notes: [],
          })
        }
        for (const c of challenges) {
          groups.push({
            key: `${name}::${c.number}`,
            label: `Challenge ${c.number}`,
            number: c.number,
            title: c.title ?? '',
            videos: challengeVideos(c).map((v, i) => ({
              title: v.title || `Video ${i + 1}`,
              uid: v.uid,
              percent: maxByUid.get(v.uid) ?? 0,
            })),
            subs: subsByNum.get(c.number) ?? [],
            notes: notesByNum.get(c.number) ?? [],
          })
        }
        result.push({ name, challenges: groups })
      }

      setStudents(result.sort((a, b) => a.name.localeCompare(b.name)))
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-sm text-[#9a9aa2]">Loading…</p>
  if (students.length === 0)
    return <p className="text-sm text-[#9a9aa2]">No premium students yet.</p>

  return (
    <div className="space-y-3">
      {students.map((st) => {
        const sOpen = openStudent === st.name
        return (
          <div key={st.name} className="rounded-2xl border border-[#f0ecf8]">
            <button
              onClick={() => {
                setOpenStudent(sOpen ? null : st.name)
                setOpenChallenge(null)
              }}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <div>
                <p className="font-bold text-[#111]">{st.name}</p>
                <p className="text-xs text-[#9a9aa2]">
                  {st.challenges.filter((c) => c.number != null).length} challenge
                  {st.challenges.filter((c) => c.number != null).length === 1 ? '' : 's'}
                </p>
              </div>
              <span className="text-[#534AB7]">{sOpen ? '▲' : '▼'}</span>
            </button>

            {sOpen && (
              <div className="space-y-2 border-t border-[#f0ecf8] p-3">
                {st.challenges.map((cg) => (
                  <ChallengePanel
                    key={cg.key}
                    group={cg}
                    open={openChallenge === cg.key}
                    onToggle={() =>
                      setOpenChallenge(openChallenge === cg.key ? null : cg.key)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ChallengePanel({
  group,
  open,
  onToggle,
}: {
  group: ChallengeGroup
  open: boolean
  onToggle: () => void
}) {
  const noteWords = group.notes.reduce((m, n) => m + (n.entries ?? []).length, 0)
  const avgWatched = group.videos.length
    ? Math.round(group.videos.reduce((m, v) => m + v.percent, 0) / group.videos.length)
    : null

  return (
    <div className="overflow-hidden rounded-xl border border-[#f0ecf8]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-[#faf9ff] px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#1b1730]">
            {group.label}
            {group.title ? <span className="font-semibold text-[#7a7596]"> · {group.title}</span> : null}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] font-semibold text-[#9a9aa2]">
            {avgWatched != null && <span>🎬 {avgWatched}% watched</span>}
            <span>🎤 {group.subs.length} speaking</span>
            <span>📝 {noteWords} words</span>
          </p>
        </div>
        <span className="shrink-0 text-[#534AB7]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-[#f0ecf8] p-3">
          {/* Videos watched */}
          {group.videos.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9a9aa2]">
                Videos watched
              </p>
              <div className="space-y-2">
                {group.videos.map((v, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-xs font-semibold text-[#5b5670]" dir="ltr">
                      {v.title}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEEDFE]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, v.percent)}%`,
                          backgroundColor: v.percent >= 98 ? '#23C4A0' : '#534AB7',
                        }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-bold text-[#534AB7]">
                      {v.percent}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Speaking tasks */}
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9a9aa2]">
              Speaking task
            </p>
            {group.subs.length === 0 ? (
              <p className="text-sm text-[#9a9aa2]">No speaking submission.</p>
            ) : (
              <div className="space-y-3">
                {group.subs.map((s) => (
                  <div key={s.id} className="rounded-xl border border-[#f0ecf8] p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs font-bold text-[#534AB7]">{fmtDate(s.created_at)}</p>
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
                    {s.audio_key && (
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <audio controls preload="none" src={audioUrl(s.audio_key)} className="h-9 w-full max-w-xs" />
                        <a
                          href={audioUrl(s.audio_key, { download: true })}
                          className="rounded-lg bg-[#EEEDFE] px-3 py-1.5 text-xs font-bold text-[#534AB7]"
                        >
                          ⬇ Download
                        </a>
                      </div>
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
          </section>

          {/* Vocabulary notes */}
          {group.number != null && (
            <section>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9a9aa2]">
                Student notes
              </p>
              {noteWords === 0 ? (
                <p className="text-sm text-[#9a9aa2]">No notes submitted.</p>
              ) : (
                group.notes.map((n, i) => (
                  <div key={i} className="mb-2">
                    <p className="mb-1 text-[11px] font-semibold text-[#9a9aa2]">
                      {(n.entries ?? []).length} words · {fmtDate(n.updated_at)}
                    </p>
                    <div className="flex flex-wrap gap-1.5" dir="ltr">
                      {(n.entries ?? []).map((w, j) => (
                        <span
                          key={j}
                          className="rounded-lg bg-[#f1edff] px-2.5 py-1 text-[13px] font-semibold text-[#473BBE]"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          )}
        </div>
      )}
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

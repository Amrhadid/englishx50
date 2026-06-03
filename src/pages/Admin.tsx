import { useEffect, useState } from 'react'
import { supabase, REVIEWS_BUCKET } from '../lib/supabase'
import type { Challenge, Review } from '../types'
import { TrashIcon } from '../components/icons'

const ADMIN_PASSWORD = 'amr2024'

type Tab = 'challenges' | 'reviews'

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
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const [tab, setTab] = useState<Tab>('challenges')

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-5" dir="ltr">
        <div className="w-full max-w-sm rounded-3xl border border-[#f0ecf8] p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#534AB7] font-extrabold text-white">
              X
            </span>
            <span className="text-lg font-extrabold text-[#111]">EnglishX50 Admin</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (pw === ADMIN_PASSWORD) {
                setAuthed(true)
                setPwError(false)
              } else {
                setPwError(true)
              }
            }}
          >
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full rounded-2xl border border-[#e8e0f0] px-4 py-3 text-sm outline-none focus:border-[#534AB7]"
            />
            {pwError && <p className="mt-2 text-xs text-[#FF6B6B]">Incorrect password.</p>}
            <button
              type="submit"
              className="mt-4 w-full rounded-2xl bg-[#534AB7] py-3 text-sm font-bold text-white hover:bg-[#46409c]"
            >
              Sign in
            </button>
          </form>
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
          <a href="/" className="text-sm font-medium text-[#534AB7] hover:underline">
            View site →
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-6">
        <div className="mb-6 flex gap-2">
          {(['challenges', 'reviews'] as Tab[]).map((t) => (
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

        {tab === 'challenges' ? <ChallengesAdmin /> : <ReviewsAdmin />}
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
          placeholder="Video URL"
          value={form.video_url}
          onChange={(e) => setForm({ ...form, video_url: e.target.value })}
          className={field}
        />
        <input
          placeholder="PDF URL"
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

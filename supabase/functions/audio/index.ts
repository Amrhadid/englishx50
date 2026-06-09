// EnglishX50 — speaking-audio storage on Cloudflare R2 (S3-compatible).
//
//   POST  (multipart, field `file`)  -> uploads the audio, returns { key }
//   GET   ?key=...[&download=1]       -> streams the audio back (supports Range)
//
// Keeps R2 credentials server-side; the admin <audio> player points at the GET
// URL so recordings play inline (and download with &download=1) without a
// public bucket.
//
// Deploy: supabase functions deploy audio --no-verify-jwt
// Secrets (already set): CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_BUCKET,
//   CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'

const ENDPOINT = (Deno.env.get('CLOUDFLARE_R2_ENDPOINT') ?? '').replace(/\/$/, '')
const BUCKET = Deno.env.get('CLOUDFLARE_R2_BUCKET') ?? ''
const ACCESS_KEY_ID = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID') ?? ''
const SECRET_ACCESS_KEY = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const r2 = new AwsClient({
  accessKeyId: ACCESS_KEY_ID,
  secretAccessKey: SECRET_ACCESS_KEY,
  region: 'auto',
  service: 's3',
})

const objUrl = (key: string) => `${ENDPOINT}/${BUCKET}/${key}`

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function extOf(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  return 'webm'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (!ENDPOINT || !BUCKET || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    return json({ error: 'R2 not configured' }, 500)
  }

  const url = new URL(req.url)

  // --- Upload ---
  if (req.method === 'POST') {
    try {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof Blob)) return json({ error: 'No file provided' }, 400)
      const key = `audio/${Date.now()}-${crypto.randomUUID()}.${extOf(file.type || 'audio/webm')}`
      const bytes = new Uint8Array(await file.arrayBuffer())
      const put = await r2.fetch(objUrl(key), {
        method: 'PUT',
        body: bytes,
        headers: { 'content-type': file.type || 'audio/webm' },
      })
      if (!put.ok) return json({ error: `R2 upload failed (${put.status})`, detail: await put.text() }, 502)
      return json({ key })
    } catch (e) {
      return json({ error: 'Upload error', detail: String(e) }, 500)
    }
  }

  // --- Serve (inline playback / download) ---
  const key = url.searchParams.get('key')
  if (!key) return json({ error: 'Missing key' }, 400)

  const range = req.headers.get('range')
  const get = await r2.fetch(objUrl(key), { headers: range ? { range } : {} })
  if (!get.ok && get.status !== 206) return json({ error: `Not found (${get.status})` }, 404)

  const headers = new Headers(cors)
  headers.set('content-type', get.headers.get('content-type') ?? 'audio/webm')
  headers.set('accept-ranges', 'bytes')
  const cl = get.headers.get('content-length')
  if (cl) headers.set('content-length', cl)
  const cr = get.headers.get('content-range')
  if (cr) headers.set('content-range', cr)
  if (url.searchParams.get('download')) {
    headers.set('content-disposition', `attachment; filename="${key.split('/').pop()}"`)
  }
  return new Response(get.body, { status: get.status, headers })
})

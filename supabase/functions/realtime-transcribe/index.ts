// EnglishX50 — realtime speech-to-text relay (Deno / Supabase).
//
// A dumb WebSocket pipe between the browser and the OpenAI Realtime API. The
// browser speaks the OpenAI Realtime transcription protocol; this relay just
// forwards messages both ways, attaching the API key server-side (via the
// WebSocket subprotocol) so it's never exposed to the client.
//
// Deploy:
//   supabase functions deploy realtime-transcribe --no-verify-jwt
// Secret required: OPENAI_API_KEY (already set in this project).
//
// Access: premium users (or the admin) only. Browsers can't set WebSocket
// headers, so the client passes its Supabase access token as ?token=… (see
// src/lib/liveTranscribe.ts) and it's validated here before connecting
// upstream — otherwise anyone could open OpenAI Realtime sessions on this
// project's API key.

import { tokenHasPremium } from '../_shared/premium.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const OAI_URL = 'wss://api.openai.com/v1/realtime?intent=transcription'

Deno.serve(async (req) => {
  if ((req.headers.get('upgrade') ?? '').toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 })
  }
  if (!OPENAI_API_KEY) return new Response('OPENAI_API_KEY not configured', { status: 500 })

  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!(await tokenHasPremium(token))) {
    return new Response('Premium account required', { status: 401 })
  }

  const { socket: client, response } = Deno.upgradeWebSocket(req)

  let oai: WebSocket
  try {
    // OpenAI accepts the key via WebSocket subprotocols (used server-side here).
    oai = new WebSocket(OAI_URL, [
      'realtime',
      `openai-insecure-api-key.${OPENAI_API_KEY}`,
      'openai-beta.realtime-v1',
    ])
  } catch {
    try {
      client.close(1011, 'upstream connect failed')
    } catch {
      /* ignore */
    }
    return response
  }

  const queue: unknown[] = []
  let oaiOpen = false

  oai.onopen = () => {
    oaiOpen = true
    for (const m of queue) {
      try {
        oai.send(m as string)
      } catch {
        /* ignore */
      }
    }
    queue.length = 0
  }
  oai.onmessage = (e) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(e.data)
      } catch {
        /* ignore */
      }
    }
  }
  oai.onclose = () => {
    try {
      client.close()
    } catch {
      /* ignore */
    }
  }
  oai.onerror = () => {
    try {
      client.close(1011, 'upstream error')
    } catch {
      /* ignore */
    }
  }

  client.onmessage = (e) => {
    if (oaiOpen && oai.readyState === WebSocket.OPEN) {
      try {
        oai.send(e.data)
      } catch {
        /* ignore */
      }
    } else {
      queue.push(e.data)
    }
  }
  client.onclose = () => {
    try {
      oai.close()
    } catch {
      /* ignore */
    }
  }
  client.onerror = () => {
    try {
      oai.close()
    } catch {
      /* ignore */
    }
  }

  return response
})

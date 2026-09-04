// EnglishX50 /speak — persistence for conversations and turns through
// PostgREST with the service role. Every function returns null on failure so
// the handler can decide what is fatal (a missing conversation) and what is
// not (a failed history read).

import type { FetchLike } from './access.ts'
import { extOf } from './providers.ts'

export interface StoreEnv {
  supabaseUrl: string
  serviceRoleKey: string
}

/** Private bucket — only the admin can generate a listen link (see speaking_audio.sql). */
const AUDIO_BUCKET = 'x50-speaking-audio'

export type ConversationStatus = 'active' | 'completed'

export interface ConversationRow {
  id: string
  user_id: string
  scenario: string
  level: string
  status: ConversationStatus
  speaking_seconds: number
  goal_seconds: number
  started_at: string
  completed_at: string | null
  /** Cached vocabulary review (see speaking_vocabulary.sql) — generated once, on first request. */
  vocab_json: unknown | null
}

export interface TurnRow {
  id: string
  transcript: string
  reply: string
  feedback: unknown
  speaking_seconds: number
  created_at: string
  /** Storage object path for the learner's recording, or null (typed answer, or the upload failed). */
  audio_path: string | null
}

export interface Store {
  latestConversation(userId: string): Promise<ConversationRow | null | undefined>
  conversation(id: string, userId: string): Promise<ConversationRow | null | undefined>
  listConversations(userId: string, limit: number): Promise<ConversationRow[] | null>
  createConversation(input: {
    userId: string
    scenario: string
    level: string
    goalSeconds: number
  }): Promise<ConversationRow | null>
  updateConversation(id: string, patch: Partial<ConversationRow>): Promise<ConversationRow | null>
  turns(conversationId: string): Promise<TurnRow[] | null>
  insertTurn(input: {
    userId: string
    conversationId: string
    scenario: string
    level: string
    transcript: string
    reply: string
    feedback: unknown
    speakingSeconds: number
    audioPath: string | null
  }): Promise<string | null>
  /** Uploads a learner recording and returns its storage path, or null if the upload failed. */
  uploadAudio(input: { userId: string; bytes: Uint8Array; mime: string }): Promise<string | null>
  /**
   * Grants the one-time 20-day subscription gift once this account has 5
   * completed conversations of at least a minute each (see emma_gift.sql).
   * Safe to call after every completion — it re-counts and is guarded
   * server-side, so it can only ever grant once. Returns true only when this
   * call is the one that granted it.
   */
  maybeGrantEmmaGift(userId: string): Promise<boolean>
}

const CONVERSATION_FIELDS =
  'id,user_id,scenario,level,status,speaking_seconds,goal_seconds,started_at,completed_at,vocab_json'
const TURN_FIELDS = 'id,transcript,reply,feedback,speaking_seconds,created_at,audio_path'

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function normaliseConversation(r: Record<string, unknown>): ConversationRow {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    scenario: String(r.scenario),
    level: String(r.level),
    status: r.status === 'completed' ? 'completed' : 'active',
    speaking_seconds: num(r.speaking_seconds),
    goal_seconds: num(r.goal_seconds) || 300,
    started_at: String(r.started_at),
    completed_at: r.completed_at ? String(r.completed_at) : null,
    vocab_json: r.vocab_json ?? null,
  }
}

/**
 * `undefined` from the single-row readers means "the lookup itself failed"
 * (table missing, network), as opposed to `null` = "no such row".
 */
export function createStore(env: StoreEnv, fetchFn: FetchLike): Store {
  const enabled = Boolean(env.supabaseUrl && env.serviceRoleKey)
  const headers = (extra: Record<string, string> = {}) => ({
    apikey: env.serviceRoleKey,
    authorization: `Bearer ${env.serviceRoleKey}`,
    'content-type': 'application/json',
    ...extra,
  })
  const url = (path: string) => `${env.supabaseUrl}/rest/v1/${path}`

  async function rows<T>(path: string, init?: RequestInit): Promise<T[] | null> {
    if (!enabled) return null
    try {
      const resp = await fetchFn(url(path), { ...init, headers: { ...headers(), ...(init?.headers as Record<string, string>) } })
      if (!resp.ok) return null
      const data = await resp.json()
      return Array.isArray(data) ? (data as T[]) : null
    } catch {
      return null
    }
  }

  return {
    async latestConversation(userId) {
      const r = await rows<Record<string, unknown>>(
        `x50_speaking_conversations?user_id=eq.${encodeURIComponent(userId)}&select=${CONVERSATION_FIELDS}&order=started_at.desc&limit=1`,
      )
      if (r === null) return undefined
      return r[0] ? normaliseConversation(r[0]) : null
    },

    async conversation(id, userId) {
      const r = await rows<Record<string, unknown>>(
        `x50_speaking_conversations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=${CONVERSATION_FIELDS}&limit=1`,
      )
      if (r === null) return undefined
      return r[0] ? normaliseConversation(r[0]) : null
    },

    async listConversations(userId, limit) {
      const r = await rows<Record<string, unknown>>(
        `x50_speaking_conversations?user_id=eq.${encodeURIComponent(userId)}&select=${CONVERSATION_FIELDS}&order=started_at.desc&limit=${limit}`,
      )
      return r ? r.map(normaliseConversation) : null
    },

    async createConversation({ userId, scenario, level, goalSeconds }) {
      const r = await rows<Record<string, unknown>>(`x50_speaking_conversations?select=${CONVERSATION_FIELDS}`, {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({ user_id: userId, scenario, level, goal_seconds: goalSeconds }),
      })
      return r?.[0] ? normaliseConversation(r[0]) : null
    },

    async updateConversation(id, patch) {
      const r = await rows<Record<string, unknown>>(
        `x50_speaking_conversations?id=eq.${encodeURIComponent(id)}&select=${CONVERSATION_FIELDS}`,
        {
          method: 'PATCH',
          headers: { prefer: 'return=representation' },
          body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
        },
      )
      return r?.[0] ? normaliseConversation(r[0]) : null
    },

    async turns(conversationId) {
      const r = await rows<Record<string, unknown>>(
        `x50_speaking_turns?conversation_id=eq.${encodeURIComponent(conversationId)}&select=${TURN_FIELDS}&order=created_at.asc&limit=200`,
      )
      return r
        ? r.map((t) => ({
            id: String(t.id),
            transcript: String(t.transcript ?? ''),
            reply: String(t.reply ?? ''),
            feedback: t.feedback ?? null,
            speaking_seconds: num(t.speaking_seconds),
            created_at: String(t.created_at),
            audio_path: typeof t.audio_path === 'string' ? t.audio_path : null,
          }))
        : null
    },

    async insertTurn(input) {
      const r = await rows<{ id?: string }>('x50_speaking_turns?select=id', {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          user_id: input.userId,
          conversation_id: input.conversationId,
          scenario: input.scenario,
          level: input.level,
          transcript: input.transcript,
          reply: input.reply,
          feedback: input.feedback,
          speaking_seconds: Math.round(input.speakingSeconds * 10) / 10,
          audio_path: input.audioPath,
        }),
      })
      return r?.[0]?.id ?? null
    },

    async uploadAudio({ userId, bytes, mime }) {
      if (!enabled || bytes.length === 0) return null
      const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extOf(mime)}`
      try {
        const resp = await fetchFn(`${env.supabaseUrl}/storage/v1/object/${AUDIO_BUCKET}/${path}`, {
          method: 'POST',
          headers: {
            apikey: env.serviceRoleKey,
            authorization: `Bearer ${env.serviceRoleKey}`,
            'content-type': mime || 'audio/webm',
          },
          body: bytes,
        })
        return resp.ok ? path : null
      } catch {
        return null
      }
    },

    async maybeGrantEmmaGift(userId) {
      if (!enabled) return false
      try {
        const resp = await fetchFn(`${env.supabaseUrl}/rest/v1/rpc/x50_maybe_grant_emma_gift`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ p_user: userId }),
        })
        if (!resp.ok) return false
        const data = (await resp.json()) as { granted?: unknown }
        return data?.granted === true
      } catch {
        return false
      }
    },
  }
}

/** Rough speaking time for a typed answer (about 150 words a minute), capped. */
export function estimateSpokenSeconds(text: string, cap: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.min(cap, Math.round((words / 2.5) * 10) / 10)
}

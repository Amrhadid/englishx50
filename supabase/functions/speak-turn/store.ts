// EnglishX50 /speak — persistence for conversations and turns through
// PostgREST with the service role. Every function returns null on failure so
// the handler can decide what is fatal (a missing conversation) and what is
// not (a failed history read).

import type { FetchLike } from './access.ts'

export interface StoreEnv {
  supabaseUrl: string
  serviceRoleKey: string
}

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
}

export interface TurnRow {
  id: string
  transcript: string
  reply: string
  feedback: unknown
  speaking_seconds: number
  created_at: string
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
  }): Promise<string | null>
}

const CONVERSATION_FIELDS =
  'id,user_id,scenario,level,status,speaking_seconds,goal_seconds,started_at,completed_at'
const TURN_FIELDS = 'id,transcript,reply,feedback,speaking_seconds,created_at'

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
        }),
      })
      return r?.[0]?.id ?? null
    },
  }
}

/** Rough speaking time for a typed answer (about 150 words a minute), capped. */
export function estimateSpokenSeconds(text: string, cap: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.min(cap, Math.round((words / 2.5) * 10) / 10)
}

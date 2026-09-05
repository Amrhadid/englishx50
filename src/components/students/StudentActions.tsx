import { useState } from 'react'
import {
  adjustSubscription,
  bypassLevelTest,
  revokeSkip,
  revokeUnlock,
  setTrialBonus,
  skipCooldown,
  trialTaskKey,
  unlockChallenge,
  type StudentRecord,
} from '../../lib/students'
import { challengeSpeakingTasks } from '../../lib/challenge'
import { COOLDOWN_DAYS } from '../../lib/completion'
import { MAX_TRIALS } from '../../lib/progress'
import type { Challenge } from '../../types'
import { Badge, Card, SectionTitle } from './ui'
import { BTN_DANGER, BTN_PRIMARY, FIELD, fmtDateTime } from './format'

type Result = { ok: true } | { ok: false; error: string }

/**
 * Per-student admin actions. Every action here used to live in a cohort-wide
 * panel with a student picker; scoping them to the open profile removes the
 * picker and shows only what applies to this student.
 */
export default function StudentActions({
  student: s,
  challenges,
  onChanged,
}: {
  student: StudentRecord
  challenges: Challenge[]
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [unlockNum, setUnlockNum] = useState('')
  const [skipNum, setSkipNum] = useState('')
  const [trialTask, setTrialTask] = useState('level_test')
  const [trialBonus, setTrialBonusInput] = useState('1')
  const [subDays, setSubDays] = useState('30')

  const run = async (key: string, action: () => Promise<Result>, success: string) => {
    setBusy(key)
    setMsg(null)
    const res = await action()
    setBusy(null)
    if (res.ok) {
      setMsg({ text: success, ok: true })
      onChanged()
    } else {
      setMsg({ text: `Error: ${res.error}`, ok: false })
    }
  }

  const challengeLabel = (n: number) => {
    const c = challenges.find((x) => x.number === n)
    return `Challenge ${n}${c?.title ? ` · ${c.title}` : ''}`
  }

  const taskOptions = [
    { key: 'level_test', label: 'Level test' },
    ...challenges.flatMap((c) => {
      const n = Math.max(challengeSpeakingTasks(c).length, 1)
      return Array.from({ length: n }, (_, i) => ({
        key: trialTaskKey(c.id, i),
        label: `Challenge ${c.number}${n > 1 ? ` · Task ${i + 1}` : ''}`,
      }))
    }),
  ]
  const taskLabel = (key: string) => taskOptions.find((o) => o.key === key)?.label ?? key

  const bonusTrials = s.trials.filter((t) => t.bonus > 0)
  const usedTrials = s.trials.filter((t) => t.used > 0)

  return (
    <div className="space-y-4">
      {msg && (
        <p className={`rounded-xl px-3 py-2 text-sm font-bold ${msg.ok ? 'bg-[#E1F5EE] text-[#0C7C62]' : 'bg-[#FEE2E2] text-[#B91C1C]'}`}>
          {msg.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Subscription */}
        <Card className="p-5 lg:col-span-2">
          <SectionTitle
            hint={
              s.subscription === 'none'
                ? 'no subscription'
                : s.daysLeft != null && s.daysLeft > 0
                  ? `${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left`
                  : `expired ${Math.abs(s.daysLeft ?? 0)} day${Math.abs(s.daysLeft ?? 0) === 1 ? '' : 's'} ago`
            }
          >
            Subscription
          </SectionTitle>
          <p className="mb-3 text-xs text-[#9a9aa2]">
            {s.subscription === 'none'
              ? 'This student has not redeemed a code. Adding days starts a subscription with that many days left.'
              : 'Add days to extend the 100-day subscription, or remove days to shorten it. Takes effect on their next page load.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {[7, 20, 30].map((d) => (
              <button
                key={d}
                onClick={() => run(`sub+${d}`, () => adjustSubscription(s.id, d), `Added ${d} days for ${s.name} ✓`)}
                disabled={busy !== null}
                className="rounded-xl bg-[#EEEDFE] px-3.5 py-2 text-sm font-bold text-[#534AB7] hover:bg-[#e2e0fb] disabled:opacity-60"
              >
                +{d} days
              </button>
            ))}
            <span className="mx-1 text-[#c9c6d8]">|</span>
            <input
              type="number"
              min={-3650}
              max={3650}
              value={subDays}
              onChange={(e) => setSubDays(e.target.value)}
              className={`${FIELD} w-24`}
              aria-label="Days to add (negative to remove)"
            />
            <button
              onClick={() => {
                const d = Math.round(Number(subDays))
                if (!d) {
                  setMsg({ text: 'Enter a non-zero number of days.', ok: false })
                  return
                }
                run('sub', () => adjustSubscription(s.id, d), `${d > 0 ? `Added ${d}` : `Removed ${-d}`} days for ${s.name} ✓`)
              }}
              disabled={busy !== null}
              className={BTN_PRIMARY}
            >
              {busy?.startsWith('sub') ? 'Saving…' : 'Apply'}
            </button>
            <span className="text-[11px] text-[#9a9aa2]">negative removes days</span>
          </div>
        </Card>

        {/* Level test */}
        <Card className="p-5">
          <SectionTitle>Level test</SectionTitle>
          <p className="text-sm text-[#5b5670]">
            {s.stats.levelTest === 'passed'
              ? '✅ Passed — the challenges are unlocked for this account.'
              : s.stats.levelTest === 'failed'
                ? `❌ Taken ${s.levelTestSubmissions.length} time${s.levelTestSubmissions.length === 1 ? '' : 's'}, not passed yet.`
                : 'Not taken yet.'}
          </p>
          {s.stats.levelTest !== 'passed' && (
            <>
              <p className="mt-2 text-xs text-[#9a9aa2]">
                Mark it as passed without the student taking it. This unlocks the challenges for their account immediately, on any device.
              </p>
              <button
                onClick={() => run('bypass', () => bypassLevelTest(s), `${s.name}'s level test is now marked as passed ✓`)}
                disabled={busy !== null}
                className={`${BTN_PRIMARY} mt-3`}
              >
                {busy === 'bypass' ? 'Saving…' : 'Mark as passed'}
              </button>
            </>
          )}
        </Card>

        {/* Extra trials */}
        <Card className="p-5">
          <SectionTitle>Extra speaking trials</SectionTitle>
          <p className="mb-3 text-xs text-[#9a9aa2]">
            Each speaking task allows {MAX_TRIALS} attempts. Grant more for one task — they kick in once the first {MAX_TRIALS} are used. Set 0 to clear.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={trialTask} onChange={(e) => setTrialTask(e.target.value)} className={`${FIELD} min-w-0 flex-1`}>
              {taskOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <input type="number" min={0} max={50} value={trialBonus} onChange={(e) => setTrialBonusInput(e.target.value)} className={`${FIELD} w-20`} aria-label="Extra trials" />
            <button
              onClick={() =>
                run(
                  'trials',
                  () => setTrialBonus(s.id, trialTask, Number(trialBonus)),
                  Number(trialBonus) > 0 ? `Granted ${trialBonus} extra trial${trialBonus === '1' ? '' : 's'} on ${taskLabel(trialTask)} ✓` : 'Bonus cleared ✓',
                )
              }
              disabled={busy !== null}
              className={BTN_PRIMARY}
            >
              {busy === 'trials' ? 'Saving…' : 'Grant'}
            </button>
          </div>
          {(bonusTrials.length > 0 || usedTrials.length > 0) && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-[#f0ecf8]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#f0ecf8] bg-[#faf9ff] uppercase text-[#9a9aa2]">
                    <th className="px-3 py-2 font-bold">Task</th>
                    <th className="px-3 py-2 font-bold">Used</th>
                    <th className="px-3 py-2 font-bold">Allowed</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {s.trials.map((t) => (
                    <tr key={t.task_id} className="border-b border-[#f5f2fb] last:border-0">
                      <td className="px-3 py-2 font-semibold text-[#111]">{taskLabel(t.task_id)}</td>
                      <td className="px-3 py-2 text-[#5b5670]">
                        {t.used}
                        {t.used >= MAX_TRIALS + t.bonus && <Badge tone="red">limit</Badge>}
                      </td>
                      <td className="px-3 py-2 text-[#5b5670]">
                        {MAX_TRIALS + t.bonus}
                        {t.bonus > 0 && <span className="text-[#A66A09]"> (+{t.bonus})</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {t.bonus > 0 && (
                          <button
                            onClick={() => run(`revoke-${t.task_id}`, () => setTrialBonus(s.id, t.task_id, 0), 'Bonus cleared ✓')}
                            disabled={busy !== null}
                            className={BTN_DANGER}
                          >
                            Clear
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Unlock now */}
        <Card className="p-5">
          <SectionTitle>Unlock a challenge now</SectionTitle>
          <p className="mb-3 text-xs text-[#9a9aa2]">
            Opens a challenge straight away, even if the one before it isn't finished. Ignores the order and the cooldown entirely.
          </p>
          <div className="flex gap-2">
            <select value={unlockNum} onChange={(e) => setUnlockNum(e.target.value)} className={`${FIELD} min-w-0 flex-1`}>
              <option value="">Select challenge…</option>
              {challenges.map((c) => (
                <option key={c.id} value={c.number} disabled={s.unlocks.includes(c.number)}>
                  {challengeLabel(c.number)}
                  {s.unlocks.includes(c.number) ? ' (unlocked)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => run('unlock', () => unlockChallenge(s.id, Number(unlockNum)), `${challengeLabel(Number(unlockNum))} is now open for ${s.name} ✓`)}
              disabled={busy !== null || !unlockNum}
              className={BTN_PRIMARY}
            >
              {busy === 'unlock' ? 'Saving…' : 'Unlock'}
            </button>
          </div>
          <GrantList
            items={s.unlocks}
            label={challengeLabel}
            empty="No challenges unlocked for this student."
            onRevoke={(n) => run(`unlock-${n}`, () => revokeUnlock(s.id, n), `Unlock revoked for ${challengeLabel(n)}`)}
            busy={busy !== null}
          />
        </Card>

        {/* Skip cooldown */}
        <Card className="p-5">
          <SectionTitle>Skip the cooldown</SectionTitle>
          <p className="mb-3 text-xs text-[#9a9aa2]">
            Challenges normally open {COOLDOWN_DAYS} days after the previous one is finished. Drop that wait for one challenge — they still have to finish the one before it.
          </p>
          {s.nextUnlock && (
            <p className="mb-3 rounded-xl bg-[#FFF8EC] px-3 py-2 text-xs font-semibold text-[#A66A09]">
              🔒 Right now Challenge {s.nextUnlock.number} is waiting {s.nextUnlock.daysLeft} more day{s.nextUnlock.daysLeft === 1 ? '' : 's'}.{' '}
              <button
                onClick={() => run('skip-next', () => skipCooldown(s.id, s.nextUnlock!.number), `${challengeLabel(s.nextUnlock!.number)} opens now for ${s.name} ✓`)}
                disabled={busy !== null}
                className="underline"
              >
                Skip it
              </button>
            </p>
          )}
          <div className="flex gap-2">
            <select value={skipNum} onChange={(e) => setSkipNum(e.target.value)} className={`${FIELD} min-w-0 flex-1`}>
              <option value="">Select challenge…</option>
              {challenges.map((c) => (
                <option key={c.id} value={c.number} disabled={s.skips.includes(c.number)}>
                  {challengeLabel(c.number)}
                  {s.skips.includes(c.number) ? ' (skipped)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => run('skip', () => skipCooldown(s.id, Number(skipNum)), `${s.name} can open ${challengeLabel(Number(skipNum))} without the wait ✓`)}
              disabled={busy !== null || !skipNum}
              className={BTN_PRIMARY}
            >
              {busy === 'skip' ? 'Saving…' : 'Skip'}
            </button>
          </div>
          <GrantList
            items={s.skips}
            label={challengeLabel}
            empty="No cooldown skips for this student."
            onRevoke={(n) => run(`skip-${n}`, () => revokeSkip(s.id, n), `Cooldown skip revoked for ${challengeLabel(n)}`)}
            busy={busy !== null}
          />
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle>Account</SectionTitle>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[11px] font-bold uppercase text-[#9a9aa2]">User id</dt>
            <dd className="truncate font-mono text-xs text-[#5b5670]" title={s.id}>
              {s.id}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase text-[#9a9aa2]">Account created</dt>
            <dd className="font-bold text-[#111]">{fmtDateTime(s.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase text-[#9a9aa2]">Code redeemed</dt>
            <dd className="font-bold text-[#111]">{fmtDateTime(s.redeemedAt)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase text-[#9a9aa2]">Emma gift</dt>
            <dd className="font-bold text-[#111]">{s.emmaGiftClaimedAt ? fmtDateTime(s.emmaGiftClaimedAt) : 'not claimed'}</dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}

function GrantList({
  items,
  label,
  empty,
  onRevoke,
  busy,
}: {
  items: number[]
  label: (n: number) => string
  empty: string
  onRevoke: (n: number) => void
  busy: boolean
}) {
  if (items.length === 0) return <p className="mt-3 text-xs text-[#9a9aa2]">{empty}</p>
  return (
    <ul className="mt-3 divide-y divide-[#f5f2fb] rounded-xl border border-[#f0ecf8]">
      {[...items]
        .sort((a, b) => a - b)
        .map((n) => (
          <li key={n} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="font-semibold text-[#111]">{label(n)}</span>
            <button onClick={() => onRevoke(n)} disabled={busy} className={BTN_DANGER}>
              Revoke
            </button>
          </li>
        ))}
    </ul>
  )
}

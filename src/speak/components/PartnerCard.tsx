import EmmaAvatar from './EmmaAvatar'
import { levelLabel, SCENARIOS } from '../scenarios'
import { T } from '../text'
import type { LevelId, ScenarioId, SessionPhase } from '../types'

interface Props {
  level: LevelId
  scenario: ScenarioId
  phase: SessionPhase
  prompt?: string
  onReplay: () => void
  canReplay: boolean
  /** Overrides the status pill text (e.g. once today's speaking goal is reached). */
  statusLabel?: string
}

function ReplayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12a7 7 0 1 0 2.2-5.1M5 4v5h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function PartnerCard({ level, scenario, phase, prompt, onReplay, canReplay, statusLabel }: Props) {
  const speaking = phase === 'speaking'
  const scenarioLabel = SCENARIOS.find((item) => item.id === scenario)?.label
  return (
    <section className={`spk-stage ${speaking ? 'is-speaking' : ''}`} aria-label={`${T.partnerName} — ${T.partnerRole}`}>
      <div className="spk-session-status">
        <EmmaAvatar size={42} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <strong className="spk-en">{T.partnerName}</strong>
            <span className="spk-online-dot" aria-hidden="true" />
            <span>{statusLabel ?? T.statusPill}</span>
          </div>
          <p>
            {scenarioLabel} · {T.levelPrefix} {levelLabel(level)}
          </p>
        </div>
      </div>
      <div className="spk-portrait-wrap">
        <div className="spk-portrait-rings" aria-hidden="true" />
        <EmmaAvatar size={164} speaking={speaking} decorative={false} />
        <span className="spk-ai-badge">AI</span>
      </div>
      <div className="spk-stage-copy">
        <div>
          <p className="spk-stage-kicker">{speaking ? T.speaking : 'دورك في المحادثة'}</p>
          <p className="spk-en spk-current-prompt" dir="ltr">
            {prompt || (phase === 'starting' ? T.starting : '…')}
          </p>
        </div>
        <button type="button" onClick={onReplay} disabled={!canReplay} className="spk-replay" aria-label={T.replay} title={T.replay}>
          <ReplayIcon />
        </button>
      </div>
      {speaking && (
        <div className="spk-live-wave" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="spk-bar" />
          ))}
        </div>
      )}
    </section>
  )
}

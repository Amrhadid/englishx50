/** The single, original Emma portrait used consistently throughout /speak. */
interface Props {
  size?: number
  speaking?: boolean
  /** Keep repeated transcript/status portraits quiet for screen readers. */
  decorative?: boolean
}

export default function EmmaAvatar({ size = 64, speaking = false, decorative = true }: Props) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`spk-emma-avatar relative inline-flex shrink-0 items-center justify-center rounded-full ${speaking ? 'is-speaking' : ''}`}
    >
      <img
        src="/speak/emma-tutor.svg"
        alt={decorative ? '' : 'Emma، مدرّبتك الرقمية للمحادثة الإنجليزية'}
        width={size}
        height={size}
      />
    </span>
  )
}

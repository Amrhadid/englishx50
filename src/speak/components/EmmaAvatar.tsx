/** Emma — a friendly CSS/SVG avatar (no third-party artwork). */
export default function EmmaAvatar({ size = 64, speaking = false }: { size?: number; speaking?: boolean }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(145deg, #EDEBFF 0%, #D9D4FF 100%)',
        boxShadow: speaking ? '0 0 0 4px rgba(124,111,240,0.25)' : 'none',
        transition: 'box-shadow 200ms ease',
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" width={size} height={size} role="presentation">
        {/* hair */}
        <path d="M14 34c0-13 8-21 18-21s18 8 18 21v6H14z" fill="#534AB7" />
        <path d="M17 40c-2-9 2-18 15-18s17 9 15 18" fill="#7C6FF0" />
        {/* face */}
        <circle cx="32" cy="36" r="13" fill="#FBE4D6" />
        {/* eyes */}
        <g className="spk-eye">
          <circle cx="27" cy="35" r="1.8" fill="#1b1730" />
          <circle cx="37" cy="35" r="1.8" fill="#1b1730" />
        </g>
        {/* cheeks */}
        <circle cx="24.5" cy="39.5" r="2" fill="#F9C4D2" opacity="0.8" />
        <circle cx="39.5" cy="39.5" r="2" fill="#F9C4D2" opacity="0.8" />
        {/* smile */}
        <path
          d={speaking ? 'M27 41.5c2 3 8 3 10 0' : 'M27.5 41c1.8 2 7.2 2 9 0'}
          stroke="#B11D54"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill={speaking ? '#B11D54' : 'none'}
        />
        {/* headset dot */}
        <circle cx="45" cy="38" r="2.4" fill="#23C4A0" />
      </svg>
    </span>
  )
}

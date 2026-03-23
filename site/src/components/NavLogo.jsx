import { useNavigate } from 'react-router-dom'

// 11 dots in two loose clusters with bridge connections
const DOTS = [
  // Cluster 1 (left)
  { cx: 4, cy: 10 },
  { cx: 9, cy: 4 },
  { cx: 10, cy: 14 },
  { cx: 15, cy: 8 },
  { cx: 14, cy: 16 },
  // Bridge
  { cx: 20, cy: 10 },
  // Cluster 2 (right)
  { cx: 26, cy: 5 },
  { cx: 25, cy: 14 },
  { cx: 31, cy: 9 },
  { cx: 30, cy: 16 },
  { cx: 36, cy: 11 },
]

// Connections (index pairs)
const EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 4], [3, 4],
  [3, 5], [4, 5], // bridge
  [5, 6], [5, 7],
  [6, 8], [7, 9], [8, 10], [9, 10], [6, 7],
]

export default function NavLogo({ accentColor = 'var(--accent-current)' }) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/')}
      className="flex items-center gap-2.5 shrink-0 group"
      aria-label="Go to homepage"
    >
      <svg
        viewBox="0 0 40 20"
        width="40"
        height="20"
        className="neural-logo"
        aria-hidden="true"
      >
        {/* Connections */}
        {EDGES.map(([i, j], idx) => (
          <line
            key={`e-${idx}`}
            x1={DOTS[i].cx} y1={DOTS[i].cy}
            x2={DOTS[j].cx} y2={DOTS[j].cy}
            stroke={accentColor}
            strokeWidth="0.3"
            opacity="0.2"
            className="neural-logo-edge"
          />
        ))}
        {/* Dots */}
        {DOTS.map((d, i) => (
          <circle
            key={`d-${i}`}
            cx={d.cx} cy={d.cy}
            r="1.5"
            fill={accentColor}
            opacity="0.8"
            className="neural-logo-dot"
            style={{ transitionDelay: `${i * 20}ms` }}
          />
        ))}
      </svg>

      <span
        className="text-lg font-medium"
        style={{ letterSpacing: '-0.3px' }}
      >
        <span style={{ color: accentColor }}>eleven</span>
        <span>dots</span>
      </span>
    </button>
  )
}

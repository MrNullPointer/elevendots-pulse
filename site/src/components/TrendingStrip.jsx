import { TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function TrendingStrip({ articles, subsectionsMetadata }) {
  const navigate = useNavigate()

  const counts = {}
  for (const a of articles) {
    for (const sub of a.subsections || []) {
      counts[sub] = (counts[sub] || 0) + 1
    }
  }

  const trending = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

  if (trending.length === 0) return null

  return (
    <section className="glass rounded-2xl px-4 py-2.5 mb-6 flex items-center gap-3 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1.5 shrink-0" style={{ color: 'var(--text-tertiary)' }}>
        <TrendingUp size={14} />
        <span className="font-mono uppercase" style={{ fontSize: '9px', letterSpacing: '0.5px' }}>
          Trending
        </span>
      </div>

      <div className="flex gap-1.5">
        {trending.map(([sub, count]) => {
          const meta = subsectionsMetadata[sub]
          const section = meta?.section || 'tech'
          return (
            <button
              key={sub}
              onClick={() => navigate(`/${section}?sub=${sub}`)}
              className="glass-subtle rounded-full px-3 py-1 whitespace-nowrap flex items-center gap-1.5 transition-all hover:scale-105"
              style={{
                fontSize: '11px',
                transitionTimingFunction: 'var(--spring)',
              }}
            >
              <span className="font-medium">{meta?.display_name || sub}</span>
              <span className="font-mono opacity-50" style={{ fontSize: '9px' }}>{count}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

import { useRef, useEffect } from 'react'
import { ExternalLink, Lock } from 'lucide-react'
import { liveAgeHours } from '../hooks/useArticles'

function formatAge(hours) {
  if (hours < 0) return 'just now'
  if (hours < 1) return `${Math.round(hours * 60)}m ago`
  if (hours < 24) return `${Math.round(hours)}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function TierBadge({ tier }) {
  const cls = `badge-${tier}`
  const isShimmer = tier === 'paid'
  return (
    <span
      className={`${cls} ${isShimmer ? 'badge-paid-shimmer' : ''} inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono`}
      style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}
    >
      {tier === 'paid' && <Lock size={8} />}
      {tier}
    </span>
  )
}

function AlsoFrom({ sources }) {
  if (!sources || sources.length === 0) return null
  const label = `+${sources.length} from ${sources.join(', ')}`
  return (
    <span className="tooltip italic" style={{ color: 'var(--text-tertiary)' }}>
      +{sources.length} source{sources.length > 1 ? 's' : ''}
      <span className="tooltip-content">{label}</span>
    </span>
  )
}

export default function ArticleCard({ article, compact = false, onPreview, isFocused = false, id }) {
  const ref = useRef(null)

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [isFocused])

  const handleClick = (e) => {
    if (e.altKey && onPreview) {
      e.preventDefault()
      onPreview(article)
    }
  }

  // 3D tilt on hover (desktop only, very subtle)
  const handleTiltMove = (e) => {
    if (window.innerWidth < 768) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(1000px) rotateY(${x * 2.5}deg) rotateX(${-y * 1.5}deg) translateY(-3px) scale(1.003)`
  }
  const handleTiltLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.transition = 'transform 500ms cubic-bezier(0.22,1,0.36,1)'
    el.style.transform = ''
    setTimeout(() => { if (el) el.style.transition = '' }, 500)
  }

  return (
    <article
      ref={ref}
      id={id}
      className={`card-solid block p-3.5 transition-all group relative ${isFocused ? 'article-focus-ring' : ''}`}
      style={{ transitionTimingFunction: 'var(--spring)' }}
      onMouseMove={handleTiltMove}
      onMouseLeave={handleTiltLeave}
    >
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="block"
        aria-label={`${article.title} — ${article.source} — ${formatAge(liveAgeHours(article))}`}
      >
        <ExternalLink
          size={12}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-40 transition-opacity"
          style={{ transitionDuration: 'var(--duration-fast)' }}
          aria-hidden="true"
        />

        <h3
          className="font-medium leading-snug mb-1 pr-5"
          style={{ fontSize: '14px', lineHeight: 1.4 }}
        >
          {article.title}
        </h3>

        {article.intro && !compact && (
          <p
            className="line-clamp-2 mb-2"
            style={{ fontSize: '12.5px', lineHeight: 1.55, color: 'var(--text-secondary)' }}
          >
            {article.intro}
          </p>
        )}

        <div className="flex items-center flex-wrap gap-x-2 gap-y-1" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{article.source}</span>
          <TierBadge tier={article.tier} />
          <span>{formatAge(liveAgeHours(article))}</span>

          {article.subsections?.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {article.subsections.slice(0, 3).map(s => (
                <span
                  key={s}
                  className="font-mono px-1.5 py-0.5 rounded"
                  style={{
                    fontSize: '9px',
                    background: 'var(--glass-bg-subtle)',
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase',
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          <AlsoFrom sources={article.also_from} />
        </div>
      </a>
    </article>
  )
}

export { TierBadge, formatAge, AlsoFrom }

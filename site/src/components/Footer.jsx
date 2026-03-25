import { useState, useEffect } from 'react'
import { Mail, Eye } from 'lucide-react'
import { ScrollReveal } from '../hooks/useScrollReveal'

function useTrafficStats() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    // Cache-bust every 30 minutes (traffic stats update hourly in CI)
    const v = Math.floor(Date.now() / (30 * 60000))
    fetch(`${import.meta.env.BASE_URL}stats.json?v=${v}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setStats(data))
      .catch(() => {}) // Silent fail — stats are optional
  }, [])

  return stats
}

function formatNumber(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export default function Footer({ generatedAt, sourceCount }) {
  const ageHours = generatedAt
    ? Math.max(0, (Date.now() - new Date(generatedAt).getTime()) / 3600000)
    : null
  const nextRefresh = ageHours !== null ? Math.max(0, 1 - ageHours) : null
  const stats = useTrafficStats()

  return (
    <ScrollReveal>
      <footer
        className="mt-8 mb-10 text-center space-y-4"
        style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}
        role="contentinfo"
      >
        {/* Stats bar */}
        <div className="glass-subtle rounded-xl px-4 py-3">
          <div>
            {ageHours !== null && (
              <span>Updated {ageHours < 1 ? `${Math.round(ageHours * 60)}m` : `${Math.round(ageHours)}h`} ago</span>
            )}
            {sourceCount > 0 && <span> · {sourceCount} sources</span>}
            {nextRefresh !== null && nextRefresh > 0 && (
              <span> · next refresh in ~{Math.round(nextRefresh)}h</span>
            )}
          </div>

          {/* View count — from GitHub Traffic API, no client-side tracking */}
          {stats && stats.total_views > 0 && (
            <div className="mt-1.5 flex items-center justify-center gap-1" style={{ opacity: 0.45 }}>
              <Eye size={10} />
              <span>{formatNumber(stats.total_views)} views</span>
            </div>
          )}

          <div className="mt-1 opacity-60">
            Sources can request removal via the contact below.
          </div>
        </div>

        {/* Contact */}
        <div className="flex items-center justify-center gap-1.5">
          <Mail size={12} style={{ opacity: 0.5 }} />
          <a
            href="mailto:support@elevendots.ai"
            className="transition-colors hover:underline"
            style={{ color: 'var(--accent-current)', fontSize: '12px' }}
          >
            support@elevendots.ai
          </a>
        </div>

        {/* Made with */}
        <div style={{ fontSize: '11px', opacity: 0.4 }}>
          Made with 🤖 in San Diego
        </div>

        {/* Browser recommendation */}
        <div style={{ fontSize: '10px', opacity: 0.3 }}>
          Best experienced on Chromium-based desktop browsers (Chrome, Edge, Arc, Brave)
        </div>
      </footer>
    </ScrollReveal>
  )
}

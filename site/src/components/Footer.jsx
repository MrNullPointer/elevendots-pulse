import { ScrollReveal } from '../hooks/useScrollReveal'

export default function Footer({ generatedAt, sourceCount }) {
  const ageHours = generatedAt
    ? Math.max(0, (Date.now() - new Date(generatedAt).getTime()) / 3600000)
    : null
  const nextRefresh = ageHours !== null ? Math.max(0, 3 - ageHours) : null

  return (
    <ScrollReveal>
      <footer
        className="glass-subtle rounded-xl px-4 py-3 mt-2 mb-8 text-center"
        style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
        role="contentinfo"
      >
        <div>
          {ageHours !== null && (
            <span>Updated {ageHours < 1 ? `${Math.round(ageHours * 60)}m` : `${Math.round(ageHours)}h`} ago</span>
          )}
          {sourceCount > 0 && <span> · {sourceCount} sources</span>}
          {nextRefresh !== null && nextRefresh > 0 && (
            <span> · next refresh in ~{Math.round(nextRefresh)}h</span>
          )}
        </div>
        <div className="mt-1 opacity-60">
          Sources can request removal: contact@elevendots.dev
        </div>
      </footer>
    </ScrollReveal>
  )
}

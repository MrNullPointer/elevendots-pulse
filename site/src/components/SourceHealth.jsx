import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Clock, Zap } from 'lucide-react'
import { ScrollReveal } from '../hooks/useScrollReveal'

const STATUS_CONFIG = {
  healthy:  { color: '#22c55e', label: 'Healthy' },
  slow:     { color: '#eab308', label: 'Slow' },
  empty:    { color: '#6b7280', label: 'Empty' },
  error:    { color: '#ef4444', label: 'Error' },
  timeout:  { color: '#ef4444', label: 'Timeout' },
  disabled: { color: '#4b5563', label: 'Disabled' },
  skipped:  { color: '#4b5563', label: 'Skipped' },
  blocked:  { color: '#eab308', label: 'Blocked' },
  ok:       { color: '#22c55e', label: 'OK' },
}

function StatusDot({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.error
  return (
    <span
      className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
      style={{ background: cfg.color }}
      aria-label={cfg.label}
    />
  )
}

function formatDuration(ms) {
  if (!ms || ms === 0) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatCrawlTime(timestamp) {
  if (!timestamp) return 'never'
  const diff = (Date.now() - new Date(timestamp).getTime()) / 3600000
  if (diff < 0.017) return 'just now'
  if (diff < 1) return `${Math.round(diff * 60)}m ago`
  if (diff < 24) return `${Math.round(diff)}h ago`
  return `${Math.round(diff / 24)}d ago`
}

export default function SourceHealth({ sources }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('articles')

  // Support both old format (from articles.json source_health) and new format
  const healthData = useMemo(() => {
    if (!sources || sources.length === 0) return null

    const items = sources.map(s => ({
      name: s.name || '',
      url: s.url || '',
      status: s.status || 'ok',
      articles: s.articles_found ?? s.articles ?? 0,
      duration_ms: s.duration_ms ?? 0,
      reason: s.reason || '',
      last_crawled: s.last_crawled || '',
    }))

    const healthy = items.filter(s => ['healthy', 'ok', 'slow'].includes(s.status) && s.articles > 0).length
    const slow = items.filter(s => s.status === 'slow').length
    const failed = items.filter(s => ['error', 'timeout', 'blocked'].includes(s.status)).length
    const skipped = items.filter(s => ['disabled', 'skipped'].includes(s.status)).length
    const empty = items.filter(s => s.status === 'empty' || (s.status === 'ok' && s.articles === 0)).length

    return { items, healthy, slow, failed, skipped, empty }
  }, [sources])

  if (!healthData) return null

  // Filter
  const filtered = useMemo(() => {
    let items = healthData.items
    if (filter === 'healthy') items = items.filter(s => ['healthy', 'ok'].includes(s.status) && s.articles > 0)
    else if (filter === 'failed') items = items.filter(s => ['error', 'timeout', 'blocked'].includes(s.status))
    else if (filter === 'slow') items = items.filter(s => s.status === 'slow')
    else if (filter === 'disabled') items = items.filter(s => ['disabled', 'skipped'].includes(s.status))

    // Sort
    if (sort === 'articles') items = [...items].sort((a, b) => b.articles - a.articles)
    else if (sort === 'duration') items = [...items].sort((a, b) => b.duration_ms - a.duration_ms)
    else if (sort === 'name') items = [...items].sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'status') items = [...items].sort((a, b) => a.status.localeCompare(b.status))

    return items
  }, [healthData, filter, sort])

  return (
    <ScrollReveal as="section" className="mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="glass-light rounded-xl px-4 py-2.5 w-full flex items-center justify-between transition-all active:scale-[0.99]"
        style={{ transitionTimingFunction: 'var(--spring)' }}
        aria-expanded={open}
        aria-label="Source health dashboard"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium">Source Health</span>
          <div className="flex items-center gap-2" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
            {healthData.healthy > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
                {healthData.healthy}
              </span>
            )}
            {healthData.slow > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#eab308' }} />
                {healthData.slow}
              </span>
            )}
            {healthData.failed > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ef4444' }} />
                {healthData.failed}
              </span>
            )}
            {healthData.skipped > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#4b5563' }} />
                {healthData.skipped}
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="glass-subtle rounded-xl mt-1.5 p-3 animate-fade-in">
          {/* Filters + Sort */}
          <div className="flex items-center gap-2 mb-3 flex-wrap" style={{ fontSize: '10px' }}>
            {['all', 'healthy', 'failed', 'slow', 'disabled'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`glass-pill rounded-full text-xs ${filter === f ? 'active' : ''}`}
                style={{ padding: '2px 10px', fontSize: '10px' }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <span className="ml-auto" style={{ color: 'var(--text-tertiary)' }}>Sort:</span>
            {['articles', 'duration', 'name', 'status'].map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`glass-pill rounded-full text-xs ${sort === s ? 'active' : ''}`}
                style={{ padding: '2px 10px', fontSize: '10px' }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Source list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
            {filtered.map((src, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5" style={{ fontSize: '11px' }}>
                <StatusDot status={src.status} />
                <span className="font-medium truncate flex-1" style={{ color: 'var(--text-secondary)' }}>
                  {src.name}
                </span>
                <span className="font-mono opacity-50 shrink-0" style={{ fontSize: '9px' }}>
                  {src.articles > 0 ? src.articles : '—'}
                </span>
                {src.duration_ms > 0 && (
                  <span
                    className="flex items-center gap-0.5 shrink-0 font-mono"
                    style={{
                      fontSize: '9px',
                      color: src.duration_ms > 10000 ? '#ef4444' : src.duration_ms > 5000 ? '#eab308' : 'var(--text-tertiary)',
                      opacity: 0.6,
                    }}
                  >
                    <Zap size={7} />
                    {formatDuration(src.duration_ms)}
                  </span>
                )}
                {src.last_crawled && (
                  <span className="flex items-center gap-0.5 opacity-40 shrink-0" style={{ fontSize: '9px' }}>
                    <Clock size={8} />
                    {formatCrawlTime(src.last_crawled)}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-2 pt-2 text-center" style={{ fontSize: '10px', color: 'var(--text-tertiary)', borderTop: '0.5px solid var(--border-subtle)' }}>
            {filtered.length} source{filtered.length !== 1 ? 's' : ''} shown
          </div>
        </div>
      )}
    </ScrollReveal>
  )
}

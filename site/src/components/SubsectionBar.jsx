import { useMemo } from 'react'

export default function SubsectionBar({ articles, sectionId, subsectionsMetadata, active, onSelect }) {
  const { counts, total, subs } = useMemo(() => {
    const counts = {}
    let total = 0
    for (const a of articles) {
      if (a.section !== sectionId) continue
      total++
      for (const sub of a.subsections || []) {
        counts[sub] = (counts[sub] || 0) + 1
      }
    }

    const subs = Object.entries(subsectionsMetadata)
      .filter(([, meta]) => meta.section === sectionId)
      .filter(([id]) => counts[id])
      .sort(([, a], [, b]) => (a.order || 99) - (b.order || 99))

    return { counts, total, subs }
  }, [articles, sectionId, subsectionsMetadata])

  return (
    <div
      className="glass-light rounded-2xl px-3 py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar stagger-children"
      role="tablist"
      aria-label="Subsection filters"
    >
      <button
        onClick={() => onSelect('all')}
        role="tab"
        aria-selected={active === 'all'}
        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
          active === 'all' ? 'glass-pill' : ''
        }`}
        style={{
          transitionTimingFunction: 'var(--spring)',
          opacity: active === 'all' ? 1 : 0.65,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = active === 'all' ? '1' : '0.65' }}
      >
        All <span className="font-mono opacity-50 ml-1" style={{ fontSize: '9px' }}>{total}</span>
      </button>

      {subs.map(([id, meta]) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          role="tab"
          aria-selected={active === id}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap font-medium transition-all ${
            active === id ? 'glass-pill' : ''
          }`}
          style={{
            transitionTimingFunction: 'var(--spring)',
            opacity: active === id ? 1 : 0.65,
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = active === id ? '1' : '0.65' }}
        >
          {meta.display_name}
          <span className="font-mono opacity-50 ml-1" style={{ fontSize: '9px' }}>{counts[id]}</span>
        </button>
      ))}
    </div>
  )
}

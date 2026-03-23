export default function SubsectionBar({ articles, sectionId, subsectionsMetadata, active, onSelect }) {
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

  return (
    <div className="glass-light rounded-xl px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      <button
        onClick={() => onSelect('all')}
        className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
          active === 'all' ? 'glass' : 'hover:bg-white/20'
        }`}
        style={{
          transitionTimingFunction: 'var(--spring)',
          borderWidth: '0.5px',
          borderStyle: 'solid',
          borderColor: active === 'all' ? 'var(--glass-border-highlight)' : 'transparent',
        }}
      >
        All <span className="font-mono opacity-50 ml-1" style={{ fontSize: '9px' }}>{total}</span>
      </button>

      {subs.map(([id, meta]) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`shrink-0 px-3 py-1 rounded-full text-xs whitespace-nowrap font-medium transition-all ${
            active === id ? 'glass' : 'hover:bg-white/20'
          }`}
          style={{
            transitionTimingFunction: 'var(--spring)',
            borderWidth: '0.5px',
            borderStyle: 'solid',
            borderColor: active === id ? (meta.color || 'var(--glass-border-highlight)') : 'transparent',
          }}
        >
          {meta.display_name}
          <span className="font-mono opacity-50 ml-1" style={{ fontSize: '9px' }}>{counts[id]}</span>
        </button>
      ))}
    </div>
  )
}

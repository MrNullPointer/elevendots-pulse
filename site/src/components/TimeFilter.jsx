const OPTIONS = [
  { value: '1', label: '1h' },
  { value: '6', label: '6h' },
  { value: '12', label: '12h' },
  { value: '24', label: '24h' },
  { value: '48', label: '48h' },
  { value: 'all', label: 'All' },
]

export default function TimeFilter({ active, onSelect }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Time filter">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          role="radio"
          aria-checked={active === opt.value}
          className={`glass-pill rounded-lg text-xs font-medium ${active === opt.value ? 'active' : ''}`}
          style={{ fontSize: '11px', padding: '4px 10px' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

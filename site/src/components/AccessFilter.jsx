const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
]

export default function AccessFilter({ active, onSelect }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Access filter">
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

import { useNavigate } from 'react-router-dom'

export default function SectionTabs({ sections, activeSection }) {
  const navigate = useNavigate()

  return (
    <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" aria-label="Section navigation">
      {sections.map(section => {
        const isActive = activeSection === section.id
        return (
          <button
            key={section.id}
            onClick={() => navigate(`/${section.id}`)}
            className={`px-3.5 py-1.5 rounded-[10px] text-xs font-medium whitespace-nowrap transition-all ${
              isActive ? 'glass-pill active' : 'glass-pill'
            }`}
            style={{
              transitionTimingFunction: 'var(--spring)',
              opacity: isActive ? 1 : 0.65,
              ...(isActive && { '--accent-rgb': section.theme_color ? undefined : undefined }),
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.opacity = '1' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.opacity = '0.65' }}
            aria-current={isActive ? 'page' : undefined}
          >
            {section.display_name}
          </button>
        )
      })}
    </nav>
  )
}

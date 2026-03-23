import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import SectionTabs from './SectionTabs'
import ThemeToggle from './ThemeToggle'

export default function GlassNavbar({ sections, activeSection, onSearchOpen }) {
  const navigate = useNavigate()

  return (
    <header className="glass sticky top-0 z-50 px-4 py-2.5 flex items-center justify-between gap-4"
      style={{ borderBottom: '0.5px solid var(--glass-border)' }}
    >
      <button
        onClick={() => navigate('/')}
        className="flex items-center shrink-0"
        style={{ fontSize: '18px', fontWeight: 500, letterSpacing: '-0.3px' }}
      >
        <span style={{ color: 'var(--accent-tech)' }}>eleven</span>
        <span style={{ color: 'var(--accent-tech)' }}>.</span>
        <span>dots</span>
        <span className="text-[var(--text-tertiary)]">.dev</span>
      </button>

      <div className="hidden md:flex flex-1 justify-center">
        <SectionTabs sections={sections} activeSection={activeSection} />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onSearchOpen}
          className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs transition-all hover:scale-105"
          style={{ transitionTimingFunction: 'var(--spring)', color: 'var(--text-tertiary)' }}
        >
          <Search size={14} />
          <span className="hidden sm:inline font-mono text-[10px] opacity-60">⌘K</span>
        </button>
        <ThemeToggle />
      </div>

      <div className="md:hidden overflow-x-auto mt-0">
        <SectionTabs sections={sections} activeSection={activeSection} />
      </div>
    </header>
  )
}

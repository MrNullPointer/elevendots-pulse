import { useMemo } from 'react'

function createFragments(isMobile) {
  const count = isMobile ? 8 : 14

  return Array.from({ length: count }, (_, index) => {
    const column = index % (isMobile ? 4 : 7)
    const row = Math.floor(index / (isMobile ? 4 : 7))

    return {
      id: `fragment-${index}`,
      x: 8 + column * (isMobile ? 22 : 12),
      y: 14 + row * (isMobile ? 18 : 16),
      width: 10 + (index % 4) * 3,
      height: 64 + (index % 5) * 12,
      rotation: -28 + index * 5,
      driftX: -10 + (index % 5) * 5,
      driftY: 18 + (index % 4) * 6,
      delay: (index % 6) * 0.025,
      duration: 0.72 + (index % 5) * 0.06,
      scale: 0.82 + (index % 4) * 0.08,
    }
  })
}

function createFlurries(isMobile) {
  const count = isMobile ? 6 : 12

  return Array.from({ length: count }, (_, index) => ({
    id: `flurry-${index}`,
    x: 6 + (index % (isMobile ? 3 : 6)) * (isMobile ? 30 : 15),
    y: 24 + Math.floor(index / (isMobile ? 3 : 6)) * (isMobile ? 16 : 12),
    size: 3 + (index % 3),
    driftX: -6 + (index % 4) * 4,
    driftY: 16 + (index % 5) * 5,
    delay: 0.08 + (index % 5) * 0.04,
    duration: 0.9 + (index % 4) * 0.08,
  }))
}

export default function StartupReveal({
  phase,
  theme,
  dataReady,
  reduceMotion,
  onRevealComplete,
}) {
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false

  const fragments = useMemo(
    () => (reduceMotion ? [] : createFragments(isMobile)),
    [isMobile, reduceMotion]
  )

  const flurries = useMemo(
    () => (reduceMotion ? [] : createFlurries(isMobile)),
    [isMobile, reduceMotion]
  )

  // Reveal timing is managed by the useStartupReveal hook.
  // The component only renders the visual overlay — no duplicate timers.

  return (
    <div
      className={[
        'startup-reveal',
        `startup-reveal--${phase}`,
        theme === 'light' ? 'startup-reveal--light' : 'startup-reveal--dark',
        dataReady ? 'startup-reveal--primed' : '',
        reduceMotion ? 'startup-reveal--reduced' : '',
      ].filter(Boolean).join(' ')}
      data-testid="startup-reveal"
      data-phase={phase}
      aria-hidden="true"
    >
      <div className="startup-reveal__ambient" />
      <div className="startup-reveal__veil" />
      <div className="startup-reveal__specular" />
      <div className="startup-reveal__noise" />
      <div className="startup-reveal__ghost">
        <div className="startup-ghost startup-ghost--nav" />
        <div className="startup-ghost startup-ghost--hero" />
        <div className="startup-ghost-grid">
          <div className="startup-ghost startup-ghost--card startup-ghost--card-lg" />
          <div className="startup-ghost startup-ghost--card" />
          <div className="startup-ghost startup-ghost--card" />
          <div className="startup-ghost startup-ghost--card" />
          <div className="startup-ghost startup-ghost--footer" />
        </div>
      </div>

      {!reduceMotion && (
        <>
          <div className="startup-reveal__pulse" />
          <div className="startup-reveal__fragments" data-testid="startup-fragments">
            {fragments.map((fragment) => (
              <span
                key={fragment.id}
                className="startup-fragment"
                style={{
                  '--fragment-x': `${fragment.x}%`,
                  '--fragment-y': `${fragment.y}%`,
                  '--fragment-width': `${fragment.width}vmin`,
                  '--fragment-height': `${fragment.height}px`,
                  '--fragment-rotation': `${fragment.rotation}deg`,
                  '--fragment-drift-x': `${fragment.driftX}vw`,
                  '--fragment-drift-y': `${fragment.driftY}vh`,
                  '--fragment-delay': `${fragment.delay}s`,
                  '--fragment-duration': `${fragment.duration}s`,
                  '--fragment-scale': fragment.scale,
                }}
              />
            ))}

            {flurries.map((flurry) => (
              <span
                key={flurry.id}
                className="startup-flurry"
                style={{
                  '--flurry-x': `${flurry.x}%`,
                  '--flurry-y': `${flurry.y}%`,
                  '--flurry-size': `${flurry.size}px`,
                  '--flurry-drift-x': `${flurry.driftX}vw`,
                  '--flurry-drift-y': `${flurry.driftY}vh`,
                  '--flurry-delay': `${flurry.delay}s`,
                  '--flurry-duration': `${flurry.duration}s`,
                }}
              />
            ))}
          </div>
        </>
      )}

      <span className="sr-only">
        {dataReady ? 'Revealing articles' : 'Loading articles'}
      </span>
    </div>
  )
}

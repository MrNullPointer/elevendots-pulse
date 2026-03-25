import { useMemo } from 'react'

/**
 * Generate neuron-drop elements — positioned like neural network nodes
 * that melt into water droplets when the reveal fires.
 * Each drop starts as a glowing circle (neuron) and stretches into
 * a teardrop shape as gravity pulls it downward.
 */
function createNeuronDrops(isMobile) {
  // Mirror the neural background dot positions for visual continuity
  const nodes = isMobile ? [
    // Mobile: 7 nodes in tighter arrangement
    { x: 50, y: 38, r: 3.5, glow: 30, type: 'anchor' },
    { x: 28, y: 25, r: 2.6, glow: 22, type: 'domain' },
    { x: 72, y: 25, r: 2.6, glow: 22, type: 'domain' },
    { x: 28, y: 58, r: 2.6, glow: 22, type: 'domain' },
    { x: 72, y: 58, r: 2.6, glow: 22, type: 'domain' },
    { x: 40, y: 44, r: 2.0, glow: 16, type: 'adaptive' },
    { x: 62, y: 48, r: 2.0, glow: 16, type: 'adaptive' },
  ] : [
    // Desktop: 11 nodes — anchor + 5 domain + 5 adaptive
    { x: 50, y: 38, r: 3.8, glow: 35, type: 'anchor' },
    { x: 25, y: 25, r: 2.8, glow: 25, type: 'domain' },
    { x: 75, y: 25, r: 2.8, glow: 25, type: 'domain' },
    { x: 18, y: 60, r: 2.8, glow: 25, type: 'domain' },
    { x: 50, y: 18, r: 2.8, glow: 25, type: 'domain' },
    { x: 82, y: 60, r: 2.8, glow: 25, type: 'domain' },
    { x: 36, y: 20, r: 2.0, glow: 18, type: 'adaptive' },
    { x: 64, y: 68, r: 2.0, glow: 18, type: 'adaptive' },
    { x: 30, y: 50, r: 2.0, glow: 18, type: 'adaptive' },
    { x: 70, y: 42, r: 2.0, glow: 18, type: 'adaptive' },
    { x: 55, y: 72, r: 2.0, glow: 18, type: 'adaptive' },
  ]

  return nodes.map((node, i) => {
    // Anchor drips last (it's the central node — most "attached")
    // Domain nodes drip from edges inward
    // Adaptive nodes drip first (loosely connected)
    const typeDelay = node.type === 'anchor' ? 0.2
      : node.type === 'domain' ? 0.08 + i * 0.03
      : 0.0 + i * 0.02

    // Higher nodes have more distance to fall
    const fallDistance = 35 + (100 - node.y) * 0.4

    // Larger nodes are "heavier" — fall slightly faster
    const duration = 1.0 + (3.8 - node.r) * 0.15

    // Organic wobble during fall
    const wobbleX = (i % 2 === 0 ? 1 : -1) * (1 + (i % 3) * 0.8)

    return {
      id: `neuron-drop-${i}`,
      x: node.x,
      y: node.y,
      radius: node.r,
      glowRadius: node.glow,
      type: node.type,
      fallDistance,
      wobbleX,
      delay: typeDelay,
      duration,
      // Teardrop stretch: how much it elongates as it falls
      stretch: 2.5 + node.r * 0.4,
      // How much the trailing edge thins
      taper: 0.2 + (3.8 - node.r) * 0.1,
    }
  })
}

/**
 * Generate connection drips — filaments between nodes that stretch
 * and snap during the melt, leaving thin trailing lines.
 */
function createConnectionDrips(isMobile) {
  const pairs = isMobile
    ? [[0,1], [0,2], [0,3], [1,5], [2,6]]
    : [[0,1], [0,2], [0,3], [0,4], [0,5], [1,6], [2,7], [3,8], [4,9], [5,10]]

  return pairs.map(([a, b], i) => ({
    id: `conn-drip-${i}`,
    delay: 0.04 + i * 0.025,
    duration: 0.8 + (i % 3) * 0.1,
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

  const neuronDrops = useMemo(
    () => (reduceMotion ? [] : createNeuronDrops(isMobile)),
    [isMobile, reduceMotion]
  )

  const connectionDrips = useMemo(
    () => (reduceMotion ? [] : createConnectionDrips(isMobile)),
    [isMobile, reduceMotion]
  )

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
          <div className="startup-reveal__melt" data-testid="startup-fragments">
            {/* Neuron drops: nodes that melt into teardrops */}
            {neuronDrops.map((drop) => (
              <span
                key={drop.id}
                className={`startup-neuron-drop startup-neuron-drop--${drop.type}`}
                style={{
                  '--drop-x': `${drop.x}%`,
                  '--drop-y': `${drop.y}%`,
                  '--drop-radius': `${drop.radius * 2.5}px`,
                  '--drop-glow': `${drop.glowRadius}px`,
                  '--drop-fall': `${drop.fallDistance}vh`,
                  '--drop-wobble': `${drop.wobbleX}vw`,
                  '--drop-delay': `${drop.delay}s`,
                  '--drop-duration': `${drop.duration}s`,
                  '--drop-stretch': drop.stretch,
                  '--drop-taper': drop.taper,
                }}
              />
            ))}

            {/* Connection drip trails: thin lines between melting nodes */}
            {connectionDrips.map((conn) => (
              <span
                key={conn.id}
                className="startup-conn-drip"
                style={{
                  '--conn-delay': `${conn.delay}s`,
                  '--conn-duration': `${conn.duration}s`,
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

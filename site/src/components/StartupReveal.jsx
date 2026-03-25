/**
 * StartupReveal — the glass veil overlay.
 *
 * The neural melt animation is handled by NeuralBackground.jsx (Canvas).
 * This component only manages the frosted glass veil, ghost scaffolds,
 * specular highlights, and their dissolve during the reveal phase.
 * No CSS fragment/drop animations — the Canvas does all the organic work.
 */
export default function StartupReveal({
  phase,
  theme,
  dataReady,
  reduceMotion,
  onRevealComplete,
}) {
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

      {!reduceMotion && <div className="startup-reveal__pulse" />}

      <span className="sr-only">
        {dataReady ? 'Revealing articles' : 'Loading articles'}
      </span>
    </div>
  )
}

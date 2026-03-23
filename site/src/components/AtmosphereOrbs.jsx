export default function AtmosphereOrbs() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="atmos-orb orb-1" />
      <div className="atmos-orb orb-2" />
      <div className="atmos-orb orb-3" />
      {/* Vignette for cinematic focus */}
      <div className="fixed inset-0 pointer-events-none atmos-vignette" />
    </div>
  )
}

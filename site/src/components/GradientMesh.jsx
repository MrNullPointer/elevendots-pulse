const MESH_CLASSES = {
  tech: 'mesh-tech',
  science: 'mesh-science',
  philosophy: 'mesh-philosophy',
  misc: 'mesh-misc',
}

export default function GradientMesh({ activeSection }) {
  const meshClass = MESH_CLASSES[activeSection] || 'mesh-tech'

  return (
    <div
      className={`fixed inset-0 -z-10 mesh-transition ${meshClass}`}
      aria-hidden="true"
    />
  )
}

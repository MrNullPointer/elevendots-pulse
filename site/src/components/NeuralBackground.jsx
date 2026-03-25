import { useRef, useEffect, useCallback } from 'react'

const THEMES = {
  home:       { r: 104, g: 104, b: 224 },
  tech:       { r: 64,  g: 128, b: 255 },
  science:    { r: 160, g: 80,  b: 255 },
  philosophy: { r: 224, g: 160, b: 48  },
  world:      { r: 220, g: 40,  b: 40  },
  misc:       { r: 160, g: 160, b: 192 },
}

const DESKTOP_COUNT = 11
const MOBILE_COUNT = 7
const CONNECTION_DIST = 300
const CONNECTION_DIST_MOBILE = 200
const MOUSE_BRIGHT = 200
const MOUSE_ATTRACT = 150
const BACKBONE_PAIRS = [[0,1],[0,2],[0,3],[0,4],[0,5]] // anchor to domain nodes

// Dot roles: 0=anchor, 1-5=domain (tech/science/phil/world/misc), 6-10=adaptive
function createDots(w, h, count) {
  const cx = w * 0.5, cy = h * 0.38
  const dots = []

  // Dot 0: Anchor (near header, centered)
  dots.push({
    role: 'anchor', x: cx, y: cy, tx: cx, ty: cy,
    vx: 0, vy: 0, radius: 3.8, glowRadius: 35, baseOpacity: 0.65,
    phaseX: Math.random() * 10, phaseY: Math.random() * 10,
    opacity: 0.65,
  })

  // Dots 1-5: Domain nodes — loose pentagon around anchor
  const domains = [
    { qx: 0.25, qy: 0.25 }, // tech (upper-left)
    { qx: 0.75, qy: 0.25 }, // science (upper-right)
    { qx: 0.18, qy: 0.60 }, // philosophy (lower-left)
    { qx: 0.50, qy: 0.18 }, // world (top-center)
    { qx: 0.82, qy: 0.60 }, // misc (lower-right)
  ]
  for (const d of domains) {
    dots.push({
      role: 'domain', x: cx, y: cy,
      tx: w * d.qx + (Math.random() - 0.5) * 60,
      ty: h * d.qy + (Math.random() - 0.5) * 60,
      vx: 0, vy: 0, radius: 2.8, glowRadius: 25, baseOpacity: 0.5,
      phaseX: Math.random() * 10, phaseY: Math.random() * 10,
      opacity: 0.5,
    })
  }

  // Dots 6+: Adaptive nodes
  const adaptiveCount = count - 6
  for (let i = 0; i < adaptiveCount; i++) {
    const angle = (i / adaptiveCount) * Math.PI * 2 + Math.random()
    const dist = Math.min(w, h) * (0.15 + Math.random() * 0.3)
    dots.push({
      role: 'adaptive', x: cx, y: cy,
      tx: cx + Math.cos(angle) * dist,
      ty: cy + Math.sin(angle) * dist,
      vx: 0, vy: 0, radius: 2 + Math.random() * 0.5,
      glowRadius: 18, baseOpacity: 0.3 + Math.random() * 0.2,
      phaseX: Math.random() * 10, phaseY: Math.random() * 10,
      opacity: 0.35,
    })
  }
  return dots
}

function lerpColor(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }
}

function col(c, opacity) {
  return `rgba(${c.r|0},${c.g|0},${c.b|0},${opacity})`
}

class EnergyPulse {
  constructor(fromIdx, toIdx, cp) {
    this.fromIdx = fromIdx; this.toIdx = toIdx; this.cp = cp
    this.t = 0; this.speed = 0.012; this.trail = []; this.hops = 0
    this.afterglowEdge = null; this.afterglowTimer = 0
  }
  update() {
    this.t += this.speed
    return this.t >= 1.0
  }
  getPos(dots) {
    const a = dots[this.fromIdx], b = dots[this.toIdx], t = this.t
    const x = (1-t)**2*a.x + 2*(1-t)*t*this.cp.x + t**2*b.x
    const y = (1-t)**2*a.y + 2*(1-t)*t*this.cp.y + t**2*b.y
    this.trail.unshift({ x, y })
    if (this.trail.length > 8) this.trail.pop()
    return { x, y }
  }
  draw(ctx, color) {
    this.trail.forEach((pos, i) => {
      const alpha = (1 - i / 8) * 0.7
      const r = 2.5 * (1 - i / 8)
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
      ctx.fillStyle = col(color, alpha)
      ctx.fill()
    })
  }
}

export default function NeuralBackground({
  activeSection = 'home',
  searchOpen = false,
  mode = 'default',
  intensity = 'normal',
  veilActive = false,
  meltActive = false,
}) {
  const canvasRef = useRef(null)
  const stateRef = useRef({
    dots: [], mouse: { x: -999, y: -999 }, hoveredCard: null,
    currentColor: THEMES.home, targetColor: THEMES.home, colorT: 1,
    startTime: Date.now(), pulses: [], nextPulseAt: 0,
    isMobile: false, reducedMotion: false, searchDim: 1,
    idleTime: 0, lastMouseMove: 0,
    mode: 'default', intensity: 'normal', veilActive: false,
    // Afterglow: edges that recently had pulses [{ fromIdx, toIdx, opacity }]
    afterglows: [],
    // Time of day multiplier
    timeMultiplier: 1,
    // Scroll depth
    scrollDepth: 0,
    // Melt state: 0 = normal, >0 = melting (progress 0→1 over ~1000ms)
    meltActive: false,
    meltStartTime: 0,
    meltProgress: 0,
    // Reassembly: after melt completes, new nodes converge from edges
    reassemblyStartTime: 0,
    reassemblyProgress: 0, // 0→1 over ~1800ms
    reassemblyStarted: false,
  })
  const rafRef = useRef(null)

  const initDots = useCallback((w, h) => {
    const s = stateRef.current
    s.dots = createDots(w, h, s.isMobile ? MOBILE_COUNT : DESKTOP_COUNT)
    // Time of day
    const hr = new Date().getHours()
    s.timeMultiplier = hr >= 6 && hr < 12 ? 1.1 : hr >= 12 && hr < 18 ? 1.0 : hr >= 18 && hr < 22 ? 0.85 : 0.7
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const s = stateRef.current

    s.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    s.isMobile = window.innerWidth < 768

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      s.isMobile = window.innerWidth < 768
      if (!s.dots.length) initDots(window.innerWidth, window.innerHeight)
    }

    let resizeTimer
    const debouncedResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { ctx.setTransform(1,0,0,1,0,0); resize() }, 250) }
    resize()

    const onMouseMove = (e) => {
      if (!s.isMobile) { s.mouse.x = e.clientX; s.mouse.y = e.clientY; s.lastMouseMove = Date.now() }
    }
    const onMouseLeave = () => { s.mouse.x = -999; s.mouse.y = -999 }
    const onScroll = () => {
      s.scrollDepth = window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)
    }

    window.addEventListener('resize', debouncedResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    if (!s.isMobile) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseleave', onMouseLeave)
    }

    // Konami code: dots rush to center and form "11" for 2 seconds
    const onKonami = () => {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2
      // "11" shape: two vertical columns of dots
      const positions = [
        // Left "1"
        { x: cx - 30, y: cy - 30 }, { x: cx - 30, y: cy - 10 },
        { x: cx - 30, y: cy + 10 }, { x: cx - 30, y: cy + 30 },
        { x: cx - 40, y: cy - 20 },
        // Right "1"
        { x: cx + 20, y: cy - 30 }, { x: cx + 20, y: cy - 10 },
        { x: cx + 20, y: cy + 10 }, { x: cx + 20, y: cy + 30 },
        { x: cx + 10, y: cy - 20 },
        // Extra dot as serif
        { x: cx - 5, y: cy + 35 },
      ]
      // Save original targets, override
      const originals = s.dots.map(d => ({ tx: d.tx, ty: d.ty }))
      s.dots.forEach((d, i) => {
        if (positions[i]) { d.tx = positions[i].x; d.ty = positions[i].y }
        d.vx = (d.tx - d.x) * 0.08; d.vy = (d.ty - d.y) * 0.08
      })
      // Restore after 2.5 seconds
      setTimeout(() => {
        s.dots.forEach((d, i) => {
          if (originals[i]) { d.tx = originals[i].tx; d.ty = originals[i].ty }
        })
      }, 2500)
    }
    window.addEventListener('konami', onKonami)

    // Content-aware: card hover binding
    const onCardHover = (e) => {
      const r = e.currentTarget.getBoundingClientRect()
      s.hoveredCard = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    const onCardLeave = () => { s.hoveredCard = null }
    const observer = new MutationObserver(() => {
      document.querySelectorAll('.card-solid, article').forEach(el => {
        if (!el._nb) { el.addEventListener('mouseenter', onCardHover); el.addEventListener('mouseleave', onCardLeave); el._nb = true }
      })
    })
    observer.observe(document.body, { childList: true, subtree: true })
    document.querySelectorAll('.card-solid, article').forEach(el => {
      el.addEventListener('mouseenter', onCardHover); el.addEventListener('mouseleave', onCardLeave); el._nb = true
    })

    // Schedule first pulse
    s.nextPulseAt = Date.now() + 900 + Math.random() * 900

    const draw = () => {
      const w = window.innerWidth, h = window.innerHeight
      const now = Date.now()
      const elapsed = now - s.startTime
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light'

      // Color lerp
      if (s.colorT < 1) s.colorT = Math.min(1, s.colorT + 1.25 / 60) // ~800ms
      const color = s.colorT >= 1 ? s.targetColor : lerpColor(s.currentColor, s.targetColor, s.colorT)

      // Search dim lerp
      const dimTarget = s.searchDimTarget ? 0.3 : 1
      s.searchDim += (dimTarget - s.searchDim) * 0.06

      // Idle detection
      const isIdle = now - s.lastMouseMove > 5000

      // ---- Melt physics ----
      if (s.meltActive && s.meltStartTime === 0) {
        s.meltStartTime = now
      }
      if (s.meltActive && s.meltStartTime > 0) {
        s.meltProgress = Math.min(1, (now - s.meltStartTime) / 1000)
      } else if (!s.meltActive && s.meltProgress >= 1 && !s.reassemblyStarted) {
        // Melt just ended — begin reassembly
        s.reassemblyStarted = true
        s.reassemblyStartTime = now
        // Scatter dots to edge positions for convergence
        for (let di = 0; di < s.dots.length; di++) {
          const dot = s.dots[di]
          // Pick a random edge: 0=top, 1=right, 2=bottom, 3=left
          const edge = (di * 3 + di * di) % 4
          const spread = 0.3 + ((di * 7) % 10) / 10 * 0.4 // 0.3-0.7 along edge
          if (edge === 0) { dot.x = w * spread; dot.y = -40 - di * 15 }
          else if (edge === 1) { dot.x = w + 40 + di * 15; dot.y = h * spread }
          else if (edge === 2) { dot.x = w * (1 - spread); dot.y = h + 40 + di * 15 }
          else { dot.x = -40 - di * 15; dot.y = h * (1 - spread) }
          dot.vx = 0; dot.vy = 0
          dot.opacity = 0
          // Clear melt state
          dot._meltOriginY = 0; dot._meltWobble = 0
        }
      }
      if (!s.meltActive) { s.meltProgress = Math.min(s.meltProgress, 1) }
      const mp = s.meltProgress
      const melting = s.meltActive && mp > 0 && mp < 1

      // ---- Reassembly physics: dots converge from edges ----
      let reassemblyT = 0
      if (s.reassemblyStarted && s.reassemblyStartTime > 0) {
        reassemblyT = Math.min(1, (now - s.reassemblyStartTime) / 1800)
      }
      const reassembling = reassemblyT > 0 && reassemblyT < 1

      // Trail effect
      const introActive = s.mode === 'intro'
      const introBoost = introActive ? 1.2 : 1
      const intensityBoost = s.intensity === 'high' ? 1.15 : 1
      ctx.fillStyle = isDark
        ? `rgba(8,8,15,${introActive ? 0.045 : 0.07})`
        : `rgba(240,240,234,${introActive ? 0.08 : 0.12})`
      ctx.fillRect(0, 0, w, h)

      const maxDist = s.isMobile ? CONNECTION_DIST_MOBILE : CONNECTION_DIST
      const glowMult = s.isMobile ? 0.5 : 1
      const assemblyDuration = introActive ? 1050 : 1500
      const assemblyT = Math.min(1, elapsed / assemblyDuration)
      const assemblyEase = 1 - Math.pow(1 - assemblyT, 3) // cubic ease out
      const timeMult = s.timeMultiplier
      const scrollMult = 1 + s.scrollDepth * 0.25 // connections denser at bottom

      // Update dots
      for (let i = 0; i < s.dots.length; i++) {
        const dot = s.dots[i]
        if (!s.reducedMotion) {

          // ---- REASSEMBLY: dots converge from edges to home positions ----
          if (reassembling) {
            // Per-dot stagger: anchor arrives first (dramatic), adaptive last
            const arrivalDelay = dot.role === 'anchor' ? 0.0
              : dot.role === 'domain' ? 0.05 + i * 0.02
              : 0.12 + i * 0.015
            const localT = Math.max(0, Math.min(1, (reassemblyT - arrivalDelay) / (0.7 - arrivalDelay * 0.5)))

            if (localT > 0) {
              // Ease: cubic ease-out (fast start, gentle arrival)
              const ease = 1 - Math.pow(1 - localT, 3)

              // Spring toward target with organic overshoot
              const springStrength = 0.06 * ease
              dot.vx += (dot.tx - dot.x) * springStrength
              dot.vy += (dot.ty - dot.y) * springStrength

              // Light damping — allows slight overshoot for organic feel
              dot.vx *= 0.92
              dot.vy *= 0.92

              dot.x += dot.vx
              dot.y += dot.vy

              // Fade in: opacity rises with convergence
              dot.opacity = dot.baseOpacity * Math.min(1, localT * 1.5)
            }
            // Skip normal physics during reassembly
            continue
          }

          // After reassembly completes, normal physics resume
          // Assembly (initial page load — skip if we came from reassembly)
          if (assemblyT < 1 && !s.reassemblyStarted) {
            dot.x += (dot.tx - dot.x) * assemblyEase * 0.03
            dot.y += (dot.ty - dot.y) * assemblyEase * 0.03
          }

          // Drift (layered sine)
          const t = now * 0.001
          const driftSpeed = timeMult * 0.8
          dot.x += dot.vx + (Math.sin(t * 0.0008 * driftSpeed + dot.phaseX) * 0.2 + Math.sin(t * 0.0003 * driftSpeed + dot.phaseX * 2.7) * 0.15)
          dot.y += dot.vy + (Math.cos(t * 0.0006 * driftSpeed + dot.phaseY) * 0.2 + Math.cos(t * 0.0004 * driftSpeed + dot.phaseY * 1.3) * 0.15)

          // Idle formation: weak spring toward home position
          if (isIdle && (assemblyT >= 1 || s.reassemblyStarted)) {
            const spring = introActive ? 0.0022 : 0.0015
            dot.vx += (dot.tx - dot.x) * spring
            dot.vy += (dot.ty - dot.y) * spring
          }

          // Edge avoidance
          const margin = 80
          if (dot.x < margin) dot.vx += (margin - dot.x) * 0.001
          if (dot.x > w - margin) dot.vx -= (dot.x - w + margin) * 0.001
          if (dot.y < margin) dot.vy += (margin - dot.y) * 0.001
          if (dot.y > h - margin) dot.vy -= (dot.y - h + margin) * 0.001

          // Damping
          dot.vx *= 0.997; dot.vy *= 0.997

          // Melt gravity: each dot falls with acceleration
          if (melting) {
            // Per-dot delay: anchor melts last, adaptive first
            const meltDelay = dot.role === 'anchor' ? 0.15
              : dot.role === 'domain' ? 0.05 + i * 0.02
              : 0.0 + i * 0.01
            const localT = Math.max(0, Math.min(1, (mp - meltDelay) / (1 - meltDelay)))

            if (localT > 0) {
              // Store original position on first melt frame
              if (!dot._meltOriginY) dot._meltOriginY = dot.y
              if (!dot._meltWobble) dot._meltWobble = (i % 2 === 0 ? 1 : -1) * (0.3 + (i % 3) * 0.2)

              // Gravity: accelerating fall (ease-in quadratic)
              const fallEase = localT * localT // quadratic ease-in = accelerating
              const fallDist = h * 0.5 * fallEase
              dot.y = dot._meltOriginY + fallDist

              // Subtle horizontal wobble (organic sway)
              dot.x += Math.sin(localT * Math.PI * 2.5 + i) * dot._meltWobble

              // Disable normal drift during melt
              dot.vx = 0
              dot.vy = 0
            }
          } else if (!melting && mp >= 1) {
            // Melt complete — dots are off-screen, let them stay
          }

          // Mouse attraction
          if (!s.isMobile && !s.veilActive) {
            const dx = s.mouse.x - dot.x, dy = s.mouse.y - dot.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < MOUSE_ATTRACT && dist > 1) {
              dot.vx += (dx / dist) * 0.004; dot.vy += (dy / dist) * 0.004
            }
          }
        } else if (assemblyT < 1) {
          dot.x = dot.tx; dot.y = dot.ty
        }

        // Pulse + proximity brightness (skip during reassembly — opacity set by convergence)
        if (!reassembling) {
          dot.opacity = (dot.baseOpacity + 0.12 * Math.sin(now * 0.002 + dot.phaseX * 3)) * timeMult * introBoost
        }

        let boost = 0
        if (!s.isMobile && !s.veilActive) {
          const mdx = s.mouse.x - dot.x, mdy = s.mouse.y - dot.y
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
          if (mDist < MOUSE_BRIGHT) boost = (1 - mDist / MOUSE_BRIGHT) * 0.35
          if (s.hoveredCard) {
            const cdx = s.hoveredCard.x - dot.x, cdy = s.hoveredCard.y - dot.y
            const cDist = Math.sqrt(cdx * cdx + cdy * cdy)
            if (cDist < MOUSE_BRIGHT * 1.5) boost = Math.max(boost, (1 - cDist / (MOUSE_BRIGHT * 1.5)) * 0.18)
          }
        }

        const finalOp = Math.min(0.95, (dot.opacity + boost) * intensityBoost) * s.searchDim

        // Compute melt deformation for this dot
        const meltDelay = dot.role === 'anchor' ? 0.15
          : dot.role === 'domain' ? 0.05 + i * 0.02 : 0.0 + i * 0.01
        const dotMeltT = melting ? Math.max(0, Math.min(1, (mp - meltDelay) / (1 - meltDelay))) : 0

        // During melt: initial flash, then fade
        let meltOpMult = 1
        let meltStretchY = 1
        let meltSqueezeX = 1
        let meltGlowBoost = 1

        if (dotMeltT > 0) {
          // Phase 1 (0-0.08): bright flash
          if (dotMeltT < 0.08) {
            meltGlowBoost = 1 + dotMeltT / 0.08 * 1.5
            meltOpMult = 1 + dotMeltT / 0.08 * 0.5
          }
          // Phase 2 (0.08-1): teardrop stretch + fade
          else {
            const stretchT = (dotMeltT - 0.08) / 0.92
            meltStretchY = 1 + stretchT * 3.5 // elongate to 4.5x height
            meltSqueezeX = 1 - stretchT * 0.7 // squeeze to 0.3x width
            meltOpMult = 1 - stretchT * stretchT // quadratic fade
            meltGlowBoost = Math.max(0, 1 - stretchT * 1.5)
          }
        }

        const drawOp = finalOp * meltOpMult

        // Draw glow (stretched during melt)
        const gr = dot.glowRadius * glowMult * (introActive ? 1.08 : 1) * meltGlowBoost
        const glow = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, gr)
        glow.addColorStop(0, col(color, drawOp * 0.4))
        glow.addColorStop(0.4, col(color, drawOp * 0.1))
        glow.addColorStop(1, col(color, 0))
        ctx.fillStyle = glow
        ctx.fillRect(dot.x - gr, dot.y - gr, gr * 2, gr * 2)

        // Core — during melt, draw as elongated teardrop instead of circle
        if (dotMeltT > 0.08 && dotMeltT < 1) {
          // Teardrop: ellipse (wide at top, narrow at bottom)
          ctx.save()
          ctx.translate(dot.x, dot.y)
          ctx.scale(meltSqueezeX, meltStretchY)

          const r = dot.radius * (1 + dotMeltT * 0.5)
          const tearGrad = ctx.createRadialGradient(0, -r * 0.3, 0, 0, 0, r * 1.2)
          tearGrad.addColorStop(0, `rgba(255,255,255,${drawOp * 0.85})`)
          tearGrad.addColorStop(0.25, col(color, drawOp * 0.7))
          tearGrad.addColorStop(0.6, col(color, drawOp * 0.3))
          tearGrad.addColorStop(1, col(color, 0))

          // Draw teardrop shape: circle top + pointed bottom
          ctx.beginPath()
          ctx.arc(0, 0, r, Math.PI, 0) // top half circle
          ctx.quadraticCurveTo(r * 0.6, r * 1.2, 0, r * 2.5) // right curve to point
          ctx.quadraticCurveTo(-r * 0.6, r * 1.2, -r, 0) // left curve back
          ctx.fillStyle = tearGrad
          ctx.fill()

          // Trailing drip line below the teardrop
          if (dotMeltT > 0.2) {
            const trailLen = (dotMeltT - 0.2) / 0.8 * r * 6
            const trailOp = drawOp * 0.3 * (1 - dotMeltT)
            ctx.beginPath()
            ctx.moveTo(0, r * 2.5)
            ctx.lineTo(0, r * 2.5 + trailLen)
            ctx.strokeStyle = col(color, trailOp)
            ctx.lineWidth = r * 0.3 * (1 - dotMeltT * 0.7)
            ctx.lineCap = 'round'
            ctx.stroke()
          }

          ctx.restore()
        } else {
          // Normal circle rendering (pre-melt or post-melt)
          const core = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, dot.radius)
          core.addColorStop(0, `rgba(255,255,255,${drawOp * 0.9})`)
          core.addColorStop(0.3, col(color, drawOp * 0.8))
          core.addColorStop(1, col(color, drawOp * 0.2))
          ctx.beginPath()
          ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2)
          ctx.fillStyle = core
          ctx.fill()
        }

        // Specular highlight (suppressed during melt)
        if (dotMeltT < 0.3) {
          const specOp = drawOp * 0.5 * (1 - dotMeltT / 0.3)
          ctx.beginPath()
          ctx.arc(dot.x - dot.radius * 0.3, dot.y - dot.radius * 0.3, dot.radius * 0.25, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${specOp})`
          ctx.fill()
        }
      }

      // Connections
      for (let i = 0; i < s.dots.length; i++) {
        for (let j = i + 1; j < s.dots.length; j++) {
          const a = s.dots[i], b = s.dots[j]
          const dx = b.x - a.x, dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          const isBackbone = BACKBONE_PAIRS.some(([bi, bj]) => (i === bi && j === bj) || (i === bj && j === bi))
          const inRange = dist < maxDist || isBackbone

          if (inRange) {
            let lineOp = isBackbone
              ? Math.max(0.08, (1 - dist / (maxDist * 1.5)) * 0.2)
              : (1 - dist / maxDist) * 0.2

            // Mouse proximity boost
            if (!s.isMobile && !s.veilActive) {
              const ad = Math.sqrt((s.mouse.x - a.x) ** 2 + (s.mouse.y - a.y) ** 2)
              const bd = Math.sqrt((s.mouse.x - b.x) ** 2 + (s.mouse.y - b.y) ** 2)
              if (ad < MOUSE_BRIGHT || bd < MOUSE_BRIGHT) lineOp *= 2
            }

            // Afterglow boost
            for (const ag of s.afterglows) {
              if ((ag.from === i && ag.to === j) || (ag.from === j && ag.to === i)) {
                lineOp += ag.opacity * 0.3
              }
            }

            if (introActive && isBackbone) lineOp *= 1.35
            lineOp *= s.searchDim * scrollMult * intensityBoost

            // During melt: connections thin, stretch, then snap
            if (melting) {
              const connMeltT = Math.max(0, (mp - 0.05) / 0.6) // connections fade fast
              lineOp *= Math.max(0, 1 - connMeltT * connMeltT)
            }

            const mx = (a.x + b.x) / 2 + Math.sin(now * 0.0005 + i * 0.5) * 15
            const my = (a.y + b.y) / 2 - Math.cos(now * 0.0004 + j * 0.5) * 15 * 0.7

            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.quadraticCurveTo(mx, my, b.x, b.y)
            ctx.strokeStyle = col(color, lineOp)
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      // Energy pulses
      if (!s.reducedMotion && s.dots.length > 1) {
        // Spawn new pulse
        if (now > s.nextPulseAt) {
          const fromIdx = Math.floor(Math.random() * s.dots.length)
          let toIdx = Math.floor(Math.random() * s.dots.length)
          while (toIdx === fromIdx) toIdx = Math.floor(Math.random() * s.dots.length)
          const a = s.dots[fromIdx], b = s.dots[toIdx]
          const cp = { x: (a.x + b.x) / 2 + (Math.random() - 0.5) * 30, y: (a.y + b.y) / 2 + (Math.random() - 0.5) * 30 }
          s.pulses.push(new EnergyPulse(fromIdx, toIdx, cp))
          const base = introActive ? 1800 : s.intensity === 'high' ? 2600 : 6000
          const variance = introActive ? 1200 : s.intensity === 'high' ? 1600 : 4000
          s.nextPulseAt = now + base + Math.random() * variance
        }

        // Update + draw pulses
        s.pulses = s.pulses.filter(p => {
          p.getPos(s.dots)
          const done = p.update()
          p.draw(ctx, color)

          if (done) {
            // Afterglow
            s.afterglows.push({ from: p.fromIdx, to: p.toIdx, opacity: 1, start: now })

            // Multi-hop chain (40% chance, max 3 hops)
            if (p.hops < 3 && Math.random() < 0.4) {
              const neighbors = []
              for (let k = 0; k < s.dots.length; k++) {
                if (k === p.fromIdx || k === p.toIdx) continue
                const dx = s.dots[k].x - s.dots[p.toIdx].x
                const dy = s.dots[k].y - s.dots[p.toIdx].y
                if (Math.sqrt(dx * dx + dy * dy) < maxDist) neighbors.push(k)
              }
              if (neighbors.length > 0) {
                const nextIdx = neighbors[Math.floor(Math.random() * neighbors.length)]
                const a2 = s.dots[p.toIdx], b2 = s.dots[nextIdx]
                const cp2 = { x: (a2.x + b2.x) / 2 + (Math.random() - 0.5) * 20, y: (a2.y + b2.y) / 2 + (Math.random() - 0.5) * 20 }
                const chain = new EnergyPulse(p.toIdx, nextIdx, cp2)
                chain.hops = p.hops + 1
                s.pulses.push(chain)
              }
            }
            return false
          }
          return true
        })

        // Fade afterglows
        s.afterglows = s.afterglows.filter(ag => {
          const age = now - ag.start
          ag.opacity = age < 1000 ? 1 : Math.max(0, 1 - (age - 1000) / 800)
          return ag.opacity > 0
        })
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    if (!s.reducedMotion) {
      rafRef.current = requestAnimationFrame(draw)
    } else {
      // Static render
      const drawStatic = () => {
        const w = window.innerWidth
        const h = window.innerHeight
        ctx.fillStyle = document.documentElement.getAttribute('data-theme') !== 'light' ? '#08080f' : '#f0f0ea'
        ctx.fillRect(0, 0, w, h)
        for (const dot of s.dots) {
          dot.x = dot.tx; dot.y = dot.ty
          const gr = dot.glowRadius * (s.isMobile ? 0.5 : 1)
          const glow = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, gr)
          glow.addColorStop(0, col(s.targetColor, dot.baseOpacity * 0.4))
          glow.addColorStop(1, col(s.targetColor, 0))
          ctx.fillStyle = glow
          ctx.fillRect(dot.x - gr, dot.y - gr, gr * 2, gr * 2)
        }
      }
      drawStatic()
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', debouncedResize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('konami', onKonami)
      observer.disconnect()
      clearTimeout(resizeTimer)
    }
  }, [initDots])

  // Section color transitions
  useEffect(() => {
    const s = stateRef.current
    const target = THEMES[activeSection] || THEMES.home
    if (target !== s.targetColor) {
      s.currentColor = s.colorT >= 1 ? s.targetColor : lerpColor(s.currentColor, s.targetColor, s.colorT)
      s.targetColor = target
      s.colorT = 0
    }
  }, [activeSection])

  // Search dimming
  useEffect(() => { stateRef.current.searchDimTarget = searchOpen }, [searchOpen])
  useEffect(() => { stateRef.current.mode = mode }, [mode])
  useEffect(() => { stateRef.current.intensity = intensity }, [intensity])
  useEffect(() => { stateRef.current.veilActive = veilActive }, [veilActive])
  useEffect(() => {
    const s = stateRef.current
    if (meltActive && !s.meltActive) {
      s.meltActive = true
      s.meltStartTime = 0 // will be set on next draw frame
      s.meltProgress = 0
      // Clear stored melt origins so they get re-captured
      for (const dot of s.dots) {
        dot._meltOriginY = 0
        dot._meltWobble = 0
      }
    } else if (!meltActive && s.meltActive) {
      // Melt prop turned off — let the draw loop detect completion
      // and trigger reassembly. Don't reset meltProgress here.
      s.meltActive = false
    }
  }, [meltActive])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[2] pointer-events-none"
      style={{ transition: 'opacity 600ms ease' }}
      aria-hidden="true"
    />
  )
}

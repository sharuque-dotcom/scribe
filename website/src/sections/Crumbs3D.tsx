// The Crumbs in 3D: soft clay-like bodies drawn with Three.js on a transparent
// layer over a scene. Each 3D Crumb follows its flat twin (svg.crumb) every frame,
// its position, size, squash and visibility, so the scenes' GSAP animation drives
// them unchanged. On top: breathing, heads that turn to the pointer, blinks, and
// a spin when poked. Loaded lazily, only where 3D runs well (see can3D in Scenes).
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { CrumbKind } from './Cast'

const INK = '#151412'

// Soft clay with a faint fuzz at the edges (sheen) and a little gloss.
function Clay({ color, rough = 0.55 }: { color: string; rough?: number }) {
  return <meshPhysicalMaterial color={color} roughness={rough} sheen={1} sheenRoughness={0.55} sheenColor="#ffffff" clearcoat={0.12} clearcoatRoughness={0.6} />
}
const Gloss = ({ color }: { color: string }) => <meshPhysicalMaterial color={color} roughness={0.25} clearcoat={0.6} />

const capsule = new THREE.CapsuleGeometry(3.6, 7, 6, 16)
const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' })
const inkEyeMat = new THREE.MeshBasicMaterial({ color: INK })

// Two pill eyes on the front of the body; `z` is the surface depth there.
function Eyes({ y = 5, gap = 13, z = 37, ink = false, blink }: { y?: number; gap?: number; z?: number; ink?: boolean; blink: RefObject<THREE.Group> }) {
  return (
    <group ref={blink} position={[0, y, z]}>
      <mesh geometry={capsule} material={ink ? inkEyeMat : eyeMat} position={[-gap, 0, 0]} />
      <mesh geometry={capsule} material={ink ? inkEyeMat : eyeMat} position={[gap, 0, 0]} />
    </group>
  )
}
function Smile({ y = -11, z = 37, color = '#ffffff', r = 6 }: { y?: number; z?: number; color?: string; r?: number }) {
  return (
    <mesh position={[0, y, z]} rotation={[0, 0, Math.PI]}>
      <torusGeometry args={[r, 1.5, 8, 24, Math.PI]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

const rounded = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 5, r)

// One Crumb's 3D body, in the same 100-unit space as the flat drawing.
function Body({ kind, blink }: { kind: CrumbKind; blink: RefObject<THREE.Group> }) {
  const geo = useMemo(
    () => ({
      snap: rounded(76, 70, 52, 22),
      lens: rounded(22, 12, 20, 5),
      shades: rounded(20, 12, 5, 4),
      doc: rounded(68, 78, 12, 7),
    }),
    [],
  )
  switch (kind) {
    case 'click':
      return (
        <>
          <mesh>
            <sphereGeometry args={[40, 48, 32]} />
            <Clay color="#F97316" />
          </mesh>
          <Eyes blink={blink} y={4} z={37} />
          <Smile y={-10} z={38} />
        </>
      )
    case 'snap':
      return (
        <>
          <mesh geometry={geo.snap}>
            <Clay color="#6366F1" />
          </mesh>
          <mesh geometry={geo.lens} position={[-6, 39, 0]}>
            <Clay color="#4F46E5" />
          </mesh>
          <mesh position={[24, 22, 26]}>
            <sphereGeometry args={[5, 16, 12]} />
            <Gloss color="#C7D2FE" />
          </mesh>
          <Eyes blink={blink} y={2} z={27} />
          <Smile y={-13} z={27} />
        </>
      )
    case 'shh':
      return (
        <>
          <mesh scale={[1, 0.97, 0.9]}>
            <sphereGeometry args={[38, 48, 32]} />
            <Clay color="#64748B" />
          </mesh>
          <group ref={blink} position={[0, 6, 33]}>
            <mesh geometry={geo.shades} position={[-15, 0, 0]}>
              <Gloss color={INK} />
            </mesh>
            <mesh geometry={geo.shades} position={[15, 0, 0]}>
              <Gloss color={INK} />
            </mesh>
            <mesh position={[0, 2, 0]}>
              <boxGeometry args={[12, 2.6, 3]} />
              <Gloss color={INK} />
            </mesh>
          </group>
          <mesh position={[0, -14, 34]}>
            <boxGeometry args={[12, 3, 2]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </>
      )
    case 'echo':
      return (
        <>
          <mesh scale={[1, 0.9, 0.85]}>
            <sphereGeometry args={[37, 48, 32]} />
            <Clay color="#A855F7" />
          </mesh>
          <mesh position={[0, 4, 0]}>
            <torusGeometry args={[36, 3.4, 12, 48, Math.PI]} />
            <Gloss color={INK} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 36, 2, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[11, 11, 10, 24]} />
              <Gloss color={INK} />
            </mesh>
          ))}
          <Eyes blink={blink} y={2} gap={12} z={30} />
          <mesh position={[0, -14, 31]}>
            <sphereGeometry args={[4.5, 16, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </>
      )
    case 'zoom':
      return (
        <>
          <mesh position={[-4, 8, 0]}>
            <torusGeometry args={[28, 9, 20, 48]} />
            <Clay color="#0EA5E9" rough={0.4} />
          </mesh>
          <mesh position={[-4, 8, -2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[21, 21, 6, 40]} />
            <meshPhysicalMaterial color="#E0F2FE" roughness={0.1} transmission={0.2} clearcoat={1} />
          </mesh>
          <group ref={blink} position={[-4, 8, 6]}>
            <mesh>
              <sphereGeometry args={[9, 24, 16]} />
              <Gloss color={INK} />
            </mesh>
            <mesh position={[3, 3, 8]}>
              <sphereGeometry args={[2.6, 12, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
          <mesh position={[24, -26, 0]} rotation={[0, 0, Math.PI / 4]}>
            <cylinderGeometry args={[5.5, 5.5, 30, 20]} />
            <Gloss color={INK} />
          </mesh>
        </>
      )
    case 'doc':
      return (
        <>
          <mesh geometry={geo.doc}>
            <Clay color="#FFF4DD" rough={0.75} />
          </mesh>
          <mesh position={[24, 29, 4]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[20, 20, 8]} />
            <Clay color="#F2DDB4" rough={0.75} />
          </mesh>
          <Eyes blink={blink} y={8} z={7} ink />
          <Smile y={-5} z={7} color={INK} r={5} />
          {[-20, -28].map((y, i) => (
            <mesh key={y} position={[-6 + i * -4, y, 7]}>
              <boxGeometry args={[i ? 28 : 40, 3, 1]} />
              <meshBasicMaterial color="#E7D7B8" />
            </mesh>
          ))}
        </>
      )
    case 'guide':
      return (
        <>
          <mesh position={[0, 2, 0]}>
            <coneGeometry args={[42, 82, 48, 1]} />
            <Clay color="#EC4899" />
          </mesh>
          <Eyes blink={blink} y={-8} gap={10} z={24} />
          <Smile y={-22} z={29} r={5} />
        </>
      )
  }
}

// A soft round shadow under each Crumb.
const shadowTex = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32)
  grd.addColorStop(0, 'rgba(21,20,18,0.28)')
  grd.addColorStop(1, 'rgba(21,20,18,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
})()

// Shared pointer target: the mouse, or a call to action being hovered.
const target = { x: innerWidth / 2, y: innerHeight / 3 }
let lookOverride: { x: number; y: number } | null = null
addEventListener('pointermove', (e) => {
  target.x = e.clientX
  target.y = e.clientY
}, { passive: true })
addEventListener('pointerover', (e) => {
  const el = (e.target as Element | null)?.closest?.('[data-crumb-look]')
  if (!el) return void (lookOverride = null)
  const r = el.getBoundingClientRect()
  lookOverride = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}, { passive: true })

// Whether the flat twin is showing: not hidden or faded out by a scroll reveal
// or the scene's own animation (checked up a few levels).
function shown(el: Element) {
  let e: Element | null = el.parentElement
  for (let i = 0; e && i < 5; i++, e = e.parentElement) {
    const cs = getComputedStyle(e)
    if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false
  }
  return true
}

// One 3D Crumb, glued to its flat twin.
function Follower({ anchor, wrap, index }: { anchor: SVGSVGElement; wrap: RefObject<HTMLDivElement>; index: number }) {
  const kind = anchor.dataset.crumb as CrumbKind
  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const blink = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const spin = useRef({ v: 0 })
  const body = anchor.querySelector('.crumb-body')
  const nextBlink = useRef(1 + Math.random() * 4)
  const phase = index * 1.3

  // Poke: a spin and a wobble (the flat twin also hops; see Cast.tsx).
  useEffect(() => {
    const on = () => gsap.fromTo(spin.current, { v: 0 }, { v: Math.PI * 2, duration: 0.9, ease: 'power3.out' })
    anchor.addEventListener('crumb-poke', on)
    return () => anchor.removeEventListener('crumb-poke', on)
  }, [anchor])

  useFrame((state) => {
    const g = root.current
    if (!g || !head.current || !wrap.current) return
    const cr = wrap.current.getBoundingClientRect()
    const r = anchor.getBoundingClientRect()
    const visible = r.width > 0 && shown(anchor)
    g.visible = visible
    if (shadow.current) shadow.current.visible = visible
    if (!visible) return
    const size = r.width
    const cx = r.left + r.width / 2
    const cy = r.top + r.height * 0.56
    g.position.set(cx - cr.left - cr.width / 2, -(cy - cr.top - cr.height / 2), 0)
    const t = state.clock.elapsedTime
    const sx = Number(gsap.getProperty(body, 'scaleX')) || 1
    const sy = Number(gsap.getProperty(body, 'scaleY')) || 1
    const breathe = 1 + Math.sin(t * 2.1 + phase) * 0.018
    const k = size / 100
    g.scale.set(k * sx * (2 - breathe), k * sy * breathe, k)
    // Look at the pointer (or the hovered call to action).
    const tx = lookOverride?.x ?? target.x
    const ty = lookOverride?.y ?? target.y
    const dx = THREE.MathUtils.clamp((tx - cx) / 500, -1, 1)
    const dy = THREE.MathUtils.clamp((ty - cy) / 500, -1, 1)
    head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, dx * 0.55 + spin.current.v, 0.12)
    head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, dy * 0.35, 0.12)
    // Blink now and then.
    if (blink.current) {
      if (t > nextBlink.current) nextBlink.current = t + 2 + Math.random() * 4
      const d = nextBlink.current - t
      blink.current.scale.y = d < 0.12 ? Math.max(0.12, Math.abs(d - 0.06) / 0.06) : 1
    }
    if (shadow.current) {
      // The ground stays put while the Crumb jumps (its own y and its holder's).
      const lift = Number(gsap.getProperty(anchor.parentElement, 'y') || 0) + Number(gsap.getProperty(anchor, 'y') || 0)
      const ground = r.bottom - cr.top - lift
      shadow.current.position.set(g.position.x, -(ground - cr.height / 2) + 2, -60)
      shadow.current.scale.set(size * 0.75, size * 0.16, 1)
    }
  })

  return (
    <>
      <group ref={root}>
        <group ref={head}>
          <Body kind={kind} blink={blink} />
        </group>
      </group>
      <mesh ref={shadow}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
    </>
  )
}

function Studio() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      env.dispose()
      pm.dispose()
    }
  }, [gl, scene])
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[-300, 500, 600]} intensity={1.6} />
      <directionalLight position={[400, -100, 300]} intensity={0.35} color="#c7d2fe" />
    </>
  )
}

// The 3D layer for one scene. `scene` is the element holding the flat Crumbs.
export default function Crumbs3D({ scene }: { scene: RefObject<HTMLElement> }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [anchors, setAnchors] = useState<SVGSVGElement[]>([])
  const [onScreen, setOnScreen] = useState(true)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const el = scene.current
    if (!el) return
    setReady(true)
    setAnchors([...el.querySelectorAll<SVGSVGElement>('svg.crumb')])
    el.classList.add('crumbs-3d')
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: '100px' })
    io.observe(el)
    return () => {
      el.classList.remove('crumbs-3d')
      io.disconnect()
    }
  }, [scene])
  return (
    <div ref={wrap} className="pointer-events-none absolute -inset-x-[12%] -inset-y-[22%] z-10" aria-hidden>
      {ready && (
        <Canvas orthographic flat dpr={[1, 2]} frameloop={onScreen ? 'always' : 'never'} camera={{ position: [0, 0, 500], zoom: 1, near: 1, far: 2000 }} gl={{ alpha: true, antialias: true }} style={{ pointerEvents: 'none' }}>
          <Studio />
          {anchors.map((a, i) => (
            <Follower key={i} anchor={a} wrap={wrap} index={i} />
          ))}
        </Canvas>
      )}
    </div>
  )
}

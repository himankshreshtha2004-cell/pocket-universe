import * as THREE from "three";

/** shared, per-frame animated state (written by Atmosphere, read by assets) */
export const FX = { night: 0, time: 0, reduced: false, wind: 1, fog: new THREE.Color("#d6e8f5") };

const cache = new Map<string, THREE.Material>();
export function std(color: string, o: { e?: string; ei?: number; rough?: number; metal?: number; opacity?: number; side?: THREE.Side; smooth?: boolean } = {}) {
  const key = [color, o.e, o.ei, o.rough, o.metal, o.opacity, o.side, o.smooth].join("|");
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, flatShading: !o.smooth, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0,
      ...(o.e ? { emissive: new THREE.Color(o.e), emissiveIntensity: o.ei ?? 0 } : {}),
      transparent: o.opacity != null, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide,
    });
    cache.set(key, m);
  }
  return m;
}

/** materials whose glow follows the time of day: windows light up after sunset, magic glows brighter at night */
type GlowKind = "window" | "magic" | "mushroom";
const glows: { m: THREE.MeshStandardMaterial; kind: GlowKind; base: number }[] = [];
const glowCache = new Map<string, THREE.MeshStandardMaterial>();
/** soft, rounded material for leaves, clouds, petals and candy */
export const soft = (color: string, rough = 0.78) => std(color, { smooth: true, rough });

export function glow(color: string, kind: GlowKind, base = 1, smooth = false) {
  const key = color + kind + base + smooth;
  let m = glowCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: kind === "window" ? "#4a3a5a" : color, emissive: new THREE.Color(color), emissiveIntensity: 0, flatShading: !smooth, roughness: 0.4, toneMapped: false });
    glows.push({ m, kind, base });
    glowCache.set(key, m);
  }
  return m;
}

/** soft round glow sprite texture */
let glowTex: THREE.Texture | null = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!, r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,.55)"); r.addColorStop(0.6, "rgba(255,255,255,.12)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
const halos: { m: THREE.SpriteMaterial; kind: GlowKind; base: number }[] = [];
const haloCache = new Map<string, THREE.SpriteMaterial>();
export function halo(color: string, kind: GlowKind, base = 0.8) {
  const key = color + kind + base;
  let m = haloCache.get(key);
  if (!m) {
    m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    halos.push({ m, kind, base }); haloCache.set(key, m);
  }
  return m;
}

/** called every frame by the atmosphere with the smoothed night factor (0 day … 1 night) */
export function updateGlows(night: number, t: number) {
  for (const g of glows) {
    const pulse = 1; // steady light: nothing blinks
    const k = g.kind === "window" ? Math.max(0, night - 0.15) * 3.2 * g.base : g.kind === "mushroom" ? (0.25 + night * 1.9) * g.base * pulse : (0.9 + night * 1.9) * g.base * pulse;
    g.m.emissiveIntensity = k;
    if (g.kind === "window") g.m.color.setRGB(0.29 + night * 0.5, 0.23 + night * 0.35, 0.35 + night * 0.1);
  }
  for (const h of halos) {
    h.m.opacity = h.kind === "window" ? Math.max(0, night - 0.2) * h.base * 1.2 : (0.35 + night * 0.85) * h.base;
  }
}

export const ghostMat = new THREE.MeshStandardMaterial({ color: "#87dccf", transparent: true, opacity: 0.5, emissive: new THREE.Color("#87dccf"), emissiveIntensity: 0.35, flatShading: true, depthWrite: false });
export const ghostBadMat = new THREE.MeshStandardMaterial({ color: "#f28f9b", transparent: true, opacity: 0.45, emissive: new THREE.Color("#f28f9b"), emissiveIntensity: 0.3, flatShading: true, depthWrite: false });

/** shared low-poly geometries */
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  blob: new THREE.IcosahedronGeometry(1, 1),
  puff: new THREE.IcosahedronGeometry(1, 3),
  ball: new THREE.SphereGeometry(1, 24, 16),
  blob0: new THREE.IcosahedronGeometry(1, 0),
  dodeca: new THREE.DodecahedronGeometry(1, 0),
  octa: new THREE.OctahedronGeometry(1, 0),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone7: new THREE.ConeGeometry(1, 1, 7),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
  trunk: new THREE.CylinderGeometry(0.7, 1, 1, 6),
  prism: (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 3); g.rotateZ(Math.PI / 2); g.rotateX(-Math.PI / 2); return g; })(),
  cap: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  sphere: new THREE.SphereGeometry(1, 10, 8),
  torus: new THREE.TorusGeometry(1, 0.16, 6, 18),
  ring: new THREE.RingGeometry(0.82, 1, 40),
  disc: new THREE.CircleGeometry(1, 24),
  plane: new THREE.PlaneGeometry(1, 1),
};

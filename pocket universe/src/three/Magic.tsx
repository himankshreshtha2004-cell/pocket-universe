// The "magic layer": lush wind-blown grass, floating sparkles, mist and hanging roots under the island.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Biome } from "../data/biomes";
import { ITEMS } from "../data/catalog";
import { hash2, mulberry32 } from "../data/rng";
import { heightAt, rimAt, vx } from "../data/terrain";
import { SURFACES, type Placed, type Terrain } from "../data/types";
import { FX, glowTexture } from "./mats";

/** light that the grass shader follows (written by the atmosphere every frame) */
export const grassLight = { sun: { value: new THREE.Color(1, 1, 1) }, amb: { value: new THREE.Color(0.6, 0.6, 0.6) }, time: { value: 0 }, wind: { value: 1 } };

const bladeGeo = (() => {
  // a tapered, slightly curved blade: 4 segments
  const pos: number[] = [], idx: number[] = [];
  const seg = 4;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, w = 0.5 * (1 - t) * (1 - t * 0.2);
    pos.push(-w, t, t * t * 0.15, w, t, t * t * 0.15);
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
})();

const grassMat = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: { uSun: grassLight.sun, uAmb: grassLight.amb, uTime: grassLight.time, uWind: grassLight.wind },
  vertexShader: /* glsl */ `
    attribute vec3 iPos; attribute vec4 iData; attribute vec3 iCol;
    uniform float uTime; uniform float uWind;
    varying vec3 vCol; varying float vT;
    void main() {
      float h = iData.x, rot = iData.y, w = iData.z, ph = iData.w;
      vec3 p = position;
      vT = p.y;
      p.x *= w; p.y *= h; p.z *= h;
      float c = cos(rot), s = sin(rot);
      p = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
      float t2 = vT * vT;
      float gust = sin(uTime * 1.3 + iPos.x * 0.35 + iPos.z * 0.25) * 0.6 + 0.4;
      p.x += (sin(uTime * 2.1 + ph + iPos.x * 0.9) * 0.5 + gust * 0.6) * uWind * t2 * h * 0.32;
      p.z += cos(uTime * 1.7 + ph + iPos.z * 0.8) * uWind * t2 * h * 0.18;
      vCol = iCol;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p + iPos, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uSun; uniform vec3 uAmb;
    varying vec3 vCol; varying float vT;
    void main() {
      vec3 base = vCol * mix(0.5, 1.06, vT);
      vec3 col = base * (uAmb + uSun * (0.45 + 0.75 * vT));
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
});

const NO_GRASS = new Set(["cottage", "cabin", "tower", "windmill", "tile", "path", "pond", "portal", "bridge", "patch", "hill"]);

export function GrassField({ t, biome, seed, objects }: { t: Terrain; biome: Biome; seed: number; objects: Placed[] }) {
  const pal = biome.palette;
  // only buildings and flat decorations push the grass away
  const blockers = objects.filter((o) => NO_GRASS.has(o.kind));
  const sig = blockers.map((o) => `${o.p[0].toFixed(1)},${o.p[2].toFixed(1)},${o.s.toFixed(1)}`).join(";");
  const mesh = useMemo(() => {
    const m = t.n - 1;
    const dens = biome.id === "desert" ? 0 : biome.id === "snow" ? 6 : 13;
    const grassC = new THREE.Color(pal.surface.grass), meadowC = new THREE.Color(pal.surface.meadow), bloomC = new THREE.Color(pal.surface.bloom);
    const fol = pal.foliage.map((c) => new THREE.Color(c));
    const P: number[] = [], D: number[] = [], C: number[] = [];
    const tmp = new THREE.Color();
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const s = SURFACES[t.surface[j * m + i]];
      if (s !== "grass" && s !== "meadow" && s !== "bloom") continue;
      const base = s === "grass" ? grassC : s === "meadow" ? meadowC : bloomC;
      const cnt = s === "grass" ? dens : Math.round(dens * 0.7);
      for (let k = 0; k < cnt; k++) {
        const x = vx(t, i) + hash2(i * 7 + k, j * 3, seed + 1) * t.cell, z = vx(t, j) + hash2(i * 5, j * 9 + k, seed + 2) * t.cell;
        if (Math.hypot(x, z) > rimAt(t, Math.atan2(z, x)) - 0.25) continue;
        const y = heightAt(t, x, z);
        if (y < t.water + 0.02) continue;
        let blocked = false;
        for (const o of blockers) { const rr = ITEMS[o.kind].r * o.s * 0.95; if ((o.p[0] - x) ** 2 + (o.p[2] - z) ** 2 < rr * rr) { blocked = true; break; } }
        if (blocked) continue;
        const r = hash2(i * 13 + k, j * 11 - k, seed + 3);
        P.push(x, y - 0.01, z);
        D.push((biome.id === "snow" ? 0.12 : 0.16) + r * 0.22, r * 40, 0.045 + r * 0.03, r * 6.28);
        tmp.copy(base).lerp(fol[Math.floor(r * 97) % fol.length], 0.45).offsetHSL((r - 0.5) * 0.03, 0.06, (r - 0.5) * 0.08);
        C.push(tmp.r, tmp.g, tmp.b);
      }
    }
    const g = bladeGeo.clone() as THREE.InstancedBufferGeometry;
    g.setAttribute("iPos", new THREE.InstancedBufferAttribute(new Float32Array(P), 3));
    g.setAttribute("iData", new THREE.InstancedBufferAttribute(new Float32Array(D), 4));
    g.setAttribute("iCol", new THREE.InstancedBufferAttribute(new Float32Array(C), 3));
    g.instanceCount = P.length / 3;
    return g;
  }, [t.heights, t.surface, seed, sig, biome]);
  return <mesh geometry={mesh} material={grassMat} frustumCulled={false} />;
}

/** warm sparkles drifting up around the island */
export function Motes({ R, h = 7, y0 = -0.5, size = 1 }: { R: number; h?: number; y0?: number; size?: number }) {
  const n = 90;
  const { geo, base } = useMemo(() => {
    const r = mulberry32(77), a = new Float32Array(n * 3), b = new Float32Array(n * 4), c = new Float32Array(n * 3);
    const tints = ["#fff1d6", "#f2b2d6", "#87dccf", "#a9c9f5", "#ffd58a"].map((h) => new THREE.Color(h));
    for (let i = 0; i < n; i++) {
      const t = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 1.15;
      b[i * 4] = Math.cos(t) * d; b[i * 4 + 1] = r() * h; b[i * 4 + 2] = Math.sin(t) * d; b[i * 4 + 3] = r() * 10;
      const k = tints[Math.floor(r() * tints.length)]; c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(a, 3)); g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return { geo: g, base: b };
  }, [R, h]);
  const mat = useMemo(() => new THREE.PointsMaterial({ map: glowTexture(), vertexColors: true, size: 0.2, transparent: true, depthWrite: false }), []);
  useFrame(() => {
    mat.opacity = 0.3 + FX.night * 0.3;
    mat.size = (0.18 + FX.night * 0.08) * size;
    const a = geo.attributes.position.array as Float32Array, tt = FX.time * (FX.reduced ? 0.15 : 1);
    for (let i = 0; i < n; i++) {
      const s = base[i * 4 + 3], y = (base[i * 4 + 1] + tt * (0.12 + (s % 1) * 0.12) * h / 7) % h;
      const sw = 0.5 * h / 7; a[i * 3] = base[i * 4] + Math.sin(tt * 0.4 + s) * sw; a[i * 3 + 1] = y + y0; a[i * 3 + 2] = base[i * 4 + 2] + Math.cos(tt * 0.35 + s) * sw;
    }
    geo.attributes.position.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

/** soft mist gathering under the floating island */
export function Mist({ R, color }: { R: number; color: THREE.Color }) {
  const puffs = useMemo(() => { const r = mulberry32(5); return Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + r(), d: R * (0.2 + r() * 0.75), y: -R * (0.35 + r() * 0.5) - 1, s: R * (0.9 + r() * 0.9), sp: (r() - 0.5) * 0.04 })); }, [R]);
  const mats = useMemo(() => puffs.map(() => new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, opacity: 0.3, fog: false })), [puffs]);
  const grp = useRef<THREE.Group>(null);
  useFrame(() => {
    mats.forEach((m) => { m.color.copy(color).lerp(new THREE.Color("#ffffff"), 0.35); m.opacity = 0.26 - FX.night * 0.1; });
    if (grp.current && !FX.reduced) grp.current.rotation.y = FX.time * 0.01;
  });
  return <group ref={grp}>{puffs.map((p, i) => <sprite key={i} material={mats[i]} position={[Math.cos(p.a) * p.d, p.y, Math.sin(p.a) * p.d]} scale={[p.s, p.s * 0.55, 1]} />)}</group>;
}

/** roots dangling from the underside */
export function Roots({ t, color, seed }: { t: Terrain; color: string; seed: number }) {
  const geo = useMemo(() => {
    const r = mulberry32(seed + 91), parts: THREE.BufferGeometry[] = [];
    const R = t.radius;
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2, rr = rimAt(t, a) * (0.55 + r() * 0.35), y0 = -0.6 - (1 - rr / R) * R * 0.5;
      const len = 0.8 + r() * 1.8, sx = Math.cos(a), sz = Math.sin(a);
      const pts = [0, 0.33, 0.66, 1].map((u) => new THREE.Vector3(sx * (rr + u * 0.6 + Math.sin(u * 5 + i) * 0.25), y0 - u * len, sz * (rr + u * 0.6) + Math.cos(u * 4 + i) * 0.25));
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.035 + r() * 0.03, 5, false));
    }
    return mergeGeometries(parts)!;
  }, [t.radius, t.edge, seed]);
  return <mesh geometry={geo}><meshStandardMaterial color={color} roughness={1} transparent opacity={0.85} /></mesh>;
}

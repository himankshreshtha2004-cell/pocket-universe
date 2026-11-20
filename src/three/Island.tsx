import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BIOMES, type Biome } from "../data/biomes";
import { ITEMS } from "../data/catalog";
import { hash2, mulberry32 } from "../data/rng";
import { groundY, heightAt, rimAt, vx } from "../data/terrain";
import { SURFACES, type Placed, type Terrain, type World } from "../data/types";
import { Model } from "./assets";
import { FX, G, std } from "./mats";
import { GrassField, Mist, Motes, Roots } from "./Magic";

/** registry the editor uses to raycast */
export const registry = { terrain: null as THREE.Mesh | null, objects: new Map<string, THREE.Object3D>() };

const tmpC = new THREE.Color();
function terrainGeometry(t: Terrain, biome: Biome, seed: number) {
  const n = t.n, m = n - 1, pal = biome.palette.surface;
  const cols = SURFACES.map((s) => new THREE.Color(pal[s]));
  const stone = new THREE.Color(pal.stone);
  // vertices: outside ones are pulled onto the coastline for a smooth rim
  const P = new Float32Array(n * n * 3), C = new Float32Array(n * n * 3), inside = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let x = vx(t, i), z = vx(t, j);
    const k = j * n + i, d = Math.hypot(x, z), R = rimAt(t, Math.atan2(z, x));
    let y = t.heights[k];
    if (d > R) { const f = R / d; x *= f; z *= f; y = 0.02; } else inside[k] = 1;
    P[k * 3] = x; P[k * 3 + 1] = y; P[k * 3 + 2] = z;
    // colour = blend of the (up to four) cells touching this vertex
    let r = 0, g = 0, b = 0, c = 0;
    for (const [ci, cj] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) {
      if (ci < 0 || cj < 0 || ci >= m || cj >= m) continue;
      const col = cols[t.surface[cj * m + ci] ?? 0]; r += col.r; g += col.g; b += col.b; c++;
    }
    tmpC.setRGB(r / c, g / c, b / c);
    // steep ground shows a little rock; tiny variation keeps it organic
    const sl = Math.min(1, Math.max(0, (Math.abs((t.heights[k + 1] ?? y) - (t.heights[k - 1] ?? y)) + Math.abs((t.heights[k + n] ?? y) - (t.heights[k - n] ?? y))) / t.cell * 0.35 - 0.25));
    tmpC.lerp(stone, sl * 0.6).offsetHSL(0, 0.02, (hash2(i, j, seed) - 0.5) * 0.035);
    C[k * 3] = tmpC.r; C[k * 3 + 1] = tmpC.g; C[k * 3 + 2] = tmpC.b;
  }
  const idx: number[] = [];
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    if (!(inside[a] || inside[b] || inside[c] || inside[d])) continue;
    if ((i + j) % 2) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(P, 3));
  g.setAttribute("color", new THREE.BufferAttribute(C, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function undersideGeometry(t: Terrain, biome: Biome, seed: number) {
  const R = t.radius, depth = R * 0.55 + 2.2;
  const prof: [number, number][] = [[1.0, 0.02], [1.005, -0.12], [0.97, -0.32], [0.88, -0.25 * depth], [0.7, -0.45 * depth], [0.48, -0.66 * depth], [0.26, -0.84 * depth], [0.05, -depth]];
  const segs = 64, rows = prof.length;
  const [top, bot] = biome.palette.under;
  const ct = new THREE.Color(top), cb = new THREE.Color(bot), lip = new THREE.Color(biome.palette.surface[SURFACES[t.surface[0]] ?? "grass"]).multiplyScalar(0.8), soil = new THREE.Color(biome.palette.surface.soil);
  const P: THREE.Vector3[][] = [];
  for (let r = 0; r < rows; r++) {
    P.push([]);
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2, rim = rimAt(t, a) / R;
      const jit = r < 2 ? 0 : (hash2(s, r, seed) - 0.5) * 0.14;
      const rad = R * prof[r][0] * rim * (1 + jit);
      const y = prof[r][1] + (r > 1 && r < rows - 1 ? (hash2(s + 3, r + 9, seed) - 0.5) * 0.5 : 0);
      P[r].push(new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad));
    }
  }
  const pos: number[] = [], col: number[] = [];
  const colAt = (r: number) => (r <= 1 ? lip : r === 2 ? soil : ct.clone().lerp(cb, (r - 2) / (rows - 3)));
  for (let r = 0; r < rows - 1; r++) for (let s = 0; s < segs; s++) {
    const s2 = (s + 1) % segs, a = P[r][s], b = P[r][s2], c = P[r + 1][s], d = P[r + 1][s2];
    const cA = colAt(r).clone().offsetHSL(0, 0, (hash2(s, r, seed + 5) - 0.5) * 0.06);
    for (const v of [a, c, b, b, c, d]) { pos.push(v.x, v.y, v.z); col.push(cA.r, cA.g, cA.b); }
  }
  // a cap under the coastline so no gaps show from below
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
const underMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });

function Water({ t, biome }: { t: Terrain; biome: Biome }) {
  const pal = biome.palette;
  const geo = useMemo(() => {
    const segs = 96, rings = 22, R = t.radius;
    const pos: number[] = [], idx: number[] = [];
    pos.push(0, 0, 0);
    for (let r = 1; r <= rings; r++) for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2, rr = (r / rings) * rimAt(t, a) * 0.985;
      pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    }
    for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
    for (let r = 1; r < rings; r++) for (let s = 0; s < segs; s++) {
      const a = 1 + (r - 1) * segs + s, b = 1 + (r - 1) * segs + ((s + 1) % segs), c = a + segs, d = b + segs;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    // colour by depth: pale at the shore, rich in the middle, a touch of foam where it meets land
    const shallow = new THREE.Color(pal.water).lerp(new THREE.Color("#ffffff"), pal.frozen ? 0.2 : 0.28), deep = new THREE.Color(pal.waterDeep), foam = new THREE.Color("#ffffff");
    const col: number[] = [], c = new THREE.Color();
    for (let i = 0; i < pos.length; i += 3) {
      const depth = t.water - heightAt(t, pos[i], pos[i + 2]);
      const k = Math.min(1, Math.max(0, depth / 0.75));
      c.copy(shallow).lerp(deep, Math.pow(k, 0.8));
      if (!pal.frozen && depth < 0.06) c.lerp(foam, 0.55 * (1 - Math.max(0, depth) / 0.06));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }, [t.radius, t.edge, t.heights, pal]);
  const mat = useMemo(() => pal.frozen
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.05 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.16, metalness: 0.12, transparent: true, opacity: Math.min(0.9, pal.waterOpacity + 0.05), emissive: new THREE.Color(pal.water), emissiveIntensity: 0.1 }), [pal]);
  const base = useMemo(() => (geo.attributes.position.array as Float32Array).slice(), [geo]);
  useFrame(() => {
    if (pal.frozen || FX.reduced) return;
    const a = geo.attributes.position.array as Float32Array, tt = FX.time;
    for (let i = 0; i < a.length; i += 3) a[i + 1] = Math.sin(base[i] * 1.3 + tt * 1.1) * 0.025 + Math.cos(base[i + 2] * 1.1 + tt * 0.9) * 0.025;
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  });
  return <mesh geometry={geo} material={mat} position={[0, t.water, 0]} receiveShadow />;
}

/** decorative instanced ground details: grass tufts, tiny flowers, pebbles — derived from terrain, not editable */
function Scatter({ t, biome, seed }: { t: Terrain; biome: Biome; seed: number }) {
  const pal = biome.palette;
  const data = useMemo(() => {
    const m = t.n - 1, tufts: number[][] = [], blooms: number[][] = [], pebbles: number[][] = [];
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const s = SURFACES[t.surface[j * m + i]];
      for (let k = 0; k < 2; k++) {
        const h = hash2(i * 3 + k, j * 5 + k, seed + 404);
        const x = vx(t, i) + hash2(i + k, j, seed + 1) * t.cell, z = vx(t, j) + hash2(i, j + k, seed + 2) * t.cell;
        if (Math.hypot(x, z) > rimAt(t, Math.atan2(z, x)) - 0.3) continue;
        const y = heightAt(t, x, z);
        if (y < t.water + 0.03) continue;
        if ((s === "meadow" || s === "bloom") && h > 0.78) blooms.push([x, y, z, h]);
        else if (s === "grass" && h > 0.93) blooms.push([x, y, z, h]);
        else if ((s === "sand" || s === "stone" || s === "soil") && h < 0.12) pebbles.push([x, y, z, h]);
        else if (s === "snow" && h < 0.05) pebbles.push([x, y, z, h]);
      }
    }
    return { tufts, blooms, pebbles };
  }, [t.heights, t.surface, seed]);
  const bloomRef = useRef<THREE.InstancedMesh>(null), pebRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D(), c = new THREE.Color();
    const fill = (ref: React.RefObject<THREE.InstancedMesh>, arr: number[][], fn: (p: number[], i: number) => void) => {
      const im = ref.current; if (!im) return;
      arr.forEach((p, i) => { fn(p, i); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, c); });
      im.count = arr.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    };
    fill(bloomRef, data.blooms, (p) => { o.position.set(p[0], p[1] + 0.2 + (p[3] % 0.1), p[2]); o.rotation.set(0, p[3] * 9, 0); o.scale.set(0.05, 0.03, 0.05); c.set(pal.flowers[Math.floor(p[3] * 31) % pal.flowers.length]); });
    fill(pebRef, data.pebbles, (p) => { o.position.set(p[0], p[1] + 0.02, p[2]); o.rotation.set(p[3] * 7, p[3] * 13, 0); o.scale.set(0.07, 0.04, 0.06); c.set(biome.id === "snow" ? "#ffffff" : pal.rock[Math.floor(p[3] * 50) % pal.rock.length]); });
  }, [data, pal]);
  const max = (t.n - 1) * (t.n - 1) * 2;
  return (
    <group>
      <instancedMesh ref={bloomRef} args={[G.puff, std("#ffffff", { smooth: true, rough: 0.6 }), max]} frustumCulled={false} />
      <instancedMesh ref={pebRef} args={[G.dodeca, std("#ffffff"), max]} frustumCulled={false} castShadow />
    </group>
  );
}

/** floating islets and waterfalls for the Floating Islands biome */
function Islets({ t, biome, seed }: { t: Terrain; biome: Biome; seed: number }) {
  const pal = biome.palette;
  const items = useMemo(() => {
    const r = mulberry32(seed + 55);
    return Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + r() * 0.6, d = t.radius * (1.35 + r() * 0.5);
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, y: -1 + r() * 3.2, s: 0.5 + r() * 0.7, ph: r() * 6, tree: r() > 0.35, ruin: r() > 0.7 };
    });
  }, [t.radius, seed]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => { items.forEach((it, i) => { const g = refs.current[i]; if (g && !FX.reduced) g.position.y = it.y + Math.sin(FX.time * 0.5 + it.ph) * 0.18; }); });
  return (
    <group>
      {items.map((it, i) => (
        <group key={i} ref={(g) => (refs.current[i] = g)} position={[it.x, it.y, it.z]} scale={it.s}>
          <mesh geometry={G.cone7} material={std(pal.under[0])} position={[0, -0.7, 0]} scale={[0.9, 1.4, 0.9]} rotation={[Math.PI, 0, 0]} castShadow />
          <mesh geometry={G.cyl8} material={std(pal.surface.grass)} position={[0, 0.02, 0]} scale={[0.95, 0.1, 0.95]} receiveShadow />
          {it.tree && <group position={[0.15, 0.06, 0]} scale={0.7}><Model kind="tree" biome={biome} v={i * 17} /></group>}
          {it.ruin && <mesh geometry={G.cyl8} material={std(pal.rock[0])} position={[-0.3, 0.35, 0.1]} scale={[0.1, 0.6, 0.1]} castShadow />}
        </group>
      ))}
    </group>
  );
}
let fallTex: THREE.CanvasTexture | null = null;
function fallTexture() {
  if (fallTex) return fallTex;
  const c = document.createElement("canvas"); c.width = 32; c.height = 128; const g = c.getContext("2d")!;
  for (let y = 0; y < 128; y += 2) for (let x = 0; x < 32; x += 2) { const v = Math.random(); g.fillStyle = `rgba(255,255,255,${0.25 + v * 0.6})`; if (v > 0.35) g.fillRect(x, y, 2, 6 + v * 10); }
  fallTex = new THREE.CanvasTexture(c); fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping; return fallTex;
}
function Waterfalls({ t, biome, seed }: { t: Terrain; biome: Biome; seed: number }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: fallTexture(), color: biome.palette.water, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), [biome]);
  const falls = useMemo(() => { const r = mulberry32(seed + 9); return [0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2 + r() * 1.2; return { a, R: rimAt(t, a) }; }); }, [t.edge, seed]);
  useFrame((_, dt) => { if (!FX.reduced) mat.map!.offset.y += dt * 0.9; });
  return (
    <group>
      {falls.map((f, i) => (
        <mesh key={i} geometry={G.plane} material={mat} position={[Math.cos(f.a) * (f.R + 0.05), -3.2, Math.sin(f.a) * (f.R + 0.05)]} rotation={[0, -f.a + Math.PI / 2, 0]} scale={[0.55, 6.4, 1]} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ placed objects */
const PlacedObject = memo(function PlacedObject({ o, t, biome, born, selected, hovered, reg }: { o: Placed; t: Terrain; biome: Biome; born?: number; selected: boolean; hovered: boolean; reg?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const y = groundY(t, o.kind, o.p[0], o.p[2]) + o.p[1];
  useEffect(() => {
    const g = ref.current; if (!g || !reg) return;
    g.userData.pid = o.id; registry.objects.set(o.id, g);
    return () => { if (registry.objects.get(o.id) === g) registry.objects.delete(o.id); };
  }, [o.id, reg]);
  useFrame(() => {
    const g = ref.current; if (!g) return;
    let k = 1;
    if (born) { const e = Math.min(1, (performance.now() - born) / 520); k = e >= 1 ? 1 : 1 + 2.4 * Math.pow(e - 1, 3) + 1.4 * Math.pow(e - 1, 2); }
    const lift = selected ? 1.04 : hovered ? 1.02 : 1;
    g.scale.setScalar(o.s * k * lift);
  });
  return (
    <group ref={ref} position={[o.p[0], y, o.p[2]]} rotation={[0, o.r, 0]}>
      <Model kind={o.kind} biome={biome} v={o.v} />
    </group>
  );
});

function Dying({ o, t, biome, at }: { o: Placed; t: Terrain; biome: Biome; at: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => { const g = ref.current; if (!g) return; const e = Math.min(1, (performance.now() - at) / 340); g.scale.setScalar(o.s * (1 - e * e) * (1 + e * 0.2)); g.position.y = groundY(t, o.kind, o.p[0], o.p[2]) + o.p[1] + e * 0.3; });
  return <group ref={ref} position={[o.p[0], 0, o.p[2]]} rotation={[0, o.r, 0]}><Model kind={o.kind} biome={biome} v={o.v} /></group>;
}

export function Island({ world, editable, selectedId, hoverId, justPlaced, thumb }: { world: World; editable?: boolean; selectedId?: string | null; hoverId?: string | null; justPlaced?: Record<string, number>; thumb?: boolean }) {
  const biome = BIOMES[world.biome], t = world.terrain;
  const tGeo = useMemo(() => terrainGeometry(t, biome, world.seed), [t.heights, t.surface, biome, world.seed]);
  const uGeo = useMemo(() => undersideGeometry(t, biome, world.seed), [t.radius, t.edge, biome, world.seed]);
  useEffect(() => () => tGeo.dispose(), [tGeo]);
  useEffect(() => () => uGeo.dispose(), [uGeo]);
  const tRef = useRef<THREE.Mesh>(null);
  useEffect(() => { if (editable) registry.terrain = tRef.current; return () => { if (editable && registry.terrain === tRef.current) registry.terrain = null; }; }, [editable]);

  // keep removed objects around briefly so they can shrink away
  const prev = useRef<Placed[]>(world.objects);
  const [dying, setDying] = useState<{ o: Placed; at: number }[]>([]);
  useEffect(() => {
    const ids = new Set(world.objects.map((o) => o.id));
    const gone = prev.current.filter((o) => !ids.has(o.id));
    prev.current = world.objects;
    if (editable && gone.length && gone.length < 6) {
      const at = performance.now();
      setDying((d) => [...d, ...gone.map((o) => ({ o, at }))]);
      window.setTimeout(() => setDying((d) => d.filter((x) => x.at !== at)), 380);
    }
  }, [world.objects, editable]);

  return (
    <group>
      <mesh ref={tRef} geometry={tGeo} material={terrainMat} receiveShadow castShadow name="terrain" />
      <mesh geometry={uGeo} material={underMat} castShadow />
      {t.water > -0.5 && <Water t={t} biome={biome} />}
      <Scatter t={t} biome={biome} seed={world.seed} />
      <GrassField t={t} biome={biome} seed={world.seed} objects={world.objects} />
      <Roots t={t} color={new THREE.Color(biome.palette.under[0]).lerp(new THREE.Color(biome.palette.under[1]), 0.5).getStyle()} seed={world.seed} />
      {!thumb && <><Motes R={t.radius} /><Mist R={t.radius} color={FX.fog} /></>}
      {world.objects.map((o) => (
        <PlacedObject key={o.id} o={o} t={t} biome={biome} born={justPlaced?.[o.id]} selected={selectedId === o.id} hovered={hoverId === o.id} reg={editable} />
      ))}
      {dying.map((d) => <Dying key={d.o.id + d.at} o={d.o} t={t} biome={biome} at={d.at} />)}
      {world.biome === "islands" && <><Islets t={t} biome={biome} seed={world.seed} /><Waterfalls t={t} biome={biome} seed={world.seed} /></>}
    </group>
  );
}

export function SelectionRing({ world, id }: { world: World; id: string | null }) {
  const ref = useRef<THREE.Mesh>(null);
  const o = id ? world.objects.find((x) => x.id === id) : null;
  useFrame(() => { if (ref.current) { const k = 1 + Math.sin(performance.now() / 260) * 0.04; ref.current.scale.setScalar((o ? ITEMS[o.kind].r * o.s + 0.18 : 1) * k); } });
  if (!o) return null;
  const y = groundY(world.terrain, o.kind, o.p[0], o.p[2]) + 0.04;
  return (
    <mesh ref={ref} geometry={G.ring} position={[o.p[0], y, o.p[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
      <meshBasicMaterial color="#87dccf" transparent opacity={0.9} depthWrite={false} />
    </mesh>
  );
}

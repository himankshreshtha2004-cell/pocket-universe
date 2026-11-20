// Procedural low-poly assets. Every buildable thing is a real 3D model made from shared geometry.
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Biome, Palette } from "../data/biomes";
import { mulberry32 } from "../data/rng";
import type { ObjectKind } from "../data/types";
import { FX, G, ghostBadMat, ghostMat, glow, glowTexture, halo, soft, std } from "./mats";

type V3 = [number, number, number];
interface MP { g: THREE.BufferGeometry; m: THREE.Material; p?: V3; s?: V3 | number; r?: V3; shadow?: boolean }
function M({ g, m, p, s, r, shadow = true }: MP) {
  const sc: V3 = typeof s === "number" ? [s, s, s] : s ?? [1, 1, 1];
  return <mesh geometry={g} material={m} position={p} scale={sc} rotation={r} castShadow={shadow} receiveShadow />;
}
const pick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length) % a.length];

/** gentle wind sway for foliage */
function Sway({ children, amt = 0.04, speed = 1.4, seed = 0 }: { children: React.ReactNode; amt?: number; speed?: number; seed?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current || FX.reduced) return;
    const t = FX.time * speed + seed;
    ref.current.rotation.z = Math.sin(t) * amt * FX.wind;
    ref.current.rotation.x = Math.sin(t * 0.7 + 1.3) * amt * 0.6 * FX.wind;
  });
  return <group ref={ref}>{children}</group>;
}
function Spin({ children, speed = 1, axis = "y" }: { children: React.ReactNode; speed?: number; axis?: "y" | "z" }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (ref.current && !FX.reduced) ref.current.rotation[axis] += dt * speed; });
  return <group ref={ref}>{children}</group>;
}
function Bob({ children, amt = 0.08, speed = 1.2, seed = 0 }: { children: React.ReactNode; amt?: number; speed?: number; seed?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current && !FX.reduced) ref.current.position.y = Math.sin(FX.time * speed + seed) * amt; });
  return <group ref={ref}>{children}</group>;
}
function Halo({ color, kind, size = 1, p = [0, 0, 0], base = 0.8 }: { color: string; kind: "window" | "magic" | "mushroom"; size?: number; p?: V3; base?: number }) {
  return <sprite material={halo(color, kind, base)} position={p} scale={[size, size, size]} />;
}

/* ------------------------------------------------------------------ nature */
function Oak({ pal, r }: { pal: Palette; r: () => number }) {
  const c1 = pick(pal.foliage, r), c2 = pick(pal.foliage, r), h = 0.75 + r() * 0.35;
  return (
    <group>
      <M g={G.trunk} m={std(pal.trunk)} p={[0, h / 2, 0]} s={[0.11, h, 0.11]} />
      <Sway seed={r() * 10}>
        <M g={G.puff} m={soft(c1)} p={[0, h + 0.38, 0]} s={[0.62, 0.55, 0.62]} />
        <M g={G.puff} m={soft(c2)} p={[0.34, h + 0.2, 0.12]} s={0.38} />
        <M g={G.puff} m={soft(c1)} p={[-0.3, h + 0.26, -0.15]} s={0.42} />
        <M g={G.puff} m={soft(c2)} p={[0.02, h + 0.74, 0.06]} s={0.36} />
        <M g={G.puff} m={soft(c1)} p={[0.1, h + 0.3, 0.38]} s={0.3} />
      </Sway>
    </group>
  );
}
function Pine({ pal, r, snowy }: { pal: Palette; r: () => number; snowy: boolean }) {
  const c = pick(pal.foliage, r), h = 1 + r() * 0.3;
  const tiers = [[0.55, 0.75, 0.55], [0.43, 0.65, 0.98], [0.3, 0.55, 1.36]];
  return (
    <group>
      <M g={G.trunk} m={std(pal.trunk)} p={[0, 0.2, 0]} s={[0.09, 0.4, 0.09]} />
      <Sway amt={0.025} seed={r() * 10}>
        {tiers.map(([w, hh, y], i) => (
          <group key={i}>
            <M g={G.cone7} m={std(c)} p={[0, y * h, 0]} s={[w, hh, w]} />
            {snowy && <M g={G.cone7} m={std("#f7f9ff")} p={[0, y * h + hh * 0.28, 0]} s={[w * 0.55, hh * 0.45, w * 0.55]} />}
          </group>
        ))}
      </Sway>
    </group>
  );
}
function Palm({ pal, r }: { pal: Palette; r: () => number }) {
  const lean = 0.12 + r() * 0.12, n = 6, seg = 0.28;
  const pts: V3[] = [];
  for (let i = 0; i < n; i++) pts.push([Math.sin(i / n * 1.2) * lean * i * 0.9, i * seg + seg / 2, 0]);
  const top = pts[n - 1];
  const leafC = pick(pal.foliage, r);
  return (
    <group>
      {pts.map((p, i) => <M key={i} g={G.cyl6} m={std(i % 2 ? pal.trunk : "#b9906a")} p={p} s={[0.085 - i * 0.006, seg * 1.05, 0.085 - i * 0.006]} r={[0, 0, -lean * 0.8]} />)}
      <group position={[top[0], top[1] + 0.12, 0]}>
        <Sway amt={0.06} seed={r() * 10}>
          {Array.from({ length: 7 }, (_, i) => {
            const a = (i / 7) * Math.PI * 2;
            return (
              <group key={i} rotation={[0, a, 0]}>
                <M g={G.blob0} m={std(leafC)} p={[0.38, -0.08, 0]} s={[0.42, 0.04, 0.11]} r={[0, 0, -0.45]} />
              </group>
            );
          })}
          <M g={G.sphere} m={std("#8a5a3a")} p={[0.06, -0.08, 0.05]} s={0.07} />
          <M g={G.sphere} m={std("#8a5a3a")} p={[-0.05, -0.1, -0.04]} s={0.07} />
        </Sway>
      </group>
    </group>
  );
}
function CandyTree({ pal, r }: { pal: Palette; r: () => number }) {
  const c = pick(pal.foliage, r), h = 0.8 + r() * 0.3;
  return (
    <group>
      {[0, 1, 2, 3].map((i) => <M key={i} g={G.cyl8} m={std(i % 2 ? "#fff7ea" : pal.trunk)} p={[0, (i + 0.5) * h / 4, 0]} s={[0.085, h / 4, 0.085]} />)}
      <Sway seed={r() * 10} amt={0.035}>
        <M g={G.ball} m={soft(c, 0.55)} p={[0, h + 0.36, 0]} s={0.5} />
        <M g={G.ball} m={soft(c, 0.55)} p={[0.33, h + 0.2, 0.1]} s={0.3} />
        <M g={G.ball} m={soft(c, 0.55)} p={[-0.3, h + 0.24, -0.12]} s={0.33} />
        <M g={G.ball} m={soft("#fff7ea", 0.55)} p={[0.1, h + 0.72, 0.1]} s={0.16} />
      </Sway>
    </group>
  );
}
function Bush({ pal, r }: { pal: Palette; r: () => number }) {
  const c = pick(pal.foliage, r), d = pick(pal.foliage, r);
  const berries = r() > 0.5;
  return (
    <Sway amt={0.02} seed={r() * 10}>
      <M g={G.puff} m={soft(c)} p={[0, 0.2, 0]} s={[0.36, 0.28, 0.36]} />
      <M g={G.puff} m={soft(d)} p={[0.24, 0.14, 0.08]} s={0.22} />
      <M g={G.puff} m={soft(c)} p={[-0.22, 0.15, -0.06]} s={0.24} />
      {berries && [0, 1, 2].map((i) => <M key={i} g={G.sphere} m={soft(pick(pal.flowers, r), 0.5)} p={[Math.cos(i * 2.1) * 0.26, 0.32 + i * 0.03, Math.sin(i * 2.1) * 0.26]} s={0.045} shadow={false} />)}
    </Sway>
  );
}
function Flowers({ pal, r, big }: { pal: Palette; r: () => number; big: boolean }) {
  const k = big ? 1.9 : 1;
  const items = useMemo(() => Array.from({ length: big ? 3 : 6 }, () => ({ x: (r() - 0.5) * 0.5 * k, z: (r() - 0.5) * 0.5 * k, h: (0.18 + r() * 0.16) * k, c: pick(pal.flowers, r) })), []);
  return (
    <Sway amt={0.05} seed={r() * 10}>
      {items.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]}>
          <M g={G.cyl6} m={std(pal.foliage[0])} p={[0, f.h / 2, 0]} s={[0.012 * k, f.h, 0.012 * k]} shadow={false} />
          <M g={G.puff} m={soft(f.c, 0.6)} p={[0, f.h, 0]} s={[0.07 * k, 0.03 * k, 0.07 * k]} />
          <M g={G.sphere} m={std("#ffd58a")} p={[0, f.h + 0.02 * k, 0]} s={0.025 * k} shadow={false} />
          <M g={G.blob0} m={std(pal.foliage[1] ?? pal.foliage[0])} p={[0.03 * k, f.h * 0.45, 0]} s={[0.045 * k, 0.012 * k, 0.025 * k]} shadow={false} />
        </group>
      ))}
    </Sway>
  );
}
function Rock({ pal, r, desert }: { pal: Palette; r: () => number; desert: boolean }) {
  const c = pick(pal.rock, r), d = pick(pal.rock, r);
  if (desert && r() > 0.45) {
    // a tall wind-carved stack
    return (
      <group>
        <M g={G.dodeca} m={std(c)} p={[0, 0.25, 0]} s={[0.36, 0.3, 0.32]} />
        <M g={G.dodeca} m={std(d)} p={[0.03, 0.62, 0]} s={[0.26, 0.24, 0.24]} r={[0, 0.6, 0]} />
        <M g={G.dodeca} m={std(c)} p={[-0.02, 0.95, 0.02]} s={[0.34, 0.14, 0.3]} r={[0, 1.2, 0]} />
      </group>
    );
  }
  return (
    <group>
      <M g={G.dodeca} m={std(c)} p={[0, 0.16, 0]} s={[0.36, 0.26, 0.3]} r={[r(), r(), 0]} />
      <M g={G.dodeca} m={std(d)} p={[0.28, 0.08, 0.12]} s={[0.18, 0.13, 0.16]} r={[r(), r(), 0]} />
      {r() > 0.4 && <M g={G.dodeca} m={std(d)} p={[-0.22, 0.06, -0.14]} s={0.12} />}
    </group>
  );
}
function Mushrooms({ pal, r, big }: { pal: Palette; r: () => number; big: boolean }) {
  const caps = big ? ["#f7a8cf", "#c7b2f2", "#9fe3d0"] : ["#d96a6a", "#c79be6", "#e9a25c", "#87dccf"];
  const items = useMemo(() => Array.from({ length: 3 }, (_, i) => ({ x: (r() - 0.5) * 0.4, z: (r() - 0.5) * 0.4, h: (i === 0 ? 0.32 : 0.16 + r() * 0.12) * (big ? 1.5 : 1), c: pick(caps, r) })), []);
  return (
    <group>
      {items.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]}>
          <M g={G.cyl12} m={soft("#fff1df")} p={[0, m.h / 2, 0]} s={[0.035 + m.h * 0.05, m.h, 0.035 + m.h * 0.05]} />
          <M g={G.cap} m={glow(m.c, "mushroom", 0.9, true)} p={[0, m.h, 0]} s={[m.h * 0.62, m.h * 0.42, m.h * 0.62]} />
          {i === 0 && <Halo color={m.c} kind="mushroom" size={0.8} p={[0, m.h, 0]} base={0.35} />}
        </group>
      ))}
    </group>
  );
}
function GrassTuft({ pal, r }: { pal: Palette; r: () => number }) {
  const blades = useMemo(() => Array.from({ length: 9 }, () => ({ x: (r() - 0.5) * 0.35, z: (r() - 0.5) * 0.35, h: 0.18 + r() * 0.22, a: (r() - 0.5) * 0.6, c: pick(pal.foliage, r) })), []);
  return (
    <Sway amt={0.08} speed={1.8} seed={r() * 10}>
      {blades.map((b, i) => <M key={i} g={G.cone4} m={std(b.c)} p={[b.x, b.h / 2, b.z]} s={[0.028, b.h, 0.028]} r={[b.a * 0.3, 0, b.a]} shadow={false} />)}
    </Sway>
  );
}

/* ------------------------------------------------------------------ landscape */
function Hill({ pal, r }: { pal: Palette; r: () => number }) {
  return (
    <group>
      <M g={G.puff} m={soft(pal.surface.grass)} p={[0, 0, 0]} s={[1.15, 0.55, 1.0]} />
      <M g={G.puff} m={soft(pal.surface.meadow)} p={[0.35, 0.18, 0.25]} s={[0.55, 0.35, 0.5]} />
      <group position={[-0.2, 0.42, -0.1]}><Flowers pal={pal} r={r} big={false} /></group>
    </group>
  );
}
function Pond({ pal, r, frozen }: { pal: Palette; r: () => number; frozen: boolean }) {
  const stones = useMemo(() => Array.from({ length: 11 }, (_, i) => { const a = (i / 11) * Math.PI * 2 + r() * 0.2; return { x: Math.cos(a) * 0.86, z: Math.sin(a) * 0.72, s: 0.08 + r() * 0.07 }; }), []);
  return (
    <group>
      <M g={G.disc} m={std(frozen ? "#d8eef8" : pal.water, { rough: frozen ? 0.25 : 0.1, metal: 0.05, opacity: frozen ? undefined : 0.88 })} p={[0, 0.045, 0]} s={[0.86, 0.72, 1]} r={[-Math.PI / 2, 0, 0]} shadow={false} />
      <M g={G.disc} m={std(pal.surface.soil)} p={[0, 0.02, 0]} s={[0.95, 0.8, 1]} r={[-Math.PI / 2, 0, 0]} shadow={false} />
      {stones.map((s, i) => <M key={i} g={G.dodeca} m={std(pal.rock[i % pal.rock.length])} p={[s.x, 0.04, s.z]} s={[s.s, s.s * 0.6, s.s]} />)}
      {!frozen && [0, 1].map((i) => <M key={i} g={G.disc} m={std("#7cc48a", { side: THREE.DoubleSide })} p={[0.25 - i * 0.45, 0.06, 0.1 - i * 0.2]} s={0.12} r={[-Math.PI / 2, 0, 0]} shadow={false} />)}
    </group>
  );
}
function PathStones({ pal, r }: { pal: Palette; r: () => number }) {
  return (
    <group>
      {[-0.75, -0.38, 0, 0.38, 0.75].map((x, i) => (
        <M key={i} g={G.cyl8} m={std(i % 2 ? pal.surface.path : pal.rock[0])} p={[x, 0.03, Math.sin(i * 1.3) * 0.08]} s={[0.17 + r() * 0.04, 0.06, 0.15 + r() * 0.04]} r={[0, r(), 0]} />
      ))}
    </group>
  );
}
function Patch({ pal, r }: { pal: Palette; r: () => number }) {
  const dots = useMemo(() => Array.from({ length: 14 }, () => { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.75; return { x: Math.cos(a) * d, z: Math.sin(a) * d, c: pick(pal.flowers, r) }; }), []);
  return (
    <group>
      <M g={G.cyl12} m={std(pal.surface.meadow)} p={[0, 0.02, 0]} s={[0.9, 0.05, 0.8]} shadow={false} />
      {dots.map((d, i) => <M key={i} g={G.blob0} m={std(d.c)} p={[d.x, 0.08, d.z]} s={[0.05, 0.03, 0.05]} shadow={false} />)}
    </group>
  );
}
function Tile({ pal }: { pal: Palette }) {
  return (
    <group>
      <M g={G.cyl6} m={std(pal.rock[0])} p={[0, 0.03, 0]} s={[0.62, 0.06, 0.62]} />
      <M g={G.cyl6} m={std(pal.surface.path)} p={[0, 0.07, 0]} s={[0.46, 0.03, 0.46]} r={[0, Math.PI / 6, 0]} />
      <M g={G.cyl6} m={std(pal.accent)} p={[0, 0.09, 0]} s={[0.24, 0.03, 0.24]} />
      <M g={G.cyl6} m={std("#fff7ea")} p={[0, 0.105, 0]} s={[0.08, 0.02, 0.08]} />
    </group>
  );
}

/* ------------------------------------------------------------------ structures */
function Window({ p, w = 0.12, h = 0.14, ry = 0 }: { p: V3; w?: number; h?: number; ry?: number }) {
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <M g={G.box} m={glow("#ffd59a", "window")} s={[w, h, 0.02]} shadow={false} />
      <Halo color="#ffc77a" kind="window" size={0.55} base={0.55} />
    </group>
  );
}
function Cottage({ pal, r, biome }: { pal: Palette; r: () => number; biome: Biome["id"] }) {
  const roof = biome === "snow" ? "#f7f9ff" : pal.roof;
  return (
    <group>
      <M g={G.box} m={std(pal.surface.stone)} p={[0, 0.04, 0]} s={[1.0, 0.08, 0.86]} />
      <M g={G.box} m={std(pal.wall)} p={[0, 0.38, 0]} s={[0.9, 0.62, 0.74]} />
      <M g={G.prism} m={std(roof)} p={[0, 0.69 + 0.17, 0]} s={[1.08, 0.34, 0.5]} />
      <M g={G.box} m={std(pal.rock[0])} p={[0.26, 1.02, -0.12]} s={[0.12, 0.3, 0.12]} />
      <M g={G.box} m={std(pal.wood)} p={[0, 0.25, 0.375]} s={[0.2, 0.36, 0.02]} />
      <M g={G.sphere} m={std("#ffd58a")} p={[0.06, 0.25, 0.39]} s={0.018} shadow={false} />
      <Window p={[-0.27, 0.42, 0.375]} />
      <Window p={[0.27, 0.42, 0.375]} />
      <Window p={[0.455, 0.42, 0]} ry={Math.PI / 2} />
      <Window p={[-0.455, 0.42, 0]} ry={Math.PI / 2} />
      <M g={G.blob} m={std(pal.foliage[0])} p={[-0.48, 0.12, 0.42]} s={0.14} />
      <M g={G.blob} m={std(pick(pal.flowers, r))} p={[-0.46, 0.22, 0.45]} s={0.05} shadow={false} />
    </group>
  );
}
function Cabin({ pal, biome }: { pal: Palette; biome: Biome["id"] }) {
  const roof = biome === "snow" ? "#f7f9ff" : "#7b5a4a";
  return (
    <group>
      <M g={G.box} m={std(pal.wood)} p={[0, 0.3, 0]} s={[0.92, 0.6, 0.7]} />
      {[0.1, 0.24, 0.38, 0.52].map((y) => <M key={y} g={G.cyl6} m={std("#7b5a4a")} p={[0, y, 0.355]} s={[0.035, 0.94, 0.035]} r={[0, 0, Math.PI / 2]} shadow={false} />)}
      <M g={G.prism} m={std(roof)} p={[0, 0.6 + 0.18, 0]} s={[1.12, 0.36, 0.5]} />
      <M g={G.box} m={std("#5e4236")} p={[-0.18, 0.22, 0.36]} s={[0.18, 0.34, 0.02]} />
      <Window p={[0.2, 0.34, 0.362]} w={0.16} h={0.13} />
      <M g={G.box} m={std(pal.rock[1] ?? pal.rock[0])} p={[0.32, 0.9, 0.05]} s={[0.12, 0.34, 0.12]} />
      <M g={G.box} m={std(pal.wood)} p={[0, 0.03, 0.5]} s={[0.92, 0.04, 0.26]} />
      <M g={G.cyl6} m={std(pal.wood)} p={[0.36, 0.06, 0.6]} s={[0.07, 0.12, 0.07]} />
    </group>
  );
}
function Tower({ pal, r }: { pal: Palette; r: () => number }) {
  return (
    <group>
      <M g={G.cyl8} m={std(pal.rock[0])} p={[0, 0.1, 0]} s={[0.44, 0.2, 0.44]} />
      <M g={G.cyl8} m={std(pal.wall)} p={[0, 0.85, 0]} s={[0.34, 1.5, 0.34]} />
      <M g={G.cyl8} m={std(pal.rock[0])} p={[0, 1.62, 0]} s={[0.42, 0.1, 0.42]} />
      <M g={G.cone7} m={std(pal.roof)} p={[0, 2.0, 0]} s={[0.46, 0.7, 0.46]} />
      <M g={G.cyl6} m={std("#7b5a4a")} p={[0, 2.5, 0]} s={[0.012, 0.35, 0.012]} shadow={false} />
      <Sway amt={0.15} speed={3}><M g={G.box} m={std(pal.accent, { side: THREE.DoubleSide })} p={[0.11, 2.6, 0]} s={[0.2, 0.12, 0.01]} shadow={false} /></Sway>
      <Window p={[0, 1.15, 0.33]} w={0.1} h={0.18} />
      <Window p={[0, 0.65, -0.33]} w={0.1} h={0.18} ry={Math.PI} />
      <M g={G.box} m={std(pal.wood)} p={[0, 0.3, 0.335]} s={[0.16, 0.3, 0.02]} />
    </group>
  );
}
function Bridge({ pal }: { pal: Palette }) {
  const planks = 11, L = 2.2;
  return (
    <group>
      {Array.from({ length: planks }, (_, i) => {
        const u = i / (planks - 1), x = (u - 0.5) * L, y = 0.12 + Math.sin(u * Math.PI) * 0.32;
        const ang = Math.cos(u * Math.PI) * 0.45;
        return <M key={i} g={G.box} m={std(i % 2 ? pal.wood : "#9b6a4a")} p={[x, y, 0]} s={[0.18, 0.05, 0.56]} r={[0, 0, ang]} />;
      })}
      {[-1, 1].map((side) => (
        <group key={side}>
          {Array.from({ length: 5 }, (_, i) => {
            const u = i / 4, x = (u - 0.5) * L, y = 0.12 + Math.sin(u * Math.PI) * 0.32;
            return <M key={i} g={G.cyl6} m={std("#7b5a4a")} p={[x, y + 0.18, side * 0.26]} s={[0.03, 0.36, 0.03]} />;
          })}
          {Array.from({ length: 4 }, (_, i) => {
            const u = (i + 0.5) / 4, x = (u - 0.5) * L, y = 0.12 + Math.sin(u * Math.PI) * 0.32;
            return <M key={i} g={G.cyl6} m={std("#c9a77f")} p={[x, y + 0.32, side * 0.26]} s={[0.012, 0.58, 0.012]} r={[0, 0, Math.PI / 2 + Math.cos(u * Math.PI) * 0.45]} shadow={false} />;
          })}
        </group>
      ))}
    </group>
  );
}
function Windmill({ pal }: { pal: Palette }) {
  return (
    <group>
      <M g={G.cyl8} m={std(pal.wall)} p={[0, 0.7, 0]} s={[0.3, 1.4, 0.3]} />
      <M g={G.cyl8} m={std(pal.rock[0])} p={[0, 0.06, 0]} s={[0.4, 0.12, 0.4]} />
      <M g={G.cone7} m={std(pal.roof)} p={[0, 1.6, 0]} s={[0.38, 0.45, 0.38]} />
      <M g={G.box} m={std(pal.wood)} p={[0, 0.25, 0.29]} s={[0.15, 0.28, 0.02]} />
      <Window p={[0, 0.85, 0.29]} w={0.1} h={0.12} />
      <group position={[0, 1.28, 0.36]}>
        <M g={G.cyl8} m={std("#7b5a4a")} s={[0.05, 0.12, 0.05]} r={[Math.PI / 2, 0, 0]} />
        <Spin speed={0.9} axis="z">
          {[0, 1, 2, 3].map((i) => (
            <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
              <M g={G.box} m={std(pal.wood)} p={[0, 0.42, 0.04]} s={[0.04, 0.84, 0.02]} />
              <M g={G.box} m={std("#fff7ea")} p={[0.08, 0.5, 0.04]} s={[0.14, 0.6, 0.012]} />
            </group>
          ))}
        </Spin>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ magic */
function Crystals({ pal, r }: { pal: Palette; r: () => number }) {
  const ref = useRef<THREE.Group>(null);
  const shards = useMemo(() => Array.from({ length: 5 }, (_, i) => ({ x: i === 0 ? 0 : Math.cos(i * 1.6) * 0.17, z: i === 0 ? 0 : Math.sin(i * 1.6) * 0.17, h: i === 0 ? 0.6 : 0.25 + r() * 0.2, t: (r() - 0.5) * 0.6 })), []);
  return (
    <group ref={ref}>
      {shards.map((s, i) => <M key={i} g={G.octa} m={glow(i % 2 ? pal.glow : "#fff7ea", "magic", i === 0 ? 0.9 : 0.6)} p={[s.x, s.h * 0.5, s.z]} s={[0.1, s.h * 0.55, 0.1]} r={[s.t, 0, s.t * 0.5]} />)}
      <Halo color={pal.glow} kind="magic" size={1.6} p={[0, 0.35, 0]} />
    </group>
  );
}
function Lantern({ pal, r }: { pal: Palette; r: () => number }) {
  const c = pick(["#ffb27a", "#ffd58a", "#f2b2d6"], r);
  return (
    <Bob amt={0.12} speed={1.1} seed={r() * 10}>
      <M g={G.ball} m={glow(c, "magic", 0.9, true)} s={[0.16, 0.19, 0.16]} />
      <M g={G.cyl8} m={std("#7b5a4a")} p={[0, 0.17, 0]} s={[0.07, 0.04, 0.07]} shadow={false} />
      <M g={G.cyl8} m={std("#7b5a4a")} p={[0, -0.17, 0]} s={[0.05, 0.03, 0.05]} shadow={false} />
      <Halo color={c} kind="magic" size={1.3} />
    </Bob>
  );
}
function MagicTree({ pal, r }: { pal: Palette; r: () => number }) {
  const c = pal.glow;
  return (
    <group>
      <M g={G.trunk} m={std("#6a5a8a")} p={[0, 0.4, 0]} s={[0.1, 0.8, 0.1]} r={[0, 0, 0.08]} />
      <M g={G.trunk} m={std("#6a5a8a")} p={[0.12, 0.75, 0]} s={[0.05, 0.4, 0.05]} r={[0, 0, -0.6]} />
      <Sway seed={r() * 10}>
        <M g={G.puff} m={glow(c, "magic", 0.45, true)} p={[0, 1.1, 0]} s={[0.55, 0.45, 0.55]} />
        <M g={G.puff} m={glow("#f2b2d6", "magic", 0.4, true)} p={[0.32, 0.92, 0.1]} s={0.28} />
        <M g={G.puff} m={glow("#a9c9f5", "magic", 0.4, true)} p={[-0.3, 0.98, -0.1]} s={0.3} />
      </Sway>
      <Halo color={c} kind="magic" size={2.4} p={[0, 1.0, 0]} base={0.6} />
      <Sparkles count={10} radius={0.7} y={1.0} color="#fff7ea" />
    </group>
  );
}
function Sparkles({ count = 14, radius = 0.6, y = 0.6, color = "#fff7ea" }: { count?: number; radius?: number; y?: number; color?: string }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry(), a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { const t = Math.random() * Math.PI * 2, d = Math.random() * radius; a[i * 3] = Math.cos(t) * d; a[i * 3 + 1] = y + (Math.random() - 0.5) * radius; a[i * 3 + 2] = Math.sin(t) * d; }
    g.setAttribute("position", new THREE.BufferAttribute(a, 3)); return g;
  }, [count, radius, y]);
  const mat = useMemo(() => new THREE.PointsMaterial({ map: glowTexture(), color, size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), [color]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    if (!FX.reduced) ref.current.rotation.y += dt * 0.35;
    mat.opacity = 0.5 + FX.night * 0.3;
  });
  return <points ref={ref} geometry={geo} material={mat} />;
}
function StarDust({ pal }: { pal: Palette }) {
  return (
    <group>
      <Spin speed={0.6}>
        <M g={G.octa} m={glow("#fff7ea", "magic", 1)} s={[0.09, 0.16, 0.09]} />
        <M g={G.octa} m={glow(pal.glow, "magic", 1)} s={[0.16, 0.06, 0.06]} />
      </Spin>
      <Sparkles count={18} radius={0.55} y={0} color={pal.glow} />
      <Halo color="#fff7ea" kind="magic" size={1.1} />
    </group>
  );
}
let swirlTex: THREE.Texture | null = null;
function swirl() {
  if (swirlTex) return swirlTex;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, "#fff7ea"); grd.addColorStop(0.35, "#c7b2f2"); grd.addColorStop(0.7, "#8177c9"); grd.addColorStop(1, "#242044");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 3;
  for (let k = 0; k < 4; k++) { g.beginPath(); for (let t = 0; t < 1; t += 0.02) { const a = t * Math.PI * 3 + (k * Math.PI) / 2, rr = t * 60; g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); } g.stroke(); }
  swirlTex = new THREE.CanvasTexture(c); swirlTex.colorSpace = THREE.SRGBColorSpace; return swirlTex;
}
function Portal({ pal }: { pal: Palette }) {
  const disc = useMemo(() => new THREE.MeshBasicMaterial({ map: swirl(), transparent: true, opacity: 0.9, side: THREE.DoubleSide }), []);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current && !FX.reduced) ref.current.rotation.z -= dt * 0.8; });
  return (
    <group>
      <M g={G.box} m={std(pal.rock[0])} p={[0, 0.05, 0]} s={[1.0, 0.1, 0.4]} />
      <group position={[0, 0.72, 0]}>
        <M g={G.torus} m={std(pal.rock[0])} s={[0.6, 0.6, 0.9]} />
        {[0, 1, 2, 3, 4, 5].map((i) => <M key={i} g={G.octa} m={glow(pal.glow, "magic", 0.8)} p={[Math.cos(i * 1.047) * 0.6, Math.sin(i * 1.047) * 0.6, 0.08]} s={0.06} shadow={false} />)}
        <mesh ref={ref} geometry={G.disc} material={disc} scale={0.52} />
        <Halo color={pal.glow} kind="magic" size={2} base={0.7} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ dispatcher */
export function Model({ kind, biome, v, ghost }: { kind: ObjectKind; biome: Biome; v: number; ghost?: "ok" | "bad" }) {
  const pal = biome.palette;
  const r = useMemo(() => mulberry32(v * 9973 + kind.length * 31), [v, kind]);
  const ref = useRef<THREE.Group>(null);
  const node = useMemo(() => {
    switch (kind) {
      case "tree": return biome.treeStyle === "pine" ? <Pine pal={pal} r={r} snowy /> : biome.treeStyle === "palm" ? <Palm pal={pal} r={r} /> : biome.treeStyle === "candy" ? <CandyTree pal={pal} r={r} /> : <Oak pal={pal} r={r} />;
      case "pine": return <Pine pal={pal} r={r} snowy={biome.id === "snow"} />;
      case "bush": return <Bush pal={pal} r={r} />;
      case "flower": return <Flowers pal={pal} r={r} big={biome.id === "candy"} />;
      case "rock": return <Rock pal={pal} r={r} desert={biome.id === "desert"} />;
      case "mushroom": return <Mushrooms pal={pal} r={r} big={biome.id === "candy"} />;
      case "grass": return <GrassTuft pal={pal} r={r} />;
      case "hill": return <Hill pal={pal} r={r} />;
      case "pond": return <Pond pal={pal} r={r} frozen={!!pal.frozen} />;
      case "path": return <PathStones pal={pal} r={r} />;
      case "patch": return <Patch pal={pal} r={r} />;
      case "tile": return <Tile pal={pal} />;
      case "cottage": return <Cottage pal={pal} r={r} biome={biome.id} />;
      case "cabin": return <Cabin pal={pal} biome={biome.id} />;
      case "tower": return <Tower pal={pal} r={r} />;
      case "bridge": return <Bridge pal={pal} />;
      case "windmill": return <Windmill pal={pal} />;
      case "crystal": return <Crystals pal={pal} r={r} />;
      case "lantern": return <Lantern pal={pal} r={r} />;
      case "magictree": return <MagicTree pal={pal} r={r} />;
      case "stars": return <StarDust pal={pal} />;
      case "portal": return <Portal pal={pal} />;
    }
  }, [kind, biome, r]);
  useLayoutEffect(() => {
    if (!ghost || !ref.current) return;
    ref.current.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).material = ghost === "ok" ? ghostMat : ghostBadMat; (o as THREE.Mesh).castShadow = false; }
      if ((o as THREE.Sprite).isSprite || (o as THREE.Points).isPoints) o.visible = false;
    });
  });
  return <group ref={ref}>{node}</group>;
}

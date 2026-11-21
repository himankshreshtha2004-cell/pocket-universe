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


/* ------------------------------------------------------------------ more homes */
function RoundHut({ pal, r, biome }: { pal: Palette; r: () => number; biome: Biome["id"] }) {
  const thatch = biome === "snow" ? "#f7f9ff" : biome === "candy" ? "#f2b2d6" : pick(["#d9b26a", "#c99a55", "#e0bf7a"], r);
  const wall = pick([pal.wall, "#f1dcc0", "#e8cfa6"], r);
  return (
    <group>
      <M g={G.cyl12} m={std(pal.surface.stone)} p={[0, 0.03, 0]} s={[0.6, 0.06, 0.6]} />
      <M g={G.cyl12} m={std(wall)} p={[0, 0.33, 0]} s={[0.47, 0.56, 0.47]} />
      <M g={G.cone7} m={std(thatch)} p={[0, 0.88, 0]} s={[0.66, 0.56, 0.66]} />
      <M g={G.cone7} m={std(thatch)} p={[0, 1.2, 0]} s={[0.08, 0.14, 0.08]} />
      <M g={G.box} m={std(pal.wood)} p={[0, 0.22, 0.465]} s={[0.18, 0.34, 0.03]} />
      <M g={G.sphere} m={std("#ffd58a")} p={[0.05, 0.22, 0.485]} s={0.016} shadow={false} />
      <Window p={[0.34, 0.42, 0.33]} ry={Math.PI / 4} />
      <Window p={[-0.34, 0.42, 0.33]} ry={-Math.PI / 4} />
      <Window p={[0, 0.42, -0.47]} ry={Math.PI} />
      <M g={G.blob} m={std(pal.foliage[0])} p={[0.42, 0.1, 0.34]} s={0.13} />
      <M g={G.blob} m={std(pick(pal.flowers, r))} p={[0.42, 0.2, 0.37]} s={0.045} shadow={false} />
      <M g={G.blob} m={std(pal.foliage[1 % pal.foliage.length])} p={[-0.44, 0.09, 0.3]} s={0.11} />
    </group>
  );
}
function Manor({ pal, r, biome }: { pal: Palette; r: () => number; biome: Biome["id"] }) {
  const roof = biome === "snow" ? "#f7f9ff" : pick([pal.roof, "#6a7fb0", "#b0606a"], r);
  const wall = pick([pal.wall, "#f6e7d4", "#f2d5d0"], r);
  return (
    <group>
      <M g={G.box} m={std(pal.surface.stone)} p={[0, 0.04, 0]} s={[1.5, 0.08, 1.0]} />
      <M g={G.box} m={std(wall)} p={[0, 0.355, 0]} s={[1.36, 0.55, 0.86]} />
      <M g={G.box} m={std(pal.wood)} p={[0, 0.645, 0]} s={[1.42, 0.05, 0.92]} />
      <M g={G.box} m={std(wall)} p={[0, 0.92, 0]} s={[1.36, 0.5, 0.86]} />
      <M g={G.prism} m={std(roof)} p={[0, 1.37, 0]} s={[1.5, 0.42, 0.58]} />
      <M g={G.box} m={std(pal.rock[0])} p={[0.42, 1.5, -0.14]} s={[0.13, 0.36, 0.13]} />
      <M g={G.box} m={std(pal.rock[0])} p={[-0.42, 1.5, -0.14]} s={[0.13, 0.36, 0.13]} />
      <M g={G.box} m={std(pal.wood)} p={[0, 0.28, 0.435]} s={[0.28, 0.4, 0.02]} />
      <M g={G.prism} m={std(roof)} p={[0, 0.55, 0.5]} s={[0.42, 0.12, 0.14]} />
      <M g={G.box} m={std(pal.surface.stone)} p={[0, 0.06, 0.55]} s={[0.4, 0.06, 0.18]} />
      {[-0.42, 0.42].map((x) => <Window key={"g" + x} p={[x, 0.4, 0.435]} w={0.16} h={0.18} />)}
      {[-0.42, 0, 0.42].map((x) => <Window key={"u" + x} p={[x, 0.93, 0.435]} w={0.14} h={0.17} />)}
      {[-0.2, 0.2].map((z) => <Window key={"s" + z} p={[0.685, 0.93, z]} ry={Math.PI / 2} />)}
      {[-0.2, 0.2].map((z) => <Window key={"t" + z} p={[-0.685, 0.4, z]} ry={Math.PI / 2} />)}
      <M g={G.blob} m={std(pal.foliage[0])} p={[-0.62, 0.12, 0.5]} s={0.15} />
      <M g={G.blob} m={std(pal.foliage[0])} p={[0.62, 0.12, 0.5]} s={0.15} />
      <M g={G.blob} m={std(pick(pal.flowers, r))} p={[0.6, 0.24, 0.53]} s={0.05} shadow={false} />
      <M g={G.blob} m={std(pick(pal.flowers, r))} p={[-0.6, 0.24, 0.53]} s={0.05} shadow={false} />
    </group>
  );
}
function MushHouse({ pal, r }: { pal: Palette; r: () => number }) {
  const cap = pick(["#e0566a", "#e57aa8", "#9b7fe0", "#f28f5c"], r);
  const dots = useMemo(() => Array.from({ length: 11 }, (_, i) => {
    const th = i * 2.39 + 0.4, ph = 0.35 + (i % 4) * 0.3;
    return [Math.sin(ph) * Math.cos(th) * 0.62, 0.55 + Math.cos(ph) * 0.5, Math.sin(ph) * Math.sin(th) * 0.62] as V3;
  }), []);
  return (
    <group>
      <M g={G.cyl12} m={std("#f4ead8")} p={[0, 0.3, 0]} s={[0.32, 0.6, 0.32]} />
      <M g={G.cap} m={soft(cap)} p={[0, 0.55, 0]} s={[0.66, 0.52, 0.66]} />
      <mesh geometry={G.disc} material={std("#f3dcc8")} position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} scale={0.66} />
      {dots.map((d, i) => <M key={i} g={G.ball} m={soft("#fff7ea")} p={d} s={0.055} shadow={false} />)}
      <M g={G.box} m={std(pal.wood)} p={[0, 0.15, 0.31]} s={[0.15, 0.26, 0.03]} />
      <M g={G.sphere} m={std("#ffd58a")} p={[0.04, 0.15, 0.33]} s={0.014} shadow={false} />
      <Window p={[0.2, 0.36, 0.24]} w={0.09} h={0.09} ry={0.7} />
      <Window p={[-0.22, 0.32, 0.22]} w={0.08} h={0.08} ry={-0.78} />
      <group position={[0.2, 0.18, 0.36]}>
        <M g={G.ball} m={glow("#ffd58a", "magic", 0.8, true)} s={0.035} shadow={false} />
        <Halo color="#ffc77a" kind="magic" size={0.5} base={0.6} />
      </group>
      <M g={G.cyl6} m={std(pal.wood)} p={[0.2, 0.09, 0.36]} s={[0.01, 0.18, 0.01]} />
    </group>
  );
}
function TreeHouse({ pal, r }: { pal: Palette; r: () => number }) {
  const c1 = pick(pal.foliage, r), c2 = pick(pal.foliage, r);
  return (
    <group>
      <M g={G.trunk} m={std(pal.trunk)} p={[0, 0.6, 0]} s={[0.17, 1.2, 0.17]} />
      <Sway amt={0.02} seed={r() * 10}>
        <M g={G.puff} m={soft(c1)} p={[-0.18, 1.78, -0.22]} s={0.48} />
        <M g={G.puff} m={soft(c2)} p={[0.28, 1.68, -0.24]} s={0.36} />
        <M g={G.puff} m={soft(c1)} p={[0.02, 2.02, -0.02]} s={0.38} />
      </Sway>
      <M g={G.box} m={std(pal.wood)} p={[0, 0.92, 0]} s={[0.92, 0.06, 0.92]} />
      {[[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]].map(([x, z], i) => (
        <M key={i} g={G.box} m={std(pal.wood)} p={[x, 1.03, z]} s={[0.04, 0.16, 0.04]} />
      ))}
      <M g={G.box} m={std(pal.wood)} p={[0, 1.1, 0.42]} s={[0.88, 0.03, 0.03]} />
      <M g={G.box} m={std(pal.wall)} p={[0, 1.16, -0.08]} s={[0.54, 0.42, 0.46]} />
      <M g={G.prism} m={std(pal.roof)} p={[0, 1.48, -0.08]} s={[0.66, 0.24, 0.32]} />
      <M g={G.box} m={std(pal.wood)} p={[-0.1, 1.08, 0.155]} s={[0.13, 0.24, 0.02]} />
      <Window p={[0.14, 1.2, 0.155]} w={0.1} h={0.1} />
      {/* ladder */}
      <group position={[0.22, 0, 0.6]} rotation={[-0.22, 0, 0]}>
        <M g={G.cyl6} m={std(pal.wood)} p={[-0.08, 0.47, 0]} s={[0.015, 0.96, 0.015]} />
        <M g={G.cyl6} m={std(pal.wood)} p={[0.08, 0.47, 0]} s={[0.015, 0.96, 0.015]} />
        {[0.15, 0.33, 0.51, 0.69, 0.87].map((y) => <M key={y} g={G.box} m={std(pal.wood)} p={[0, y, 0]} s={[0.17, 0.02, 0.025]} />)}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ more magic */
function FairyLights({ pal, r }: { pal: Palette; r: () => number }) {
  const posts: V3[] = [[-0.8, 0, 0.12], [0, 0, -0.12], [0.8, 0, 0.12]];
  const H = 0.72;
  const colors = useMemo(() => {
    const sets = [["#fff3c4", "#ffd58a", "#fff3c4"], ["#f2b2d6", "#87dccf", "#ffd58a", "#a9c9f5", "#c7b2f2"], ["#ffd58a", "#f6a98a", "#f2b2d6"]];
    return pick(sets, r);
  }, [r]);
  const { tube, bulbs } = useMemo(() => {
    const pts: THREE.Vector3[] = [], bulbs: V3[] = [];
    for (let s = 0; s < posts.length - 1; s++) {
      const a = posts[s], b = posts[s + 1];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = H - Math.sin(Math.PI * t) * 0.2;
        if (!(s > 0 && k === 0)) pts.push(new THREE.Vector3(x, y, z));
        if (k > 0 && k < 10 && k % 1 === 0) bulbs.push([x, y - 0.035, z]);
      }
    }
    return { tube: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.006, 4, false), bulbs };
  }, []);
  return (
    <group>
      {posts.map((p, i) => (
        <group key={i} position={p}>
          <M g={G.cyl6} m={std(pal.wood)} p={[0, H / 2, 0]} s={[0.025, H + 0.04, 0.025]} />
          <M g={G.sphere} m={std(pal.wood)} p={[0, H + 0.03, 0]} s={0.035} />
        </group>
      ))}
      <mesh geometry={tube} material={std("#3b3550")} />
      {bulbs.map((b, i) => {
        const c = colors[i % colors.length];
        return (
          <group key={i} position={b}>
            <M g={G.ball} m={glow(c, "magic", 1.2, true)} s={[0.026, 0.034, 0.026]} shadow={false} />
            <Halo color={c} kind="magic" size={0.28} base={0.9} />
          </group>
        );
      })}
    </group>
  );
}
const wingMat = new THREE.MeshBasicMaterial({ color: "#dff4ff", transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
function Fairy({ r }: { r: () => number }) {
  const dress = pick(["#f2b2d6", "#c7b2f2", "#87dccf", "#ffd58a", "#a9c9f5"], r), hair = pick(["#ffd58a", "#f6a98a", "#3b2a24", "#c7b2f2"], r);
  const orbit = useRef<THREE.Group>(null), wl = useRef<THREE.Group>(null), wr = useRef<THREE.Group>(null);
  const seed = useMemo(() => r() * 10, [r]);
  useFrame(() => {
    if (FX.reduced) return;
    const t = FX.time;
    if (orbit.current) { orbit.current.rotation.y = t * 0.5 + seed; }
    const f = Math.sin(t * 18 + seed) * 0.55;
    if (wl.current) wl.current.rotation.y = 0.35 + f;
    if (wr.current) wr.current.rotation.y = -0.35 - f;
  });
  return (
    <Bob amt={0.1} speed={1.4} seed={seed}>
      <group ref={orbit}>
        <group position={[0.18, 0, 0]} rotation={[0, 0, 0]}>
          <M g={G.cone7} m={soft(dress)} p={[0, -0.02, 0]} s={[0.07, 0.15, 0.07]} />
          <M g={G.ball} m={soft("#f6d2b8")} p={[0, 0.1, 0]} s={0.055} />
          <M g={G.cap} m={soft(hair)} p={[0, 0.11, -0.005]} s={[0.06, 0.055, 0.06]} />
          <M g={G.ball} m={soft(hair)} p={[0, 0.07, -0.03]} s={[0.05, 0.06, 0.035]} />
          <M g={G.sphere} m={std("#2a2238")} p={[0.022, 0.105, 0.048]} s={0.008} shadow={false} />
          <M g={G.sphere} m={std("#2a2238")} p={[-0.022, 0.105, 0.048]} s={0.008} shadow={false} />
          <M g={G.octa} m={glow("#fff3c4", "magic", 1)} p={[0, 0.17, 0]} s={0.018} shadow={false} />
          <group ref={wl} position={[0, 0.03, -0.03]}>
            <mesh geometry={G.ball} material={wingMat} position={[-0.07, 0.04, -0.02]} scale={[0.075, 0.1, 0.008]} rotation={[0, 0, 0.5]} />
            <mesh geometry={G.ball} material={wingMat} position={[-0.055, -0.04, -0.02]} scale={[0.05, 0.06, 0.008]} rotation={[0, 0, -0.5]} />
          </group>
          <group ref={wr} position={[0, 0.03, -0.03]}>
            <mesh geometry={G.ball} material={wingMat} position={[0.07, 0.04, -0.02]} scale={[0.075, 0.1, 0.008]} rotation={[0, 0, -0.5]} />
            <mesh geometry={G.ball} material={wingMat} position={[0.055, -0.04, -0.02]} scale={[0.05, 0.06, 0.008]} rotation={[0, 0, 0.5]} />
          </group>
          <Halo color={dress} kind="magic" size={0.7} base={0.7} />
        </group>
      </group>
      <Sparkles count={14} radius={0.35} y={0} color="#fff3c4" />
    </Bob>
  );
}
const GLITTER = ["#f2b2d6", "#87dccf", "#ffd58a", "#a9c9f5", "#c7b2f2", "#ffffff", "#f6a98a"];
function Glitter({ r }: { r: () => number }) {
  const ref = useRef<THREE.Points>(null);
  const count = 80;
  const { geo, base, phase } = useMemo(() => {
    const g = new THREE.BufferGeometry(), a = new Float32Array(count * 3), col = new Float32Array(count * 3), base = new Float32Array(count * 3), phase = new Float32Array(count * 2);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const t = r() * Math.PI * 2, u = r() * 2 - 1, d = Math.cbrt(r()) * 0.5, s = Math.sqrt(1 - u * u);
      a[i * 3] = Math.cos(t) * s * d; a[i * 3 + 1] = u * d * 0.8; a[i * 3 + 2] = Math.sin(t) * s * d;
      c.set(GLITTER[i % GLITTER.length]); base[i * 3] = c.r; base[i * 3 + 1] = c.g; base[i * 3 + 2] = c.b;
      phase[i * 2] = r() * Math.PI * 2; phase[i * 2 + 1] = 2 + r() * 5;
    }
    col.set(base);
    g.setAttribute("position", new THREE.BufferAttribute(a, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return { geo: g, base, phase };
  }, [r]);
  const mat = useMemo(() => new THREE.PointsMaterial({ map: glowTexture(), vertexColors: true, size: 0.1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  useFrame((_, dt) => {
    if (!ref.current || FX.reduced) return;
    ref.current.rotation.y += dt * 0.25;
    const col = geo.attributes.color.array as Float32Array, t = FX.time;
    for (let i = 0; i < count; i++) {
      const k = 0.25 + 0.75 * Math.max(0, Math.sin(t * phase[i * 2 + 1] + phase[i * 2]));
      col[i * 3] = base[i * 3] * k; col[i * 3 + 1] = base[i * 3 + 1] * k; col[i * 3 + 2] = base[i * 3 + 2] * k;
    }
    geo.attributes.color.needsUpdate = true;
  });
  return (
    <group>
      <points ref={ref} geometry={geo} material={mat} />
      <Spin speed={0.8}>
        {[0, 1, 2, 3].map((i) => <M key={i} g={G.octa} m={glow(GLITTER[i * 2], "magic", 1)} p={[Math.cos(i * 1.57) * 0.22, Math.sin(i * 2.1) * 0.12, Math.sin(i * 1.57) * 0.22]} s={0.035} shadow={false} />)}
      </Spin>
      <Halo color="#fff7ea" kind="magic" size={1.2} base={0.5} />
    </group>
  );
}
function HangingGarden({ pal, r }: { pal: Palette; r: () => number }) {
  const stone = pick(["#e3c99a", "#d9b98a", pal.surface.stone], r);
  const tiers = [{ w: 1.3, y: 0 }, { w: 0.95, y: 0.3 }, { w: 0.62, y: 0.6 }];
  const TH = 0.3;
  const { bushes, vines } = useMemo(() => {
    const bushes: { p: V3; s: number; c: string }[] = [], vines: { p: V3; len: number; c: string; f: string }[] = [];
    tiers.forEach((t, ti) => {
      const h = t.w / 2, top = t.y + TH, per = ti === 0 ? 3 : 2;
      for (let side = 0; side < 4; side++) {
        for (let k = 0; k < per + 1; k++) {
          const u = -h + 0.08 + ((2 * h - 0.16) * k) / per;
          const [x, z] = side === 0 ? [u, h - 0.06] : side === 1 ? [h - 0.06, -u] : side === 2 ? [-u, -h + 0.06] : [-h + 0.06, u];
          bushes.push({ p: [x, top + 0.03, z], s: 0.09 + r() * 0.04, c: pick(pal.foliage, r) });
        }
        for (let k = 0; k < per; k++) {
          const u = -h + ((2 * h) * (k + 0.5)) / per + (r() - 0.5) * 0.08;
          const o = h + 0.012;
          const [x, z] = side === 0 ? [u, o] : side === 1 ? [o, -u] : side === 2 ? [-u, -o] : [-o, u];
          vines.push({ p: [x, top, z], len: 0.16 + r() * 0.16 + (ti === 0 ? 0.02 : 0), c: pick(pal.foliage, r), f: pick(pal.flowers, r) });
        }
      }
    });
    return { bushes, vines };
  }, [r]);
  const strands = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + r() * 0.2, d = 0.34 + r() * 0.08;
    return { p: [Math.cos(a) * d, 1.58, Math.sin(a) * d] as V3, len: 0.42 + r() * 0.2, f: pick(pal.flowers, r) };
  }), [r]);
  const leaf = pick(pal.foliage, r);
  return (
    <group>
      {tiers.map((t, i) => (
        <group key={i}>
          <M g={G.box} m={std(stone)} p={[0, t.y + TH / 2, 0]} s={[t.w, TH, t.w]} />
          <M g={G.box} m={std(pal.surface.soil)} p={[0, t.y + TH + 0.005, 0]} s={[t.w - 0.06, 0.02, t.w - 0.06]} />
        </group>
      ))}
      {bushes.map((b, i) => <M key={i} g={G.puff} m={soft(b.c)} p={b.p} s={b.s} />)}
      {vines.map((v, i) => (
        <group key={i} position={v.p}>
          <M g={G.cyl6} m={std(v.c)} p={[0, -v.len / 2, 0]} s={[0.014, v.len, 0.014]} shadow={false} />
          <M g={G.blob} m={soft(v.c)} p={[0, -v.len * 0.45, 0.01]} s={0.03} shadow={false} />
          <M g={G.blob} m={soft(v.f)} p={[0, -v.len, 0.005]} s={0.03} shadow={false} />
        </group>
      ))}
      {/* weeping tree on the top terrace */}
      <M g={G.trunk} m={std(pal.trunk)} p={[0, 1.18, 0]} s={[0.07, 0.6, 0.07]} />
      <Sway amt={0.03} seed={r() * 10}>
        <M g={G.puff} m={soft(leaf)} p={[0, 1.62, 0]} s={[0.46, 0.26, 0.46]} />
        <M g={G.puff} m={soft(pick(pal.foliage, r))} p={[0.1, 1.8, 0.05]} s={0.24} />
        {strands.map((s, i) => (
          <group key={i} position={s.p}>
            <M g={G.cyl6} m={std(leaf)} p={[0, -s.len / 2, 0]} s={[0.016, s.len, 0.016]} shadow={false} />
            <M g={G.blob} m={soft(s.f)} p={[0, -s.len * 0.5, 0]} s={0.028} shadow={false} />
            <M g={G.blob} m={soft(s.f)} p={[0, -s.len, 0]} s={0.034} shadow={false} />
          </group>
        ))}
      </Sway>
    </group>
  );
}

/* ------------------------------------------------------------------ friends */
const SKIN = ["#f6d2b8", "#eec0a0", "#d9a07a", "#b77a55", "#8d5a3f"];
const HAIR = ["#3b2a24", "#5a3a2c", "#d8a25a", "#1f1a2e", "#b4553a", "#7a5236"];
const CLOTHES = ["#f2b2d6", "#87dccf", "#a9c9f5", "#ffd58a", "#c7b2f2", "#f6a98a", "#9fd39a"];
function Face({ y, z }: { y: number; z: number }) {
  return (
    <group>
      <M g={G.sphere} m={std("#2a2238")} p={[0.04, y, z]} s={[0.016, 0.02, 0.012]} shadow={false} />
      <M g={G.sphere} m={std("#2a2238")} p={[-0.04, y, z]} s={[0.016, 0.02, 0.012]} shadow={false} />
      <M g={G.sphere} m={std("#ffffff")} p={[0.044, y + 0.007, z + 0.008]} s={0.005} shadow={false} />
      <M g={G.sphere} m={std("#ffffff")} p={[-0.036, y + 0.007, z + 0.008]} s={0.005} shadow={false} />
      <M g={G.sphere} m={soft("#f59ab0")} p={[0.068, y - 0.03, z - 0.012]} s={[0.022, 0.014, 0.008]} shadow={false} />
      <M g={G.sphere} m={soft("#f59ab0")} p={[-0.068, y - 0.03, z - 0.012]} s={[0.022, 0.014, 0.008]} shadow={false} />
      <M g={G.torus} m={std("#a0485a")} p={[0, y - 0.036, z - 0.004]} s={[0.014, 0.012, 0.012]} r={[0, 0, Math.PI]} shadow={false} />
    </group>
  );
}
function Breathe({ children, seed }: { children: React.ReactNode; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current || FX.reduced) return;
    const t = FX.time * 2.2 + seed;
    ref.current.scale.y = 1 + Math.sin(t) * 0.018;
    ref.current.rotation.z = Math.sin(t * 0.5) * 0.04;
  });
  return <group ref={ref}>{children}</group>;
}
function Person({ r, female }: { r: () => number; female: boolean }) {
  const skin = pick(SKIN, r), hair = pick(HAIR, r), top = pick(CLOTHES, r), bottom = female ? top : pick(["#4a5a8a", "#5a4a6a", "#6b5a4a", "#3e6a7a"], r);
  const seed = useMemo(() => r() * 10, [r]);
  const HY = female ? 0.47 : 0.48;
  return (
    <Breathe seed={seed}>
      {/* legs + shoes */}
      {[-0.04, 0.04].map((x) => (
        <group key={x}>
          <M g={G.cyl8} m={std(female ? skin : bottom)} p={[x, 0.08, 0]} s={[0.026, 0.14, 0.026]} />
          <M g={G.ball} m={std(pick(["#5a3a2c", "#f2b2d6", "#3b3550"], r))} p={[x, 0.015, 0.012]} s={[0.032, 0.022, 0.045]} />
        </group>
      ))}
      {female ? (
        <M g={G.cone7} m={soft(top)} p={[0, 0.24, 0]} s={[0.13, 0.24, 0.13]} />
      ) : (
        <>
          <M g={G.cyl8} m={std(bottom)} p={[0, 0.17, 0]} s={[0.075, 0.06, 0.06]} />
          <M g={G.cyl8} m={soft(top)} p={[0, 0.26, 0]} s={[0.085, 0.15, 0.07]} />
        </>
      )}
      {/* arms */}
      {[1, -1].map((sd) => (
        <group key={sd} position={[sd * (female ? 0.065 : 0.09), 0.32, 0]} rotation={[0, 0, sd * 0.35]}>
          <M g={G.cyl8} m={soft(top)} p={[0, -0.04, 0]} s={[0.022, 0.09, 0.022]} />
          <M g={G.ball} m={soft(skin)} p={[0, -0.1, 0]} s={0.025} />
        </group>
      ))}
      <M g={G.cyl8} m={soft(skin)} p={[0, 0.355, 0]} s={[0.03, 0.04, 0.03]} />
      {/* head */}
      <M g={G.ball} m={soft(skin)} p={[0, HY, 0]} s={0.12} />
      <M g={G.cap} m={soft(hair)} p={[0, HY + 0.01, -0.012]} s={[0.128, 0.125, 0.128]} r={[-0.25, 0, 0]} />
      {female ? (
        <>
          <M g={G.ball} m={soft(hair)} p={[0, HY - 0.04, -0.05]} s={[0.125, 0.14, 0.085]} />
          <group position={[0.07, HY + 0.1, 0.02]} rotation={[0, 0, -0.4]}>
            <M g={G.octa} m={soft(pick(["#f28fb0", "#ffd58a", "#87dccf", "#ffffff"], r))} p={[0.025, 0, 0]} s={[0.03, 0.022, 0.012]} />
            <M g={G.octa} m={soft("#f28fb0")} p={[-0.025, 0, 0]} s={[0.03, 0.022, 0.012]} />
          </group>
        </>
      ) : (
        <M g={G.ball} m={soft(hair)} p={[0, HY + 0.07, 0.03]} s={[0.1, 0.045, 0.08]} />
      )}
      <Face y={HY - 0.005} z={0.112} />
    </Breathe>
  );
}
function Dog({ r }: { r: () => number }) {
  const coat = pick(["#e0a85a", "#8a5a3c", "#f4efe6", "#3a3340", "#d9c2a0"], r);
  const ear = coat === "#f4efe6" ? "#c9a27a" : coat === "#3a3340" ? "#2a2430" : new THREE.Color(coat).multiplyScalar(0.78).getStyle();
  const tail = useRef<THREE.Group>(null), head = useRef<THREE.Group>(null);
  const seed = useMemo(() => r() * 10, [r]);
  useFrame(() => {
    if (FX.reduced) return;
    const t = FX.time;
    if (tail.current) tail.current.rotation.y = Math.sin(t * 12 + seed) * 0.6;
    if (head.current) head.current.rotation.z = Math.sin(t * 0.9 + seed) * 0.12;
  });
  return (
    <group>
      {[[-0.05, 0.08], [0.05, 0.08], [-0.05, -0.08], [0.05, -0.08]].map(([x, z], i) => (
        <group key={i}>
          <M g={G.cyl8} m={soft(coat)} p={[x, 0.05, z]} s={[0.024, 0.1, 0.024]} />
          <M g={G.ball} m={soft(i < 2 && coat !== "#f4efe6" ? "#f4efe6" : coat)} p={[x, 0.012, z + 0.008]} s={[0.026, 0.016, 0.03]} />
        </group>
      ))}
      <M g={G.ball} m={soft(coat)} p={[0, 0.14, 0]} s={[0.085, 0.075, 0.13]} />
      {coat === "#f4efe6" && <M g={G.ball} m={soft("#c9a27a")} p={[0.04, 0.18, -0.03]} s={[0.05, 0.04, 0.05]} />}
      <group ref={tail} position={[0, 0.17, -0.12]}>
        <M g={G.cyl8} m={soft(coat)} p={[0, 0.04, -0.03]} s={[0.016, 0.1, 0.016]} r={[-0.7, 0, 0]} />
      </group>
      <group ref={head} position={[0, 0.24, 0.12]}>
        <M g={G.ball} m={soft(coat)} s={0.08} />
        <M g={G.ball} m={soft(coat === "#3a3340" ? "#4a4250" : "#f4efe6")} p={[0, -0.02, 0.065]} s={[0.042, 0.034, 0.042]} />
        <M g={G.ball} m={std("#2a2238")} p={[0, -0.005, 0.105]} s={[0.016, 0.012, 0.012]} shadow={false} />
        <M g={G.sphere} m={std("#2a2238")} p={[0.032, 0.02, 0.07]} s={0.012} shadow={false} />
        <M g={G.sphere} m={std("#2a2238")} p={[-0.032, 0.02, 0.07]} s={0.012} shadow={false} />
        <M g={G.sphere} m={std("#ffffff")} p={[0.035, 0.025, 0.08]} s={0.004} shadow={false} />
        <M g={G.sphere} m={std("#ffffff")} p={[-0.029, 0.025, 0.08]} s={0.004} shadow={false} />
        <M g={G.ball} m={soft("#f28fa0")} p={[0, -0.045, 0.085]} s={[0.012, 0.006, 0.014]} shadow={false} />
        <M g={G.ball} m={soft(ear)} p={[0.07, -0.005, -0.005]} s={[0.022, 0.06, 0.04]} r={[0, 0, 0.35]} />
        <M g={G.ball} m={soft(ear)} p={[-0.07, -0.005, -0.005]} s={[0.022, 0.06, 0.04]} r={[0, 0, -0.35]} />
      </group>
    </group>
  );
}
function Gnome({ r }: { r: () => number }) {
  const hat = pick(["#d94a4a", "#d94a4a", "#4a7ad9", "#9b5fd0"], r), coat = pick(["#3f6fb0", "#4a9a6a", "#b0603f"], r);
  return (
    <group rotation={[0, 0, 0]}>
      <M g={G.ball} m={std("#4a3a2c")} p={[0.035, 0.02, 0.01]} s={[0.032, 0.022, 0.045]} />
      <M g={G.ball} m={std("#4a3a2c")} p={[-0.035, 0.02, 0.01]} s={[0.032, 0.022, 0.045]} />
      <M g={G.cyl8} m={soft(coat)} p={[0, 0.12, 0]} s={[0.085, 0.18, 0.08]} />
      <M g={G.cyl8} m={std("#3b2a24")} p={[0, 0.1, 0]} s={[0.088, 0.025, 0.083]} />
      <M g={G.box} m={std("#ffd58a")} p={[0, 0.1, 0.082]} s={[0.025, 0.02, 0.006]} />
      {[1, -1].map((sd) => (
        <group key={sd} position={[sd * 0.09, 0.19, 0]} rotation={[0, 0, sd * 0.5]}>
          <M g={G.cyl8} m={soft(coat)} p={[0, -0.03, 0]} s={[0.022, 0.07, 0.022]} />
          <M g={G.ball} m={soft("#f6d2b8")} p={[0, -0.075, 0]} s={0.022} />
        </group>
      ))}
      <M g={G.ball} m={soft("#f6d2b8")} p={[0, 0.28, 0]} s={0.075} />
      <M g={G.puff} m={soft("#f7f4ee")} p={[0, 0.23, 0.04]} s={[0.075, 0.085, 0.05]} />
      <M g={G.ball} m={soft("#f2a08a")} p={[0, 0.27, 0.075]} s={0.024} />
      <M g={G.sphere} m={std("#2a2238")} p={[0.026, 0.3, 0.066]} s={0.009} shadow={false} />
      <M g={G.sphere} m={std("#2a2238")} p={[-0.026, 0.3, 0.066]} s={0.009} shadow={false} />
      <M g={G.cyl8} m={soft(hat)} p={[0, 0.32, 0]} s={[0.08, 0.025, 0.08]} />
      <M g={G.cone7} m={soft(hat)} p={[0.008, 0.43, -0.01]} s={[0.078, 0.22, 0.078]} r={[-0.12, 0, -0.08]} />
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
      case "roundhut": return <RoundHut pal={pal} r={r} biome={biome.id} />;
      case "manor": return <Manor pal={pal} r={r} biome={biome.id} />;
      case "mushhouse": return <MushHouse pal={pal} r={r} />;
      case "treehouse": return <TreeHouse pal={pal} r={r} />;
      case "fairylights": return <FairyLights pal={pal} r={r} />;
      case "fairy": return <Fairy r={r} />;
      case "glitter": return <Glitter r={r} />;
      case "hangingtree": return <HangingGarden pal={pal} r={r} />;
      case "man": return <Person r={r} female={false} />;
      case "woman": return <Person r={r} female />;
      case "dog": return <Dog r={r} />;
      case "gnome": return <Gnome r={r} />;
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

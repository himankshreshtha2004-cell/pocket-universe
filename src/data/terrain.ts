import { BIOMES } from "./biomes";
import { ITEMS } from "./catalog";
import { clamp, fbm, mulberry32, smooth, uid, valueNoise } from "./rng";
import { SURFACES, type BiomeId, type ObjectKind, type Placed, type Surface, type Terrain, type WorldSize } from "./types";

export const SIZE_N: Record<WorldSize, number> = { small: 33, medium: 41, large: 53 };
export const SIZE_LABEL: Record<WorldSize, string> = { small: "Small", medium: "Medium", large: "Large" };
const CELL = 0.5;
export const H_MIN = -1.4, H_MAX = 4.2;

export const surfIndex = (s: Surface) => SURFACES.indexOf(s);

/** rim radius at an angle (organic coastline) */
export function rimAt(t: Terrain, ang: number) {
  const k = t.edge.length;
  const f = ((ang / (Math.PI * 2)) % 1 + 1) % 1 * k;
  const i = Math.floor(f), u = f - i;
  return t.radius * (t.edge[i % k] * (1 - u) + t.edge[(i + 1) % k] * u);
}
export function insideIsland(t: Terrain, x: number, z: number, margin = 0) {
  const d = Math.hypot(x, z);
  return d < rimAt(t, Math.atan2(z, x)) - margin;
}
/** 0 at the rim -> 1 inland: keeps the coastline at y≈0 so the island stays a clean diorama */
export function rimFalloff(t: Terrain, x: number, z: number) {
  const d = Math.hypot(x, z), R = rimAt(t, Math.atan2(z, x));
  return smooth(R, R * 0.72, d);
}

export const vx = (t: Terrain, i: number) => (i - (t.n - 1) / 2) * t.cell;

export function heightAt(t: Terrain, x: number, z: number) {
  const n = t.n, half = (n - 1) / 2;
  const fx = clamp(x / t.cell + half, 0, n - 1.0001), fz = clamp(z / t.cell + half, 0, n - 1.0001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const h = t.heights;
  const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
export function surfaceAt(t: Terrain, x: number, z: number): Surface {
  const m = t.n - 1, half = (t.n - 1) / 2;
  const i = clamp(Math.floor(x / t.cell + half), 0, m - 1), j = clamp(Math.floor(z / t.cell + half), 0, m - 1);
  return SURFACES[t.surface[j * m + i]] ?? "grass";
}
export function slopeAt(t: Terrain, x: number, z: number) {
  const e = t.cell * 0.6;
  return Math.hypot(heightAt(t, x + e, z) - heightAt(t, x - e, z), heightAt(t, x, z + e) - heightAt(t, x, z - e)) / (2 * e);
}

export function bandSurface(biome: BiomeId, h: number, water: number): Surface {
  const bands = BIOMES[biome].bands;
  for (const b of bands) if (h - water < b.max) return b.s;
  return bands[bands.length - 1].s;
}

export function generateTerrain(biome: BiomeId, size: WorldSize, seed: number, blank = false): Terrain {
  const B = BIOMES[biome], g = B.gen, n = SIZE_N[size];
  const radius = ((n - 1) / 2) * CELL * 0.94;
  const rng = mulberry32(seed * 7 + 3);
  const edge = Array.from({ length: 64 }, (_, k) => 0.9 + 0.1 * valueNoise(k * 0.35, 1.7, seed + 11) + 0.02 * Math.sin(k * 0.9 + seed));
  const t: Terrain = { n, cell: CELL, radius, water: g.water, heights: new Array(n * n).fill(0), surface: new Array((n - 1) * (n - 1)).fill(0), edge };
  // a peak or two for snowy worlds, a central rise for every world
  const peaks = Array.from({ length: g.peaks ?? 0 }, () => {
    const a = rng() * Math.PI * 2, r = radius * (0.3 + rng() * 0.25);
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: 2.2 + rng() * 0.8, w: radius * 0.32 };
  });
  if (blank) {
    // an empty field: flat, gently rounded land a little above the water, all one surface
    const flat = Math.max(g.water + 0.3, 0.3);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = vx(t, i), z = vx(t, j), f = rimFalloff(t, x, z);
      const h = flat + 0.05 * (fbm(x * 0.2 + 50, z * 0.2 + 50, seed, 2) - 0.5);
      t.heights[j * n + i] = h * f + 0.02 * (1 - f);
    }
    const m = n - 1;
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const x = vx(t, i) + t.cell / 2, z = vx(t, j) + t.cell / 2;
      t.surface[j * m + i] = surfIndex(bandSurface(biome, heightAt(t, x, z), t.water));
    }
    return t;
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = vx(t, i), z = vx(t, j);
    let h = g.base + g.amp * (fbm(x * g.freq + 50, z * g.freq + 50, seed, 4) - 0.5) * 2;
    if (g.ridge) h += 0.38 * Math.sin(x * 0.55 + z * 0.25 + fbm(x * 0.1, z * 0.1, seed + 5) * 6);
    const d = Math.hypot(x, z);
    h += (biome === "ocean" ? 1.0 : 0.35) * Math.exp(-(d * d) / Math.pow(radius * 0.38, 2));
    for (const p of peaks) h += p.h * Math.exp(-((x - p.x) ** 2 + (z - p.z) ** 2) / (p.w * p.w));
    const f = rimFalloff(t, x, z);
    h = h * f + 0.02 * (1 - f);
    t.heights[j * n + i] = clamp(h, H_MIN, H_MAX);
  }
  recomputeSurfaces(t, biome, seed, true);
  return t;
}

/** assign surfaces from height bands (used at generation) with a little meadow/stone variety */
function recomputeSurfaces(t: Terrain, biome: BiomeId, seed: number, all: boolean) {
  const m = t.n - 1;
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
    const x = vx(t, i) + t.cell / 2, z = vx(t, j) + t.cell / 2;
    const h = heightAt(t, x, z);
    let s = bandSurface(biome, h, t.water);
    const nz = valueNoise(x * 0.45 + 9, z * 0.45 + 9, seed + 77);
    if (s === "grass" && nz > 0.72) s = "meadow";
    if (biome === "candy" && s === "grass" && nz < 0.2) s = "bloom";
    if (s === "grass" && slopeAt(t, x, z) > 1.1) s = "stone";
    if (all) t.surface[j * m + i] = surfIndex(s);
  }
}

export type BrushMode = "raise" | "lower" | "smooth";
/** returns a new heights array with a soft brush applied around (x,z) */
export function sculpt(t: Terrain, x: number, z: number, radius: number, mode: BrushMode, strength: number): number[] {
  const n = t.n, out = t.heights.slice();
  const r2 = radius * radius;
  const i0 = Math.max(0, Math.floor((x - radius) / t.cell + (n - 1) / 2)), i1 = Math.min(n - 1, Math.ceil((x + radius) / t.cell + (n - 1) / 2));
  const j0 = Math.max(0, Math.floor((z - radius) / t.cell + (n - 1) / 2)), j1 = Math.min(n - 1, Math.ceil((z + radius) / t.cell + (n - 1) / 2));
  let avg = 0, cnt = 0;
  if (mode === "smooth") for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { avg += t.heights[j * n + i]; cnt++; }
  avg /= Math.max(1, cnt);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const px = vx(t, i), pz = vx(t, j), d2 = (px - x) ** 2 + (pz - z) ** 2;
    if (d2 > r2) continue;
    const w = Math.pow(1 - d2 / r2, 1.6) * rimFalloff(t, px, pz);
    const k = j * n + i;
    if (mode === "raise") out[k] += strength * w;
    else if (mode === "lower") out[k] -= strength * w;
    else out[k] += (avg - out[k]) * Math.min(1, strength * 2.2 * w);
    out[k] = clamp(out[k], H_MIN, H_MAX);
  }
  return out;
}
/** dig the ground down below the water line so water fills it: rivers, streams and lakes */
export function carveRiver(t: Terrain, x: number, z: number, radius: number): number[] {
  const n = t.n, out = t.heights.slice(), r2 = radius * radius, bed = t.water - 0.32;
  const i0 = Math.max(0, Math.floor((x - radius) / t.cell + (n - 1) / 2)), i1 = Math.min(n - 1, Math.ceil((x + radius) / t.cell + (n - 1) / 2));
  const j0 = Math.max(0, Math.floor((z - radius) / t.cell + (n - 1) / 2)), j1 = Math.min(n - 1, Math.ceil((z + radius) / t.cell + (n - 1) / 2));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const px = vx(t, i), pz = vx(t, j), d2 = (px - x) ** 2 + (pz - z) ** 2;
    if (d2 > r2) continue;
    const w = Math.pow(1 - d2 / r2, 0.9);
    const k = j * n + i;
    // the middle sinks to the river bed, the edges ease into soft banks
    const target = bed + (1 - w) * 0.45;
    if (out[k] > target) out[k] += (target - out[k]) * Math.min(1, 0.55 * w + 0.15);
    out[k] = clamp(out[k], H_MIN, H_MAX);
  }
  return out;
}
export function paint(t: Terrain, x: number, z: number, radius: number, s: Surface): number[] {
  const m = t.n - 1, out = t.surface.slice(), idx = surfIndex(s);
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
    const cx = vx(t, i) + t.cell / 2, cz = vx(t, j) + t.cell / 2;
    if ((cx - x) ** 2 + (cz - z) ** 2 <= radius * radius) out[j * m + i] = idx;
  }
  return out;
}

/** can this kind of object stand at (x,z)? */
export function canPlace(t: Terrain, kind: ObjectKind, x: number, z: number) {
  if (!insideIsland(t, x, z, 0.25)) return false;
  const item = ITEMS[kind];
  if (!item.water && heightAt(t, x, z) < t.water - 0.02) return false;
  return true;
}
/** y of an object's base */
export function groundY(t: Terrain, kind: ObjectKind, x: number, z: number) {
  const h = heightAt(t, x, z);
  return ITEMS[kind].water ? Math.max(h, t.water) : h;
}

const STRUCT = new Set<ObjectKind>(["cottage", "cabin", "tower", "windmill", "portal"]);
export function generateStarters(t: Terrain, biome: BiomeId, size: WorldSize, seed: number): Placed[] {
  const B = BIOMES[biome], rng = mulberry32(seed * 13 + 1);
  const total = { small: 24, medium: 34, large: 48 }[size];
  const bag: ObjectKind[] = [];
  const wsum = B.starters.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of B.starters) for (let c = 0; c < Math.max(k === "cottage" || k === "cabin" || k === "tower" || k === "portal" ? w : 1, Math.round((w / wsum) * total)); c++) bag.push(k);
  const out: Placed[] = [];
  // structures first so they get good spots
  bag.sort((a, b) => (STRUCT.has(b) ? 1 : 0) - (STRUCT.has(a) ? 1 : 0));
  for (const kind of bag) {
    const item = ITEMS[kind];
    for (let tries = 0; tries < 60; tries++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * t.radius * 0.86;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!canPlace(t, kind, x, z) || heightAt(t, x, z) < t.water + 0.08) continue;
      if (STRUCT.has(kind) && slopeAt(t, x, z) > 0.55) continue;
      if (out.some((o) => Math.hypot(o.p[0] - x, o.p[2] - z) < (ITEMS[o.kind].r + item.r) * 0.85)) continue;
      const s = STRUCT.has(kind) ? 1 : 0.75 + rng() * 0.6;
      out.push({ id: uid(), kind, p: [x, item.lift ?? 0, z], r: rng() * Math.PI * 2, s, v: Math.floor(rng() * 1000) });
      break;
    }
  }
  return out;
}

// Builds the 10 showcase universes that load on a visitor's first visit (public/showcase.json).
// Run: npx esbuild scripts/showcase.ts --bundle --platform=node --outfile=/tmp/showcase.cjs && node /tmp/showcase.cjs
import { writeFileSync } from "node:fs";
import { ITEMS } from "../src/data/catalog";
import { mulberry32 } from "../src/data/rng";
import { canPlace, generateTerrain, heightAt, insideIsland, paint, sculpt, slopeAt, surfaceAt } from "../src/data/terrain";
import { SCHEMA_VERSION, type BiomeId, type Env, type ObjectKind, type Placed, type Surface, type World, type WorldSize } from "../src/data/types";

let idn = 0;
const id = (p: string) => `${p}-${(++idn).toString(36).padStart(3, "0")}`;
const STRUCT = new Set<ObjectKind>(["cottage", "cabin", "tower", "windmill", "portal", "bridge"]);

class Builder {
  w: World; r: () => number; R: number;
  constructor(public key: string, name: string, biome: BiomeId, size: WorldSize, seed: number, env: Env, created: string, updated: string) {
    const terrain = generateTerrain(biome, size, seed);
    this.w = { id: "showcase-" + key, version: SCHEMA_VERSION, name, biome, seed, size, env, terrain, objects: [], createdAt: Date.parse(created), updatedAt: Date.parse(updated) };
    this.r = mulberry32(seed * 3 + 17); this.R = terrain.radius;
  }
  get t() { return this.w.terrain; }
  /** coordinates in fractions of the island radius */
  X(f: number) { return f * this.R; }
  raise(fx: number, fz: number, fr: number, amt: number) { for (let i = 0; i < Math.ceil(amt / 0.09); i++) this.t.heights = sculpt(this.t, this.X(fx), this.X(fz), this.X(fr), "raise", 0.09); return this; }
  lower(fx: number, fz: number, fr: number, amt: number) { for (let i = 0; i < Math.ceil(amt / 0.09); i++) this.t.heights = sculpt(this.t, this.X(fx), this.X(fz), this.X(fr), "lower", 0.09); return this; }
  flat(fx: number, fz: number, fr: number, n = 8) { for (let i = 0; i < n; i++) this.t.heights = sculpt(this.t, this.X(fx), this.X(fz), this.X(fr), "smooth", 0.3); return this; }
  disc(fx: number, fz: number, fr: number, s: Surface) { this.t.surface = paint(this.t, this.X(fx), this.X(fz), this.X(fr), s); return this; }
  line(pts: [number, number][], width: number, s: Surface) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      const L = Math.hypot(bx - ax, bz - az) * this.R, n = Math.max(2, Math.ceil(L / 0.25));
      for (let i = 0; i <= n; i++) { const u = i / n; this.t.surface = paint(this.t, this.X(ax + (bx - ax) * u), this.X(az + (bz - az) * u), width, s); }
    }
    return this;
  }
  free(x: number, z: number, kind: ObjectKind, gap = 0.75) {
    const r = ITEMS[kind].r;
    return !this.w.objects.some((o) => Math.hypot(o.p[0] - x, o.p[2] - z) < (ITEMS[o.kind].r * o.s + r) * gap);
  }
  /** place one object; fx/fz in radius fractions; face: angle or "center" */
  put(kind: ObjectKind, fx: number, fz: number, o: { r?: number | "center" | "out"; s?: number; lift?: number; force?: boolean } = {}) {
    const x = this.X(fx), z = this.X(fz);
    if (!o.force && (!canPlace(this.t, kind, x, z) || !this.free(x, z, kind, 0.6))) return null;
    let rot = typeof o.r === "number" ? o.r : this.r() * Math.PI * 2;
    if (o.r === "center") rot = Math.atan2(-x, -z);
    if (o.r === "out") rot = Math.atan2(x, z);
    const p: Placed = { id: id(this.key), kind, p: [x, o.lift ?? ITEMS[kind].lift ?? 0, z], r: rot, s: o.s ?? (STRUCT.has(kind) ? 1 : 0.8 + this.r() * 0.5), v: Math.floor(this.r() * 1000) };
    this.w.objects.push(p);
    return p;
  }
  /** scatter n objects in an area (circle in radius fractions), on land, avoiding painted paths */
  scatter(kind: ObjectKind, n: number, a: { fx?: number; fz?: number; fr?: number; minR?: number; s?: [number, number]; minH?: number; maxSlope?: number; avoid?: Surface[]; lift?: [number, number] } = {}) {
    const cx = a.fx ?? 0, cz = a.fz ?? 0, fr = a.fr ?? 0.85;
    let placed = 0;
    for (let tries = 0; tries < n * 40 && placed < n; tries++) {
      const ang = this.r() * Math.PI * 2, m = a.minR ?? 0, d = Math.sqrt(m * m / (fr * fr) + this.r() * (1 - m * m / (fr * fr))) * fr;
      const fx = cx + Math.cos(ang) * d, fz = cz + Math.sin(ang) * d, x = this.X(fx), z = this.X(fz);
      if (!insideIsland(this.t, x, z, 0.5) || !canPlace(this.t, kind, x, z)) continue;
      if (heightAt(this.t, x, z) < this.t.water + (a.minH ?? 0.08)) continue;
      if (slopeAt(this.t, x, z) > (a.maxSlope ?? 1.2)) continue;
      const surf = surfaceAt(this.t, x, z);
      if ((a.avoid ?? ["path"]).includes(surf)) continue;
      if (!this.free(x, z, kind, 0.8)) continue;
      const s = a.s ? a.s[0] + this.r() * (a.s[1] - a.s[0]) : undefined;
      const lift = a.lift ? a.lift[0] + this.r() * (a.lift[1] - a.lift[0]) : undefined;
      if (this.put(kind, fx, fz, { s, lift, force: true })) placed++;
    }
    return this;
  }
  /** objects over water (lanterns, star dust) */
  overWater(kind: ObjectKind, n: number, lift: [number, number]) {
    let placed = 0;
    for (let tries = 0; tries < n * 60 && placed < n; tries++) {
      const ang = this.r() * Math.PI * 2, d = Math.sqrt(this.r()) * 0.85, x = this.X(Math.cos(ang) * d), z = this.X(Math.sin(ang) * d);
      if (heightAt(this.t, x, z) > this.t.water - 0.05 || !this.free(x, z, kind, 1.4)) continue;
      this.put(kind, x / this.R, z / this.R, { lift: lift[0] + this.r() * (lift[1] - lift[0]), force: true }); placed++;
    }
    return this;
  }
  ring(kind: ObjectKind, fx: number, fz: number, fr: number, n: number, o: { face?: "center" | "out"; s?: number; lift?: number; phase?: number } = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (o.phase ?? 0);
      const px = fx + Math.cos(a) * fr, pz = fz + Math.sin(a) * fr;
      const x = this.X(px), z = this.X(pz);
      let rot: number | undefined;
      if (o.face === "center") rot = Math.atan2(this.X(fx) - x, this.X(fz) - z);
      if (o.face === "out") rot = Math.atan2(x - this.X(fx), z - this.X(fz));
      this.put(kind, px, pz, { r: rot, s: o.s, lift: o.lift, force: canPlace(this.t, kind, x, z) });
    }
    return this;
  }
  along(kind: ObjectKind, pts: [number, number][], every: number, side: number, o: { lift?: number; s?: number } = {}) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.floor(L / every));
      const nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, s = i % 2 ? side : -side; this.put(kind, ax + (bx - ax) * u + nx * s, az + (bz - az) * u + nz * s, { lift: o.lift, s: o.s }); }
    }
    return this;
  }
  done(): World {
    // keep the file small
    this.t.heights = this.t.heights.map((h) => Math.round(h * 1000) / 1000);
    this.t.edge = this.t.edge.map((h) => Math.round(h * 10000) / 10000);
    this.w.objects = this.w.objects.map((o) => ({ ...o, p: o.p.map((v) => Math.round(v * 1000) / 1000) as [number, number, number], r: Math.round(o.r * 1000) / 1000, s: Math.round(o.s * 100) / 100 }));
    return this.w;
  }
}
const env = (time: Env["time"], weather: Env["weather"] = "clear", sky = "", ambient = 1): Env => ({ time, weather, sky, ambient });

const worlds: World[] = [];

/* 1 — the first world: a hillside village at golden hour */
{
  const b = new Builder("moonberry", "Moonberry Valley", "forest", "large", 1204, env("sunset"), "2026-08-04T19:20:00+05:30", "2026-09-02T22:10:00+05:30");
  b.flat(0, 0.05, 0.38, 14).raise(0.5, 0.42, 0.24, 1.3).flat(0.5, 0.42, 0.1, 6).lower(-0.42, -0.42, 0.2, 0.9);
  b.disc(0, 0.05, 0.13, "path").line([[-0.85, 0.2], [-0.35, 0.12], [0, 0.05], [0.3, 0.2], [0.5, 0.42]], 0.32, "path").line([[0, 0.05], [0.1, -0.35], [-0.15, -0.7]], 0.3, "path");
  b.disc(-0.5, 0.48, 0.17, "meadow").disc(0.55, -0.35, 0.16, "bloom");
  b.put("tile", 0, 0.05, { s: 1.3, r: 0 });
  b.ring("cottage", 0, 0.05, 0.27, 5, { face: "center", phase: 0.4 });
  b.put("windmill", 0.5, 0.42, { r: -2.3 });
  b.ring("mushroom", -0.5, 0.48, 0.12, 8, { s: 1.1 }); b.put("magictree", -0.5, 0.48, { s: 1.1 });
  b.along("lantern", [[-0.85, 0.2], [-0.35, 0.12], [0, 0.05], [0.3, 0.2]], 0.16, 0.06, { lift: 1.5 });
  b.put("pond", -0.4, -0.4, { s: 1.6 }); b.put("bridge", 0.08, -0.4, { r: 0.3 });
  b.scatter("tree", 26, { fx: 0, fz: -0.25, fr: 0.95, s: [0.85, 1.5] }).scatter("pine", 8, { s: [0.9, 1.4] }).scatter("bush", 14).scatter("flower", 16, { fx: 0, fz: 0.05, fr: 0.5 });
  b.scatter("rock", 8).scatter("grass", 12).scatter("stars", 3, { fx: -0.5, fz: 0.48, fr: 0.2, lift: [1, 1.8] });
  worlds.push(b.done());
}
/* 2 — pink-sky castle in the clouds */
{
  const b = new Builder("cloudnine", "Cloud Nine", "islands", "medium", 909, env("morning", "clear", "#F2B2D6"), "2026-08-15T11:00:00+05:30", "2026-09-08T18:30:00+05:30");
  b.raise(0, 0, 0.32, 1.0).flat(0, 0, 0.22, 10).disc(0, 0, 0.24, "stone").line([[0, 0], [0.75, 0.1]], 0.35, "path").line([[0, 0], [-0.45, 0.6]], 0.35, "path");
  b.put("tower", 0, 0, { s: 1.35, r: 0.2 }); b.ring("tower", 0, 0, 0.16, 3, { s: 0.9, phase: 0.5 });
  b.ring("crystal", 0, 0, 0.32, 6, { s: 1.2 });
  b.put("portal", 0.72, 0.1, { r: "center", s: 1.2 });
  b.put("bridge", -0.25, 0.32, { r: 0.6 });
  b.scatter("tree", 14, { s: [0.8, 1.3] }).scatter("bush", 8).scatter("flower", 14).scatter("patch", 3).scatter("stars", 4, { lift: [1.2, 2.4] }).scatter("lantern", 6, { lift: [1.6, 2.6] });
  worlds.push(b.done());
}
/* 3 — turquoise lagoon town */
{
  const b = new Builder("atlantis", "Little Atlantis", "ocean", "large", 3311, env("afternoon"), "2026-08-22T16:40:00+05:30", "2026-10-11T13:15:00+05:30");
  b.raise(0, 0, 0.42, 0.6).flat(0, 0, 0.3, 10).disc(0, 0, 0.12, "path");
  b.put("tile", 0, 0, { s: 1.5 }); b.ring("cottage", 0, 0, 0.24, 6, { face: "out", phase: 0.25 });
  b.line([[0, 0], [0, 0.55]], 0.28, "path").put("bridge", 0, 0.66, { r: Math.PI / 2, s: 1.2, force: true });
  b.ring("tree", 0, 0, 0.4, 12, { s: 1.15, phase: 0.1 });
  b.scatter("tree", 10, { s: [0.9, 1.3] }).scatter("rock", 10).scatter("bush", 6).scatter("flower", 8, { fr: 0.3 }).scatter("grass", 8);
  b.overWater("rock", 4, [0, 0]);
  worlds.push(b.done());
}
/* 4 — snowed-in cabins around a frozen pond, at night */
{
  const b = new Builder("frostfall", "Frostfall Hollow", "snow", "medium", 908, env("night", "snow"), "2026-09-03T21:30:00+05:30", "2026-10-02T23:05:00+05:30");
  b.flat(0.05, 0.05, 0.4, 14).line([[-0.8, -0.1], [0.05, 0.05], [0.6, 0.45]], 0.3, "path");
  b.put("pond", 0.05, 0.05, { s: 1.5 });
  b.ring("cabin", 0.05, 0.05, 0.3, 5, { face: "center", phase: 1.1 });
  b.ring("lantern", 0.05, 0.05, 0.2, 6, { lift: 1.3 });
  b.scatter("pine", 30, { minR: 0.5, s: [0.9, 1.5] }).scatter("rock", 8, { minR: 0.4 }).scatter("crystal", 3, { minR: 0.4 }).scatter("bush", 6, { minR: 0.35 });
  b.put("tower", -0.5, -0.5, { s: 1.1, r: 0.8 });
  worlds.push(b.done());
}
/* 5 — desert ruins under a violet night */
{
  const b = new Builder("echoes", "Dune of Echoes", "desert", "large", 4512, env("night", "clear", "#8177C9"), "2026-09-10T22:00:00+05:30", "2026-10-26T01:20:00+05:30");
  b.lower(0.35, -0.2, 0.2, 1.0).flat(-0.2, 0.2, 0.25, 8).disc(-0.2, 0.2, 0.22, "stone");
  b.put("portal", -0.2, 0.2, { r: "out", s: 1.4 }); b.ring("tile", -0.2, 0.2, 0.14, 4, { s: 1.1 });
  b.ring("tower", -0.2, 0.2, 0.3, 3, { s: 1.05, phase: 0.8 });
  b.ring("tree", 0.35, -0.2, 0.2, 7, { s: 1.2 }); b.ring("grass", 0.35, -0.2, 0.26, 6);
  b.scatter("crystal", 9, { s: [0.9, 1.6] }).scatter("rock", 18, { s: [0.9, 1.9] }).scatter("stars", 5, { lift: [1.4, 2.6] }).scatter("portal", 1);
  worlds.push(b.done());
}
/* 6 — pastel candy meadow */
{
  const b = new Builder("sugarplum", "Sugarplum Meadow", "candy", "medium", 615, env("afternoon", "clear", "#87DCCF"), "2026-09-20T15:10:00+05:30", "2026-10-20T19:45:00+05:30");
  b.raise(-0.4, -0.35, 0.22, 0.9).raise(0.45, -0.3, 0.18, 0.7).flat(0, 0.25, 0.3, 10);
  b.line([[-0.75, 0.4], [0, 0.25], [0.6, 0.45]], 0.35, "path").disc(0.1, -0.1, 0.2, "bloom");
  b.ring("cottage", 0, 0.25, 0.22, 3, { face: "center", phase: 0.9 });
  b.put("magictree", 0.1, -0.1, { s: 1.3 }); b.ring("flower", 0.1, -0.1, 0.16, 7, { s: 1.2 });
  b.scatter("tree", 18, { s: [0.9, 1.4] }).scatter("flower", 14).scatter("mushroom", 10, { s: [1, 1.6] }).scatter("magictree", 2).scatter("hill", 2).scatter("stars", 4, { lift: [1.2, 2.2] }).scatter("patch", 3);
  worlds.push(b.done());
}
/* 7 — an overgrown garden of ruins in the rain */
{
  const b = new Builder("garden", "The Forgotten Garden", "forest", "medium", 2718, env("morning", "rain", "#A9C9F5", 0.9), "2026-10-01T08:20:00+05:30", "2026-10-29T09:40:00+05:30");
  b.flat(0, 0, 0.42, 14).disc(0, 0, 0.32, "meadow");
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) b.put("tile", i * 0.13, j * 0.13, { s: 1.1, r: 0, force: true });
  b.ring("bush", 0, 0, 0.3, 12, { s: 1.1 }); b.ring("flower", 0, 0, 0.38, 10);
  b.put("tower", -0.45, 0.42, { s: 0.95 }); b.put("tower", 0.5, -0.35, { s: 0.8, r: 1 });
  b.put("portal", 0, 0.55, { r: "center" }); b.put("pond", 0.45, 0.35, { s: 1.2 });
  b.scatter("magictree", 2).scatter("tree", 16, { s: [0.9, 1.5] }).scatter("mushroom", 9).scatter("patch", 4).scatter("rock", 6).scatter("grass", 10);
  worlds.push(b.done());
}
/* 8 — floating lanterns over a night lagoon */
{
  const b = new Builder("lantern", "Lantern Isle", "ocean", "medium", 5150, env("night", "clear", "#A9C9F5"), "2026-10-09T20:45:00+05:30", "2026-11-06T23:30:00+05:30");
  b.raise(0.05, 0.05, 0.36, 0.5).flat(0.05, 0.05, 0.22, 8).disc(0.05, 0.05, 0.1, "path");
  b.ring("cottage", 0.05, 0.05, 0.2, 4, { face: "out", phase: 0.6 });
  b.put("bridge", 0.05, 0.5, { r: Math.PI / 2, force: true });
  b.overWater("lantern", 16, [0.9, 2.6]); b.scatter("lantern", 6, { lift: [1.6, 2.4] });
  b.scatter("tree", 14, { s: [0.9, 1.3] }).scatter("bush", 6).scatter("flower", 8).scatter("grass", 6).scatter("stars", 5, { lift: [1.6, 2.8] }).scatter("crystal", 2).scatter("rock", 5);
  worlds.push(b.done());
}
/* 9 — windmills on golden dunes */
{
  const b = new Builder("saffron", "Saffron Reach", "desert", "medium", 777, env("sunset", "clear", "#F6C6A6"), "2026-10-18T17:05:00+05:30", "2026-11-14T18:25:00+05:30");
  b.lower(0, 0, 0.2, 1.9).flat(0, 0.45, 0.22, 10).disc(0, 0.45, 0.14, "path");
  b.ring("tree", 0, 0, 0.22, 8, { s: 1.15 }); b.ring("grass", 0, 0, 0.27, 6);
  b.ring("cottage", 0, 0.45, 0.17, 4, { face: "center", phase: 0.3 });
  b.put("windmill", -0.55, -0.3, { r: 0.9 }); b.put("windmill", 0.5, -0.4, { r: -0.7 }); b.put("windmill", 0.62, 0.2, { r: -1.6 });
  b.line([[0, 0.45], [-0.55, -0.3]], 0.25, "path").line([[0, 0.45], [0.5, -0.4]], 0.25, "path");
  b.scatter("tree", 6, { minR: 0.3, s: [0.9, 1.2] }).scatter("rock", 10, { s: [0.9, 1.7] }).scatter("tile", 3).scatter("crystal", 2).scatter("lantern", 4, { fx: 0, fz: 0.45, fr: 0.3, lift: [1.5, 2.2] });
  worlds.push(b.done());
}
/* 10 — the newest: a starlit sky-island sanctuary */
{
  const b = new Builder("starlit", "Starlit Drift", "islands", "large", 3030, env("night", "clear", "#8177C9"), "2026-10-28T23:10:00+05:30", "2026-11-19T00:45:00+05:30");
  b.raise(0, 0, 0.3, 0.8).flat(0, 0, 0.2, 10).disc(0, 0, 0.2, "bloom");
  b.put("portal", 0, 0, { r: 0.6, s: 1.5 }); b.ring("crystal", 0, 0, 0.2, 8, { s: 1.2 }); b.ring("lantern", 0, 0, 0.32, 10, { lift: 1.8 });
  b.ring("magictree", 0, 0, 0.5, 4, { s: 1.2, phase: 0.4 }); b.put("tower", -0.55, 0.45, { s: 1.2 }); b.put("tower", 0.6, -0.45, { s: 1.1 });
  b.scatter("tree", 14, { s: [0.9, 1.4] }).scatter("stars", 8, { lift: [1.4, 3] }).scatter("flower", 10).scatter("mushroom", 6).scatter("rock", 6);
  worlds.push(b.done());
}

writeFileSync(process.argv[2] ?? "public/showcase.json", JSON.stringify({ app: "pocket-universe", version: 1, worlds }));
for (const w of worlds) console.log(w.name.padEnd(22), w.biome.padEnd(8), w.size.padEnd(7), w.env.time.padEnd(10), w.objects.length, "objects");
